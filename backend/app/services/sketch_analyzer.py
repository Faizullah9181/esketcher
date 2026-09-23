"""Turns measured selection features into the `state` Jev reasons over.

The client measures geometry (area, stroke density, symmetry). This module adds
the catalog context and a small vocabulary so the numbers read as design language.
"""

from typing import Any

from app.catalog.materials import MATERIALS_BY_ID
from app.catalog.palettes import PALETTES_BY_ID
from app.catalog.sketches import SKETCHES_BY_ID
from app.models.decision import DecisionRequest, PaletteRequest
from app.services import color


def describe_level(value: float, words: tuple[str, str, str, str]) -> str:
    """Map 0..1 onto four words, e.g. ("sparse", "light", "busy", "dense")."""
    index = min(int(value * len(words)), len(words) - 1)
    return words[index]


def painted_colours(material_ids: list[str]) -> list[dict[str, str]]:
    """What is already on the board, in colour words."""
    out = []
    for mid in material_ids:
        material = MATERIALS_BY_ID.get(mid)
        if material:
            out.append(
                {
                    "name": material.name,
                    "hues": color.describe_palette(material.palette),
                    "temperature": color.temperature(material.palette),
                }
            )
    return out


def build_state(request: DecisionRequest | PaletteRequest) -> dict[str, Any]:
    target = request.target
    sketch = SKETCHES_BY_ID.get(request.context.sketch_id)
    neighbors = painted_colours(request.context.neighbor_material_ids)
    state: dict[str, Any] = {
        "sketch": {
            "title": sketch.title if sketch else "Freeform sketch",
            "category": sketch.category if sketch else "freeform",
            "tags": list(sketch.tags) if sketch else [],
            "complexity": describe_level(
                target.complexity, ("minimal", "simple", "detailed", "intricate")
            ),
        },
        "target": {
            "scope": "one region"
            if getattr(request, "scope", "sketch") == "region"
            else "the whole sketch",
            "kind": target.kind,
            "label": target.label,
            "size": describe_level(target.area_ratio, ("tiny", "small", "large", "dominant")),
            "lineDensity": describe_level(
                target.stroke_density, ("sparse", "light", "busy", "dense")
            ),
            "symmetry": describe_level(
                target.symmetry, ("chaotic", "loose", "balanced", "mirrored")
            ),
            "composition": target.composition,
            "metrics": {
                "areaRatio": round(target.area_ratio, 3),
                "complexity": round(target.complexity, 3),
                "strokeDensity": round(target.stroke_density, 3),
                "symmetry": round(target.symmetry, 3),
            },
        },
        "canvas": {
            "alreadyPainted": neighbors,
            "mood": "chaotic and experimental" if request.context.chaos else "considered",
        },
    }
    palette = PALETTES_BY_ID.get(request.context.palette or "")
    if palette:
        state["canvas"]["paletteDirection"] = {
            "name": palette.name,
            "description": palette.description,
        }
    if target.dominant_color:
        state["target"]["dominantColor"] = target.dominant_color
    return state
