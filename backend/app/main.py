import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.db import Database
from app.deps import client_key
from app.logging_config import configure_logging
from app.rate_limit import Limits
from app.routes import decisions, health, materials, projects, sketches
from app.services.jev import JevClient, JevProvider, build_provider

logger = logging.getLogger("esketcher.api")

BODY_METHODS = frozenset({"POST", "PUT", "PATCH"})


def create_app(settings: Settings | None = None, provider: JevProvider | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings
        app.state.db = Database(settings.database_url)
        await app.state.db.create_all()
        app.state.jev = JevClient(provider or build_provider(settings))
        app.state.limits = Limits.from_settings(settings)
        logger.info("startup", extra={"jev_mode": app.state.jev.provider.mode, "env": settings.env})
        try:
            yield
        finally:
            await app.state.jev.provider.aclose()
            await app.state.db.dispose()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )

    def refuse(
        status: int, code: str, message: str, retry_after: float | None = None
    ) -> JSONResponse:
        headers = {"Retry-After": str(int(retry_after) + 1)} if retry_after is not None else None
        return JSONResponse(
            {"detail": {"code": code, "message": message}}, status_code=status, headers=headers
        )

    # Starlette runs the last-added middleware first: CORS (outermost, so refusals
    # still carry CORS headers), then the request log, then this guard.
    @app.middleware("http")
    async def guard(request: Request, call_next):
        if request.url.path.startswith("/api"):
            if request.method in BODY_METHODS:
                length = request.headers.get("content-length", "")
                # the server enforces the declared length, so checking it bounds the body
                if not length.isdigit():
                    return refuse(411, "length_required", "Send a Content-Length header")
                if int(length) > settings.max_project_bytes:
                    return refuse(413, "too_large", "Request body is too large")
            wait = request.app.state.limits.requests.check(client_key(request))
            if wait is not None:
                return refuse(429, "rate_limited", "Too many requests, slow down.", wait)
        return await call_next(request)

    @app.middleware("http")
    async def request_log(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("unhandled_error", extra={"request_id": request_id})
            response = JSONResponse(
                {"detail": {"code": "internal", "message": "Unexpected server error"}},
                status_code=500,
            )
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["Retry-After", "X-Request-ID"],
    )

    for router in (health, sketches, materials, decisions, projects):
        app.include_router(router.router, prefix="/api")
    return app


configure_logging()
app = create_app()
