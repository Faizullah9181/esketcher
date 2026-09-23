from datetime import datetime
from typing import Any

from pydantic import Field

from app.models.common import CamelModel


class ProjectCreate(CamelModel):
    name: str = Field(default="Untitled universe", min_length=1, max_length=80)
    snapshot: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    snapshot: dict[str, Any]
    revision: int | None = Field(default=None, ge=0, description="Optimistic concurrency guard")


class ProjectOut(CamelModel):
    id: str
    name: str
    snapshot: dict[str, Any]
    revision: int
    created_at: datetime
    updated_at: datetime
