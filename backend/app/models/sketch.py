from typing import Literal

from pydantic import Field

from app.models.common import CamelModel

SketchCategory = Literal[
    "faces",
    "hands",
    "flowers",
    "animals",
    "insects",
    "architecture",
    "geometry",
    "landscapes",
    "planets",
    "creatures",
    "symbols",
    "typography",
    "mechanical",
    "fashion",
    "botanical",
    "surreal",
    "monsters",
    "masks",
    "eyes",
    "bodies",
    "objects",
]


class Sketch(CamelModel):
    id: str
    title: str
    category: SketchCategory
    complexity: float = Field(ge=0, le=1)
    tags: tuple[str, ...]
    seed: int
    variant: int = Field(ge=0, description="Which layout the category generator draws")
    preview: str = Field(description="procedural://<category>/<variant>/<seed>")
