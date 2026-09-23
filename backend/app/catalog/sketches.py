"""The starter sketch library.

Sketches are procedural line art: the frontend draws each one from
(category, variant, seed, complexity), so the manifest stays tiny and nothing
depends on external image URLs.
"""

import hashlib

from app.models.sketch import Sketch

_TITLES: dict[str, tuple[tuple[str, tuple[str, ...]], ...]] = {
    "faces": (
        ("Portrait of a Stranger", ("portrait", "calm")),
        ("The Listener", ("portrait", "profile")),
        ("Profile in Thirds", ("portrait", "geometric")),
        ("Sleeping Oracle", ("portrait", "dream")),
        ("Twin Gaze", ("portrait", "symmetry")),
    ),
    "hands": (
        ("Open Palm", ("gesture", "offering")),
        ("Pointing Hand", ("gesture", "direction")),
        ("Mudra", ("gesture", "ritual")),
        ("Reaching", ("gesture", "longing")),
        ("Counting Fingers", ("gesture", "play")),
    ),
    "flowers": (
        ("Night Bloom", ("petals", "nocturnal")),
        ("Solar Daisy", ("petals", "bright")),
        ("Rose Diagram", ("petals", "layered")),
        ("Lotus Engine", ("petals", "sacred")),
        ("Wild Poppy", ("petals", "field")),
    ),
    "animals": (
        ("Fox at Rest", ("mammal", "curled")),
        ("Koi", ("fish", "water")),
        ("Heron", ("bird", "tall")),
        ("Owl Study", ("bird", "night")),
        ("Whale Song", ("mammal", "ocean")),
    ),
    "insects": (
        ("Moth Specimen", ("wings", "specimen")),
        ("Jewel Beetle", ("shell", "iridescent")),
        ("Dragonfly", ("wings", "fast")),
        ("Mantis", ("predator", "angular")),
        ("Swallowtail", ("wings", "butterfly")),
    ),
    "architecture": (
        ("Brutalist Block", ("building", "concrete")),
        ("Arch Sequence", ("building", "rhythm")),
        ("Lighthouse", ("building", "coast")),
        ("Pagoda", ("building", "tiered")),
        ("Skyline 3AM", ("city", "night")),
    ),
    "geometry": (
        ("Tessellation", ("pattern", "tiles")),
        ("Golden Spiral", ("pattern", "ratio")),
        ("Platonic Study", ("solids", "wireframe")),
        ("Moire Rings", ("pattern", "optical")),
        ("Shard Field", ("pattern", "fractured")),
    ),
    "landscapes": (
        ("Ridge Line", ("mountains", "dawn")),
        ("Desert Dunes", ("sand", "heat")),
        ("Lake Mirror", ("water", "still")),
        ("Volcano", ("mountains", "eruption")),
        ("Pine Horizon", ("forest", "cold")),
    ),
    "planets": (
        ("Ringed Giant", ("space", "rings")),
        ("Twin Moons", ("space", "orbit")),
        ("Cratered World", ("space", "rock")),
        ("Gas Storm", ("space", "bands")),
        ("Orbit Diagram", ("space", "system")),
    ),
    "creatures": (
        ("Deep Drifter", ("jelly", "abyss")),
        ("Many-Eyed Friend", ("eyes", "friendly")),
        ("Tentacle Bloom", ("tentacles", "organic")),
        ("Cloud Grazer", ("floating", "gentle")),
        ("Pocket Hydra", ("heads", "tiny")),
    ),
    "symbols": (
        ("Sigil I", ("occult", "circle")),
        ("Compass Rose", ("navigation", "radial")),
        ("Sun Wheel", ("solar", "radial")),
        ("Eye of the Grid", ("occult", "eye")),
        ("Knotwork", ("interlace", "loop")),
    ),
    "typography": (
        ("PAINT", ("letters", "block")),
        ("GLOW", ("letters", "block")),
        ("WET", ("letters", "block")),
        ("JEV", ("letters", "block")),
        ("NOISE", ("letters", "block")),
    ),
    "mechanical": (
        ("Gear Train", ("gears", "precision")),
        ("Piston Heart", ("engine", "pump")),
        ("Clockwork", ("gears", "time")),
        ("Turbine", ("blades", "radial")),
        ("Robot Arm", ("joints", "industrial")),
    ),
    "fashion": (
        ("Evening Gown", ("silhouette", "flowing")),
        ("Trench Silhouette", ("silhouette", "coat")),
        ("Ball Skirt", ("silhouette", "volume")),
        ("Tailored Jacket", ("silhouette", "sharp")),
        ("Kimono", ("silhouette", "wide")),
    ),
    "botanical": (
        ("Fern Frond", ("leaf", "fractal")),
        ("Monstera", ("leaf", "tropical")),
        ("Seed Pod", ("seed", "anatomy")),
        ("Cactus", ("succulent", "spines")),
        ("Root System", ("roots", "branching")),
    ),
    "surreal": (
        ("Floating Staircase", ("impossible", "stairs")),
        ("Melting Clock", ("time", "melt")),
        ("Door in the Sea", ("portal", "horizon")),
        ("Moon Jar", ("vessel", "moon")),
        ("Cloud Hand", ("impossible", "sky")),
    ),
    "monsters": (
        ("Grin Beast", ("teeth", "wide")),
        ("Horned Thing", ("horns", "menace")),
        ("Swamp King", ("crown", "bog")),
        ("Cyclops", ("eye", "giant")),
        ("Toothy Blob", ("teeth", "soft")),
    ),
    "masks": (
        ("Carnival Mask", ("festival", "ornate")),
        ("Oni", ("demon", "folk")),
        ("Shield Mask", ("ritual", "geometric")),
        ("Plague Doctor", ("beak", "history")),
        ("Ghost Face", ("pale", "hollow")),
    ),
    "eyes": (
        ("The Watcher", ("iris", "stare")),
        ("Iris Machine", ("iris", "mechanical")),
        ("Third Eye", ("iris", "mystic")),
        ("Cat Eye", ("iris", "slit")),
        ("Tear", ("iris", "sorrow")),
    ),
    "bodies": (
        ("Dancer", ("figure", "motion")),
        ("Seated Figure", ("figure", "rest")),
        ("Runner", ("figure", "speed")),
        ("Torso Study", ("figure", "anatomy")),
        ("Reclining", ("figure", "horizontal")),
    ),
    "objects": (
        ("Vase Study", ("vessel", "still-life")),
        ("Teacup", ("vessel", "ritual")),
        ("Bottle Trio", ("vessel", "group")),
        ("Desk Lamp", ("light", "domestic")),
        ("Chair", ("furniture", "classic")),
    ),
}


def _seed(key: str) -> int:
    return int.from_bytes(hashlib.sha256(key.encode()).digest()[:4], "big")


def _build() -> tuple[Sketch, ...]:
    sketches = []
    for category, titles in _TITLES.items():
        for variant, (title, tags) in enumerate(titles):
            seed = _seed(f"{category}:{variant}")
            number = len(sketches) + 1
            sketches.append(
                Sketch(
                    id=f"sk-{number:03d}",
                    title=title,
                    category=category,
                    # 0.3..0.95, stable per sketch; the generator uses it for detail level
                    complexity=round(0.3 + (seed % 1000) / 1000 * 0.65, 2),
                    tags=(category, *tags),
                    seed=seed,
                    variant=variant,
                    preview=f"procedural://{category}/{variant}/{seed}",
                )
            )
    return tuple(sketches)


SKETCHES: tuple[Sketch, ...] = _build()
SKETCHES_BY_ID: dict[str, Sketch] = {s.id: s for s in SKETCHES}
