from collections.abc import AsyncIterator

from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.jev import JevClient


def get_jev(request: Request) -> JevClient:
    return request.app.state.jev


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async for session in request.app.state.db.session():
        yield session


def rate_limited(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    retry_after = request.app.state.rate_limiter.check(client)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail={"code": "rate_limited", "message": "Too many Jev decisions, slow down."},
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
