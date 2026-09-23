from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator

from app.models.common import CamelModel

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")]
Composition = Literal[
    "center-heavy",
    "top-heavy",
    "bottom-heavy",
    "left-heavy",
    "right-heavy",
    "balanced",
    "scattered",
]
TreatmentMode = Literal["focal-accent", "full-flood", "duotone", "spectrum-mix"]
Certainty = Literal["confident", "leaning", "uncertain"]


class TargetFeatures(CamelModel):
    """What the user selected, measured by the client from real geometry."""

    kind: str = Field(pattern=r"^[a-z][a-z0-9-]{0,31}$", examples=["iris"])
    label: str = Field(min_length=1, max_length=48, pattern=r"^[\w .,'/-]+$")
    area_ratio: float = Field(ge=0, le=1)
    complexity: float = Field(ge=0, le=1)
    stroke_density: float = Field(ge=0, le=1)
    symmetry: float = Field(ge=0, le=1)
    composition: Composition = "balanced"
    dominant_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class SketchContext(CamelModel):
    sketch_id: Slug
    neighbor_material_ids: list[Slug] = Field(default_factory=list, max_length=24)
    chaos: bool = False
    #: the board's palette direction, when one has been chosen
    palette: Slug | None = None


class DecisionRequest(CamelModel):
    target: TargetFeatures
    context: SketchContext
    candidate_materials: list[Slug] = Field(min_length=2, max_length=16)
    scope: Literal["region", "sketch"] = "region"

    @field_validator("candidate_materials")
    @classmethod
    def _unique(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("candidate materials must be unique")
        return value


class RetryRequest(DecisionRequest):
    rejected_material_ids: list[Slug] = Field(default_factory=list, max_length=16)
    attempt: int = Field(default=1, ge=1, le=50)


class RankedMaterial(CamelModel):
    material_id: str
    probability: float
    rank: int


class TreatmentDecision(CamelModel):
    mode: TreatmentMode
    probabilities: dict[str, float]
    confidence: float


class Usage(CamelModel):
    input_tokens: int
    output_tokens: int


class DecisionResponse(CamelModel):
    decision_id: str
    selected_material: str
    probabilities: dict[str, float]
    ranking: list[RankedMaterial]
    confidence: float
    certainty: Certainty
    treatment: TreatmentDecision | None = None
    latency_ms: int
    provider: Literal["real", "mock"]
    model: str
    usage: Usage | None = None


class PaletteRequest(CamelModel):
    target: TargetFeatures
    context: SketchContext


class PaletteDecision(CamelModel):
    decision_id: str
    palette: str
    probabilities: dict[str, float]
    confidence: float
    certainty: Certainty
    latency_ms: int
    provider: Literal["real", "mock"]
    model: str


class JevHealth(CamelModel):
    mode: Literal["real", "mock"]
    model: str
    online: bool
    latency_ms: int | None = None
    available_models: list[str] = Field(default_factory=list)
    error: str | None = None


class HealthResponse(CamelModel):
    status: Literal["ok"]
    version: str
    jev: JevHealth
