"""Palette directions: a board-level colour plan Jev picks before painting regions."""

from app.models.material import PaletteDirection

PALETTES: tuple[PaletteDirection, ...] = (
    PaletteDirection(
        id="neon-night",
        name="Neon night",
        families=("neon", "spectral", "toxic"),
        description="Luminous magenta, cyan and acid green glowing against the dark",
    ),
    PaletteDirection(
        id="sunset-fire",
        name="Sunset fire",
        families=("fire", "candy", "earth"),
        description="Hot oranges, reds and gold; warm, dramatic and high contrast",
    ),
    PaletteDirection(
        id="ocean-ice",
        name="Ocean & ice",
        families=("ocean", "ice", "metal"),
        description="Teals, blues and frost with silver highlights; cool and calm",
    ),
    PaletteDirection(
        id="earth-botanical",
        name="Earth & botanical",
        families=("earth", "forest", "pastel"),
        description="Ochre, moss, sepia and sage; natural, organic and grounded",
    ),
    PaletteDirection(
        id="metal-mono",
        name="Metal & mono",
        families=("metal", "mono", "ice"),
        description="Chrome, silver, graphite and black; industrial and sculptural",
    ),
    PaletteDirection(
        id="pastel-dream",
        name="Pastel dream",
        families=("pastel", "candy", "ice"),
        description="Soft pinks, lilac, pearl and mint; gentle and dreamy",
    ),
    PaletteDirection(
        id="royal-jewel",
        name="Royal jewel",
        families=("royal", "spectral", "metal"),
        description="Deep violet, indigo and gold; rich, ornate and precious",
    ),
)

PALETTES_BY_ID: dict[str, PaletteDirection] = {p.id: p for p in PALETTES}
