from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_jev, rate_limited
from app.models.decision import (
    DecisionRequest,
    DecisionResponse,
    PaletteDecision,
    PaletteRequest,
    RetryRequest,
)
from app.services.jev import CandidateError, JevClient, JevError

router = APIRouter(prefix="/jev", tags=["Jev"], dependencies=[Depends(rate_limited)])


def _as_http(exc: Exception) -> HTTPException:
    if isinstance(exc, CandidateError):
        return HTTPException(422, detail={"code": "bad_candidates", "message": str(exc)})
    assert isinstance(exc, JevError)
    return HTTPException(exc.http_status, detail={"code": exc.code, "message": exc.message})


@router.post("/decide", response_model=DecisionResponse)
async def decide(
    body: DecisionRequest, jev: Annotated[JevClient, Depends(get_jev)]
) -> DecisionResponse:
    """Ask Jev to choose a material for the target from the candidate set."""
    try:
        return await jev.decide(body)
    except (CandidateError, JevError) as exc:
        raise _as_http(exc) from exc


@router.post("/retry", response_model=DecisionResponse)
async def retry(
    body: RetryRequest, jev: Annotated[JevClient, Depends(get_jev)]
) -> DecisionResponse:
    """Ask again without the materials the user rejected."""
    try:
        return await jev.retry(body)
    except (CandidateError, JevError) as exc:
        raise _as_http(exc) from exc


@router.post("/palette", response_model=PaletteDecision)
async def palette(
    body: PaletteRequest, jev: Annotated[JevClient, Depends(get_jev)]
) -> PaletteDecision:
    """Ask Jev for a board-level palette direction before painting its regions."""
    try:
        return await jev.decide_palette(body)
    except JevError as exc:
        raise _as_http(exc) from exc
