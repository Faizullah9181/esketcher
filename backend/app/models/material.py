from typing import Literal

from pydantic import Field

from app.models.common import CamelModel

MaterialBehavior = Literal[
    "liquid",
    "spray",
    "watercolor",
    "ink",
    "chrome",
    "pixel",
    "smoke",
    "glitter",
    "lava",
    "holographic",
    "grain",
    "crystal",
    "impasto",
]

Texture = Literal[
    "glossy", "matte", "grainy", "fibrous", "granular", "faceted", "noisy", "woven", "velvety"
]


class Material(CamelModel):
    id: str
    name: str
    type: MaterialBehavior
    texture: Texture
    color_family: str
    palette: tuple[str, str, str] = Field(description="base, highlight, shadow")
    intensity: float = Field(ge=0, le=1)
    roughness: float = Field(ge=0, le=1)
    viscosity: float = Field(ge=0, le=1)
    luminous: bool
    tags: tuple[str, ...]


class PaletteDirection(CamelModel):
    id: str
    name: str
    families: tuple[str, ...] = Field(description="material colour families that belong to it")
    description: str
