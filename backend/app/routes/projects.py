from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_session
from app.models.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.projects import ProjectNotFoundError, ProjectService, RevisionConflictError

router = APIRouter(prefix="/projects", tags=["Projects"])

Session = Annotated[AsyncSession, Depends(get_session)]


def _guard_size(request: Request) -> None:
    limit = request.app.state.settings.max_project_bytes
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > limit:
        raise HTTPException(413, detail={"code": "too_large", "message": "Project is too large"})


def _not_found() -> HTTPException:
    return HTTPException(404, detail={"code": "not_found", "message": "No such project"})


@router.post("", response_model=ProjectOut, status_code=201, dependencies=[Depends(_guard_size)])
async def create_project(body: ProjectCreate, session: Session) -> ProjectOut:
    return await ProjectService(session).create(body)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, session: Session) -> ProjectOut:
    try:
        return await ProjectService(session).get(project_id)
    except ProjectNotFoundError as exc:
        raise _not_found() from exc


@router.put("/{project_id}", response_model=ProjectOut, dependencies=[Depends(_guard_size)])
async def update_project(project_id: str, body: ProjectUpdate, session: Session) -> ProjectOut:
    try:
        return await ProjectService(session).update(project_id, body)
    except ProjectNotFoundError as exc:
        raise _not_found() from exc
    except RevisionConflictError as exc:
        raise HTTPException(
            409,
            detail={"code": "conflict", "message": str(exc), "revision": exc.current},
        ) from exc
