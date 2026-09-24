from collections.abc import AsyncIterator

from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.rate_limit import Limits
from app.services.jev import JevClient


def get_jev(request: Request) -> JevClient:
    return request.app.state.jev


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async for session in request.app.state.db.session():
        yield session


def client_key(request: Request) -> str:
    """The caller's IP. Uvicorn rewrites it from X-Forwarded-For only for trusted proxies."""
    return request.client.host if request.client else "unknown"


def too_many(code: str, message: str, retry_after: float) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={"code": code, "message": message},
        headers={"Retry-After": str(int(retry_after) + 1)},
    )


def jev_limited(request: Request) -> None:
    """Per-client minute and day limits, then the server's daily budget. Each only
    counts a call the earlier ones let through, so a blocked client can't drain
    the shared budget."""
    limits: Limits = request.app.state.limits
    client = client_key(request)
    if (wait := limits.jev.check(client)) is not None:
        raise too_many("rate_limited", "Too many Jev decisions, slow down.", wait)
    if (wait := limits.jev_daily.check(client)) is not None:
        raise too_many(
            "daily_limit", "You've used today's Jev decisions. They reset at midnight UTC.", wait
        )
    if (wait := limits.jev_budget.check("*")) is not None:
        raise too_many(
            "jev_budget",
            "Jev has used today's budget on this server. It resets at midnight UTC.",
            wait,
        )


def writes_limited(request: Request) -> None:
    limits: Limits = request.app.state.limits
    if (wait := limits.writes.check(client_key(request))) is not None:
        raise too_many("rate_limited", "Too many saves, slow down.", wait)
