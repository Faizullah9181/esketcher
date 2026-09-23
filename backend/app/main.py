import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.db import Database
from app.logging_config import configure_logging
from app.rate_limit import RateLimiter
from app.routes import decisions, health, materials, projects, sketches
from app.services.jev import JevClient, JevProvider, build_provider

logger = logging.getLogger("esketcher.api")


def create_app(settings: Settings | None = None, provider: JevProvider | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings
        app.state.db = Database(settings.database_url)
        await app.state.db.create_all()
        app.state.jev = JevClient(provider or build_provider(settings))
        app.state.rate_limiter = RateLimiter(settings.jev_rate_limit_per_minute)
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

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

    for router in (health, sketches, materials, decisions, projects):
        app.include_router(router.router, prefix="/api")
    return app


configure_logging()
app = create_app()
