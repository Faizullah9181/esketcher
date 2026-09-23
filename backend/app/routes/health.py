from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.deps import get_jev
from app.models.decision import HealthResponse
from app.services.jev import JevClient

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request, jev: Annotated[JevClient, Depends(get_jev)]) -> HealthResponse:
    """Server liveness plus Jev reachability. Always 200 while the API is up."""
    return HealthResponse(
        status="ok", version=request.app.state.settings.version, jev=await jev.get_health()
    )
