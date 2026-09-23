"""Builds Jev questions from the candidate set and turns answers into decisions.

The candidates are a finite, described set; Jev returns a distribution;
everything around the distribution (normalisation, ranking, certainty bands)
is plain deterministic code.
"""

from typing import Any

from app.catalog.palettes import PALETTES
from app.models.decision import Certainty, RankedMaterial
from app.models.material import Material
from app.services import color

MATERIAL_INSTRUCTIONS = (
    "You are the colour and material director of a generative painting studio. Choose "
    "the one paint for this region of a line-art sketch so the finished sketch looks "
    "like one deliberate, beautiful palette rather than random colours. Rules, in "
    "order: (1) stay inside the sketch's palette direction when one is given; "
    "(2) harmonise with the colours already painted: pick analogous hues, or a single "
    "complementary accent; never add an unrelated third hue family; (3) focal "
    "features (eyes, irises, cores, windows, suns) get the most luminous or contrasting "
    "option; large background areas (sky, sea, skin, fabric) get calmer, softer or "
    "darker paints so the focal parts stand out; (4) match the paint's behaviour to "
    "the subject: soft washes for petals and skies, metals for gears and machines, "
    "liquids and gels for eyes and water, dry media for drawings and textiles."
)

TREATMENT_INSTRUCTIONS = (
    "The whole sketch will be painted. Decide how the chosen materials should be "
    "distributed across its regions."
)

TREATMENT_CRITERIA: dict[str, str] = {
    "focal-accent": "Paint only the focal regions and leave the rest as bare line art. "
    "Best when one feature carries the image.",
    "full-flood": "Paint every region with the single best material. Best for simple, "
    "bold silhouettes.",
    "duotone": "Alternate the two best materials across regions. Best for balanced, "
    "symmetric compositions.",
    "spectrum-mix": "Spread the four best materials across regions. Best for busy, "
    "intricate sketches with many parts.",
}

CONFIDENT_AT = 0.55
UNCERTAIN_BELOW = 0.35


PALETTE_INSTRUCTIONS = (
    "Choose the colour palette for this whole line-art sketch before it is painted. "
    "Pick the direction that best suits its subject and mood, so every region can be "
    "painted in one harmonious scheme. Prefer palettes that make the subject read "
    "clearly: natural subjects suit natural palettes, machines suit metals, night and "
    "cosmic subjects suit glowing palettes."
)


def colour_words(material: Material) -> dict[str, Any]:
    base, highlight, shadow = material.palette
    return {
        "hues": color.describe_palette(material.palette),
        "temperature": color.temperature(material.palette),
        "base": color.hue_name(base),
        "highlight": color.hue_name(highlight),
        "shadow": color.hue_name(shadow),
    }


def material_criterion(material: Material) -> dict[str, Any]:
    """One candidate as Jev sees it: prose plus the traits it can weigh."""
    words = colour_words(material)
    return {
        "what": (
            f"{material.name}: a {material.texture} {material.type} paint in "
            f"{words['hues']} ({words['temperature']} tones"
            f"{', luminous' if material.luminous else ''})."
        ),
        "traits": {
            "behavior": material.type,
            "texture": material.texture,
            "colorFamily": material.color_family,
            "colours": words,
            "intensity": material.intensity,
            "roughness": material.roughness,
            "viscosity": material.viscosity,
            "luminous": material.luminous,
            "tags": list(material.tags),
        },
    }


def build_questions(candidates: list[Material], with_treatment: bool) -> dict[str, Any]:
    questions: dict[str, Any] = {
        "material": {
            "type": "choice",
            "instructions": MATERIAL_INSTRUCTIONS,
            "criteria": {m.id: material_criterion(m) for m in candidates},
        }
    }
    if with_treatment:
        questions["treatment"] = {
            "type": "choice",
            "instructions": TREATMENT_INSTRUCTIONS,
            "criteria": TREATMENT_CRITERIA,
        }
    return questions


def build_palette_question() -> dict[str, Any]:
    return {
        "palette": {
            "type": "choice",
            "instructions": PALETTE_INSTRUCTIONS,
            "criteria": {
                p.id: {"what": f"{p.name}: {p.description}.", "families": list(p.families)}
                for p in PALETTES
            },
        }
    }


def normalize(probabilities: dict[str, float], keys: list[str]) -> dict[str, float]:
    """Restrict to `keys`, fill gaps with 0, clamp negatives and renormalise to 1.

    Falls back to uniform when the answer carries no usable mass, so the UI always
    has a full field to draw.
    """
    cleaned = {key: max(0.0, float(probabilities.get(key, 0.0))) for key in keys}
    total = sum(cleaned.values())
    if total <= 0:
        return {key: round(1 / len(keys), 4) for key in keys}
    return {key: round(value / total, 4) for key, value in cleaned.items()}


def rank(probabilities: dict[str, float]) -> list[RankedMaterial]:
    ordered = sorted(probabilities.items(), key=lambda item: (-item[1], item[0]))
    return [
        RankedMaterial(material_id=key, probability=value, rank=index + 1)
        for index, (key, value) in enumerate(ordered)
    ]


def certainty(confidence: float) -> Certainty:
    if confidence >= CONFIDENT_AT:
        return "confident"
    if confidence < UNCERTAIN_BELOW:
        return "uncertain"
    return "leaning"
