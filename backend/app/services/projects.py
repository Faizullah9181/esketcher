import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db import ProjectRow, utcnow
from app.models.project import ProjectCreate, ProjectOut, ProjectUpdate


class ProjectNotFoundError(LookupError):
    pass


class RevisionConflictError(RuntimeError):
    def __init__(self, current: int) -> None:
        super().__init__(f"project is at revision {current}")
        self.current = current


def _out(row: ProjectRow) -> ProjectOut:
    return ProjectOut(
        id=row.id,
        name=row.name,
        snapshot=row.snapshot,
        revision=row.revision,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: ProjectCreate) -> ProjectOut:
        row = ProjectRow(id=str(uuid.uuid4()), name=data.name, snapshot=data.snapshot, revision=0)
        self._session.add(row)
        await self._session.commit()
        return _out(row)

    async def get(self, project_id: str) -> ProjectOut:
        return _out(await self._row(project_id))

    async def update(self, project_id: str, data: ProjectUpdate) -> ProjectOut:
        row = await self._row(project_id)
        if data.revision is not None and data.revision != row.revision:
            raise RevisionConflictError(row.revision)
        row.snapshot = data.snapshot
        if data.name is not None:
            row.name = data.name
        row.revision += 1
        row.updated_at = utcnow()
        await self._session.commit()
        return _out(row)

    async def _row(self, project_id: str) -> ProjectRow:
        row = await self._session.get(ProjectRow, project_id)
        if row is None:
            raise ProjectNotFoundError(project_id)
        return row
