# ruff: noqa: E501  (catalog rows read better one per line)
"""The material library.

Each row is a real visual recipe: the frontend paint engine renders a material from
`type` (animation behaviour), `palette`, `texture`, `roughness`, `intensity` and
`viscosity`. The same fields are what Jev reads when it chooses between candidates.
"""

import re

from app.models.material import Material

# name, type, texture, colorFamily, (base, highlight, shadow), intensity, roughness,
# viscosity, luminous, tags
# fmt: off
_ROWS: list[tuple] = [
    # liquid: flows in as an expanding blob
    ("Neon Liquid", "liquid", "glossy", "neon", ("#ff2bd6", "#ffa6f2", "#5c0460"), 0.95, 0.10, 0.25, True, ("fluid", "luminous", "pop")),
    ("Electric Blue Gel", "liquid", "glossy", "neon", ("#2463ff", "#8fd8ff", "#081a5c"), 0.88, 0.08, 0.62, True, ("gel", "cool", "electric")),
    ("Iridescent Fluid", "liquid", "glossy", "spectral", ("#6fe9ff", "#f7a6ff", "#35287f"), 0.80, 0.12, 0.30, True, ("shifting", "pearlescent")),
    ("Liquid Rainbow", "liquid", "glossy", "spectral", ("#ff5252", "#ffe45c", "#3fb8ff"), 0.92, 0.10, 0.35, False, ("rainbow", "playful")),
    ("Toxic Slime", "liquid", "glossy", "toxic", ("#9dff00", "#eaff85", "#2a5200"), 0.90, 0.18, 0.85, True, ("slime", "gross", "radioactive")),
    ("Candy Paint", "liquid", "glossy", "candy", ("#ff3d7f", "#ffc0d6", "#7a002d"), 0.85, 0.05, 0.50, False, ("sweet", "automotive")),
    ("Blood Orange Syrup", "liquid", "glossy", "fire", ("#ff5a1f", "#ffb36b", "#6b1500"), 0.82, 0.08, 0.78, False, ("syrup", "warm")),
    ("Deep Sea Gel", "liquid", "glossy", "ocean", ("#0f6c7a", "#5ff2e0", "#021f2a"), 0.70, 0.10, 0.66, True, ("bioluminescent", "abyss")),
    ("Honey Resin", "liquid", "glossy", "earth", ("#e3a21a", "#ffe08a", "#6b3f00"), 0.72, 0.12, 0.92, False, ("amber", "viscous", "warm")),
    ("Bubblegum Gloss", "liquid", "glossy", "candy", ("#ff8ad8", "#ffe0f5", "#a3286f"), 0.78, 0.06, 0.55, False, ("sweet", "soft")),
    # spray: particles scatter and settle
    ("Spray Paint", "spray", "grainy", "mono", ("#f2f2f2", "#ffffff", "#8a8a8a"), 0.70, 0.55, 0.10, False, ("street", "aerosol")),
    ("Neon Tag", "spray", "grainy", "neon", ("#39ff14", "#caff9e", "#0b5c00"), 0.95, 0.50, 0.10, True, ("graffiti", "luminous")),
    ("Stencil Red", "spray", "grainy", "fire", ("#e8152b", "#ff7a86", "#5c0010"), 0.85, 0.45, 0.10, False, ("stencil", "poster")),
    ("Airbrush Peach", "spray", "grainy", "pastel", ("#ffb38a", "#ffe2d1", "#b3593a"), 0.55, 0.30, 0.10, False, ("airbrush", "soft", "retro")),
    ("Graffiti Lime", "spray", "grainy", "toxic", ("#c6f000", "#f2ff9e", "#4a5c00"), 0.88, 0.55, 0.10, False, ("graffiti", "acid")),
    ("Cobalt Mist", "spray", "grainy", "ocean", ("#1f4fff", "#9db4ff", "#081a66"), 0.72, 0.35, 0.10, False, ("mist", "cool")),
    ("Dust Storm", "spray", "granular", "earth", ("#c28a4a", "#f0cc99", "#5c3a14"), 0.60, 0.80, 0.10, False, ("desert", "gritty")),
    ("Midnight Aerosol", "spray", "grainy", "royal", ("#3b1f8f", "#8a6bff", "#12063d"), 0.70, 0.45, 0.10, False, ("night", "deep")),
    ("Coral Burst", "spray", "grainy", "candy", ("#ff6f61", "#ffc2bb", "#8f231a"), 0.80, 0.40, 0.10, False, ("burst", "tropical")),
    # watercolor: soft translucent blooms
    ("Watercolor", "watercolor", "fibrous", "ocean", ("#3aa0d8", "#bfe6ff", "#1a4f7a"), 0.45, 0.35, 0.05, False, ("soft", "translucent", "classic")),
    ("Indigo Wash", "watercolor", "fibrous", "royal", ("#3b3fa8", "#a8abff", "#15175c"), 0.50, 0.35, 0.05, False, ("wash", "moody")),
    ("Rose Bloom", "watercolor", "fibrous", "pastel", ("#f06292", "#ffd1e0", "#8a2250"), 0.48, 0.30, 0.05, False, ("bloom", "romantic")),
    ("Sage Wash", "watercolor", "fibrous", "forest", ("#7fa37a", "#d8ebd2", "#3a5c36"), 0.40, 0.30, 0.05, False, ("botanical", "calm")),
    ("Sunset Glaze", "watercolor", "fibrous", "fire", ("#ff8a3d", "#ffd28a", "#a1284a"), 0.55, 0.30, 0.05, False, ("gradient", "warm")),
    ("Lagoon Wash", "watercolor", "fibrous", "ocean", ("#1fb8a8", "#b0fff4", "#0a5c54"), 0.45, 0.28, 0.05, False, ("tropical", "clear")),
    ("Plum Veil", "watercolor", "fibrous", "royal", ("#8e3a8a", "#e6b3e3", "#3d0f3b"), 0.46, 0.32, 0.05, False, ("veil", "dusk")),
    ("Tea Stain", "watercolor", "fibrous", "earth", ("#a8743a", "#e8cfa4", "#5c3a14"), 0.35, 0.40, 0.05, False, ("antique", "stain")),
    ("Moss Bloom", "watercolor", "fibrous", "forest", ("#5a8a2a", "#c7e89e", "#243d0a"), 0.44, 0.38, 0.05, False, ("moss", "organic")),
    # ink: fast branching bleed
    ("Neon Ink", "ink", "matte", "neon", ("#00f0ff", "#b3fbff", "#003d4a"), 0.92, 0.25, 0.15, True, ("luminous", "sharp")),
    ("Ink Wash", "ink", "matte", "mono", ("#26262b", "#6b6b75", "#08080a"), 0.60, 0.30, 0.15, False, ("sumi", "classic")),
    ("Ink Bleed", "ink", "fibrous", "mono", ("#1c1f3a", "#525a99", "#05060f"), 0.65, 0.45, 0.20, False, ("bleed", "organic")),
    ("Ultraviolet Ink", "ink", "matte", "neon", ("#8f00ff", "#d9a6ff", "#2a004d"), 0.94, 0.25, 0.15, True, ("uv", "blacklight")),
    ("Sumi Black", "ink", "matte", "mono", ("#111114", "#3d3d45", "#000000"), 0.75, 0.20, 0.18, False, ("calligraphy", "bold")),
    ("Crimson Ink", "ink", "matte", "fire", ("#c2102a", "#ff6b80", "#4d0010"), 0.80, 0.28, 0.16, False, ("dramatic", "red")),
    ("Marker Teal", "ink", "matte", "ocean", ("#0f9b8e", "#7af0e2", "#034a43"), 0.70, 0.15, 0.10, False, ("marker", "flat")),
    ("Sepia Ink", "ink", "matte", "earth", ("#704214", "#c49a6c", "#2e1a06"), 0.55, 0.30, 0.18, False, ("vintage", "archive")),
    ("Laser Paint", "ink", "glossy", "neon", ("#ff1744", "#ff9eae", "#5c0012"), 1.00, 0.05, 0.05, True, ("laser", "beam", "sharp")),
    # chrome: reflective moving highlight
    ("Liquid Chrome", "chrome", "glossy", "metal", ("#c9ced6", "#ffffff", "#3a3f47"), 0.85, 0.05, 0.40, False, ("reflective", "futuristic")),
    ("Gold Leaf", "chrome", "faceted", "metal", ("#d4a017", "#fff2a8", "#6b4a00"), 0.80, 0.35, 0.20, False, ("gilded", "sacred", "luxury")),
    ("Silver Leaf", "chrome", "faceted", "metal", ("#b8bcc4", "#f5f7fa", "#55595f"), 0.72, 0.35, 0.20, False, ("gilded", "cool")),
    ("Rose Gold", "chrome", "glossy", "metal", ("#e0a18a", "#ffe3d6", "#7a4232"), 0.75, 0.10, 0.30, False, ("luxury", "warm")),
    ("Gunmetal", "chrome", "glossy", "metal", ("#4a5058", "#9aa3ad", "#16191d"), 0.60, 0.15, 0.40, False, ("industrial", "dark")),
    ("Bronze Patina", "chrome", "faceted", "earth", ("#8a6a3a", "#5fbf9f", "#3a2a12"), 0.55, 0.55, 0.30, False, ("aged", "statue")),
    ("Anodized Titanium", "chrome", "glossy", "spectral", ("#5a6bd8", "#f0b3ff", "#1f2a66"), 0.78, 0.10, 0.35, False, ("anodized", "heat-tint")),
    ("Copper Foil", "chrome", "faceted", "fire", ("#c26a2a", "#ffc08a", "#5c2a08"), 0.74, 0.30, 0.25, False, ("foil", "warm")),
    ("Black Chrome", "chrome", "glossy", "mono", ("#1f2126", "#8a8f99", "#050608"), 0.70, 0.05, 0.40, False, ("stealth", "luxury")),
    ("Mercury", "chrome", "glossy", "metal", ("#aeb4bd", "#ffffff", "#2e3238"), 0.90, 0.02, 0.10, False, ("liquid-metal", "toxic")),
    # pixel: grid fragments assemble
    ("Pixel Noise", "pixel", "noisy", "spectral", ("#ff3df2", "#3dfff5", "#1a1a40"), 0.85, 0.70, 0.00, True, ("digital", "8-bit")),
    ("Pixel Dust", "pixel", "noisy", "pastel", ("#b3a6ff", "#fff0a6", "#4a3d8f"), 0.60, 0.60, 0.00, False, ("soft-digital", "dust")),
    ("Digital Glitch", "pixel", "noisy", "neon", ("#00ff9c", "#ff00c8", "#0a0a14"), 0.95, 0.85, 0.00, True, ("glitch", "error", "rgb-split")),
    ("Thermal Noise", "pixel", "noisy", "fire", ("#ff4d00", "#ffe600", "#2a00a8"), 0.90, 0.75, 0.00, True, ("thermal", "infrared")),
    ("CRT Phosphor", "pixel", "noisy", "toxic", ("#33ff66", "#b3ffc6", "#003d12"), 0.85, 0.50, 0.00, True, ("retro", "terminal")),
    ("Datamosh", "pixel", "noisy", "spectral", ("#7a3dff", "#3dffd8", "#ff3d6e"), 0.88, 0.90, 0.00, True, ("compression", "chaos")),
    ("Bitmap Moss", "pixel", "noisy", "forest", ("#3d8f2a", "#a6ff8a", "#0f2a0a"), 0.65, 0.65, 0.00, False, ("organic-digital",)),
    ("Vapor Grid", "pixel", "noisy", "candy", ("#ff71ce", "#01cdfe", "#241734"), 0.80, 0.40, 0.00, True, ("vaporwave", "retro")),
    ("Signal Loss", "pixel", "noisy", "mono", ("#d9d9d9", "#ffffff", "#262626"), 0.65, 0.95, 0.00, False, ("static", "broken")),
    # smoke: slow diffusing particles
    ("Smoke", "smoke", "velvety", "mono", ("#9a9aa3", "#e6e6eb", "#2e2e33"), 0.40, 0.40, 0.05, False, ("atmospheric", "soft")),
    ("Vapor", "smoke", "velvety", "pastel", ("#c8d8ff", "#ffffff", "#6b7aa8"), 0.35, 0.30, 0.02, False, ("breath", "light")),
    ("Incense", "smoke", "velvety", "earth", ("#b39a7a", "#efe2cf", "#4d3d2a"), 0.40, 0.45, 0.05, False, ("ritual", "warm")),
    ("Nebula Smoke", "smoke", "velvety", "spectral", ("#9b3dff", "#ff8ad8", "#1a0a3d"), 0.75, 0.40, 0.05, True, ("cosmic", "nebula")),
    ("Morning Fog", "smoke", "velvety", "ice", ("#a8c4d4", "#f0faff", "#4a6475"), 0.30, 0.30, 0.02, False, ("fog", "quiet")),
    ("Volcanic Ash", "smoke", "granular", "mono", ("#5a5552", "#a39e99", "#1a1817"), 0.45, 0.75, 0.10, False, ("ash", "heavy")),
    ("Dragon Breath", "smoke", "velvety", "fire", ("#ff6a00", "#ffd000", "#5c0a00"), 0.85, 0.40, 0.05, True, ("fire", "myth")),
    ("Ghost Mist", "smoke", "velvety", "ice", ("#d8fff5", "#ffffff", "#5c8a80"), 0.40, 0.25, 0.02, True, ("ghostly", "pale")),
    ("Teal Haze", "smoke", "velvety", "ocean", ("#1fa3a3", "#9ef5f0", "#073d3d"), 0.50, 0.35, 0.03, False, ("haze", "cool")),
    # glitter: particles orbit and settle
    ("Cosmic Dust", "glitter", "granular", "spectral", ("#6b5bff", "#ffe98a", "#140a3d"), 0.80, 0.60, 0.00, True, ("space", "stars")),
    ("Metallic Powder", "glitter", "granular", "metal", ("#c0c4cc", "#ffffff", "#4a4d52"), 0.70, 0.65, 0.00, False, ("powder", "industrial")),
    ("Magnetic Particles", "glitter", "granular", "mono", ("#2a2d33", "#9aa3ad", "#000000"), 0.65, 0.70, 0.00, False, ("magnetic", "ferrofluid")),
    ("Stardust", "glitter", "granular", "pastel", ("#fff6c9", "#ffffff", "#a89a5c"), 0.75, 0.50, 0.00, True, ("dreamy", "stars")),
    ("Gold Glitter", "glitter", "granular", "metal", ("#e6b422", "#fff6b3", "#7a5a00"), 0.85, 0.55, 0.00, True, ("party", "luxury")),
    ("Pollen Drift", "glitter", "granular", "forest", ("#e6d23d", "#fff9b3", "#6b5c0a"), 0.55, 0.50, 0.00, False, ("spring", "organic")),
    ("Firefly Swarm", "glitter", "granular", "toxic", ("#d4ff3d", "#ffffb3", "#2a3d00"), 0.80, 0.40, 0.00, True, ("night", "alive")),
    ("Sequin Rose", "glitter", "faceted", "candy", ("#ff4d8f", "#ffd6e6", "#6b0a33"), 0.82, 0.45, 0.00, True, ("sequins", "stage")),
    ("Meteor Shower", "glitter", "granular", "fire", ("#ff8a3d", "#fff0c2", "#3d0a00"), 0.90, 0.55, 0.00, True, ("streaks", "cosmic")),
    # lava: slow viscous movement
    ("Lava", "lava", "glossy", "fire", ("#ff3d00", "#ffc400", "#3d0000"), 0.95, 0.40, 0.95, True, ("molten", "hot")),
    ("Molten Metal", "lava", "glossy", "metal", ("#ff9a3d", "#fff2c2", "#5c2a0a"), 0.92, 0.20, 0.90, True, ("foundry", "hot")),
    ("Magma Core", "lava", "glossy", "fire", ("#d4000f", "#ff8a00", "#1a0000"), 0.90, 0.50, 1.00, True, ("core", "deep")),
    ("Basalt Flow", "lava", "granular", "mono", ("#3d3a38", "#ff5a1f", "#0f0e0d"), 0.70, 0.70, 0.95, True, ("cooling", "crust")),
    ("Solar Flare", "lava", "glossy", "fire", ("#ffb300", "#fff7c2", "#a12a00"), 1.00, 0.30, 0.80, True, ("sun", "blinding")),
    ("Ember Glaze", "lava", "glossy", "fire", ("#b3290f", "#ff9a5c", "#2a0800"), 0.75, 0.35, 0.85, True, ("ember", "glow")),
    ("Obsidian Melt", "lava", "glossy", "royal", ("#2a0f3d", "#b35aff", "#050008"), 0.70, 0.15, 0.90, True, ("volcanic-glass", "dark")),
    ("Cinnabar Flow", "lava", "glossy", "fire", ("#e34234", "#ffab91", "#5c0f08"), 0.80, 0.30, 0.88, False, ("mineral", "red")),
    # holographic: moving spectrum surface
    ("Holographic Foil", "holographic", "glossy", "spectral", ("#a6f0ff", "#ffb3f5", "#b3ffcc"), 0.90, 0.05, 0.10, True, ("foil", "shifting", "futuristic")),
    ("Oil Slick", "holographic", "glossy", "spectral", ("#2a3d66", "#d98aff", "#3dffb3"), 0.75, 0.05, 0.60, False, ("slick", "petroleum")),
    ("Prism Film", "holographic", "glossy", "spectral", ("#ff5c5c", "#5cffe1", "#ffe15c"), 0.85, 0.05, 0.05, True, ("prism", "refraction")),
    ("Pearl Shift", "holographic", "glossy", "pastel", ("#f5ecff", "#d6fff5", "#ffe0f0"), 0.55, 0.10, 0.20, False, ("pearl", "soft")),
    ("Aurora", "holographic", "velvety", "spectral", ("#3dff9a", "#9a3dff", "#0a1a3d"), 0.85, 0.20, 0.10, True, ("aurora", "sky")),
    ("Beetle Shell", "holographic", "glossy", "forest", ("#1f8f5a", "#5ae0ff", "#0a2a1f"), 0.78, 0.10, 0.20, False, ("iridescent", "insect")),
    ("Soap Film", "holographic", "glossy", "pastel", ("#ffd6f5", "#d6fbff", "#fff9d6"), 0.50, 0.05, 0.05, False, ("bubble", "fragile")),
    ("Opal", "holographic", "faceted", "ice", ("#e0f7ff", "#ffb3e6", "#b3ffe0"), 0.65, 0.20, 0.20, False, ("gem", "milky")),
    ("Chromatic Aberration", "holographic", "noisy", "neon", ("#ff0040", "#00e5ff", "#1a1a1a"), 0.90, 0.30, 0.05, True, ("lens", "glitch")),
    # grain: dry media, textiles
    ("Charcoal", "grain", "grainy", "mono", ("#2b2b2b", "#6e6e6e", "#0a0a0a"), 0.55, 0.85, 0.30, False, ("drawing", "smudge")),
    ("Graphite", "grain", "grainy", "mono", ("#5a5d63", "#a3a8b0", "#26282b"), 0.45, 0.65, 0.20, False, ("pencil", "metallic-sheen")),
    ("Chalk", "grain", "granular", "pastel", ("#f2efe6", "#ffffff", "#a8a49a"), 0.50, 0.90, 0.10, False, ("board", "dusty")),
    ("Soft Pastel", "grain", "granular", "pastel", ("#ffb3c6", "#fff0f5", "#b36b80"), 0.50, 0.80, 0.15, False, ("pastel", "tender")),
    ("Dry Brush", "grain", "fibrous", "earth", ("#8a5a2b", "#d4a36b", "#3d2610"), 0.60, 0.90, 0.40, False, ("brush", "rough")),
    ("Crayon Wax", "grain", "grainy", "candy", ("#ff5a36", "#ffc2b3", "#8f2410"), 0.70, 0.80, 0.50, False, ("childlike", "waxy")),
    ("Conte Sanguine", "grain", "grainy", "earth", ("#a8432a", "#e89a80", "#4d1a0f"), 0.55, 0.75, 0.25, False, ("renaissance", "study")),
    ("Sandstone", "grain", "granular", "earth", ("#d4a373", "#faedcd", "#7a5230"), 0.45, 0.95, 0.20, False, ("mineral", "desert")),
    ("Blueprint Pencil", "grain", "grainy", "ocean", ("#2a6bd8", "#a6c8ff", "#0a2a66"), 0.55, 0.60, 0.15, False, ("technical", "draft")),
    ("Paper Texture", "grain", "fibrous", "earth", ("#e8dcc4", "#fffaf0", "#a89878"), 0.25, 0.70, 0.10, False, ("paper", "subtle")),
    ("Velvet", "grain", "velvety", "royal", ("#6b0f3d", "#c2477f", "#1f0010"), 0.65, 0.35, 0.60, False, ("textile", "plush", "luxury")),
    ("Fabric Texture", "grain", "woven", "ocean", ("#3d5a80", "#98c1d9", "#1a2a3d"), 0.50, 0.60, 0.40, False, ("textile", "denim")),
    # crystal: faceted shards lock into place
    ("Glass", "crystal", "faceted", "ice", ("#bfe9ff", "#ffffff", "#5c8aa3"), 0.50, 0.05, 0.10, False, ("clear", "fragile")),
    ("Frost", "crystal", "faceted", "ice", ("#dff6ff", "#ffffff", "#7aa8c2"), 0.55, 0.60, 0.05, False, ("cold", "winter")),
    ("Crystalline Texture", "crystal", "faceted", "spectral", ("#b3a6ff", "#e6fffa", "#4d3d99"), 0.70, 0.30, 0.05, True, ("geometric", "mineral")),
    ("Ice Shard", "crystal", "faceted", "ice", ("#7ad8ff", "#e6f9ff", "#1f5c80"), 0.65, 0.40, 0.05, False, ("sharp", "cold")),
    ("Amethyst Geode", "crystal", "faceted", "royal", ("#9b59d0", "#e6c7ff", "#3d1a5c"), 0.70, 0.45, 0.05, False, ("gem", "geode")),
    ("Sea Glass", "crystal", "faceted", "ocean", ("#7fd1b9", "#dcfff3", "#2e6b5a"), 0.45, 0.50, 0.05, False, ("beach", "frosted")),
    ("Quartz", "crystal", "faceted", "pastel", ("#f7e1ea", "#ffffff", "#a88a96"), 0.45, 0.30, 0.05, False, ("mineral", "rose")),
    ("Stained Glass", "crystal", "faceted", "spectral", ("#d81b60", "#ffd54f", "#1e88e5"), 0.85, 0.20, 0.05, True, ("cathedral", "bold")),
    ("Diamond Dust", "crystal", "faceted", "metal", ("#f0f4ff", "#ffffff", "#8a93a8"), 0.80, 0.35, 0.00, True, ("sparkle", "luxury")),
    # impasto: thick brushed strokes sweep across
    ("Oil Paint", "impasto", "fibrous", "earth", ("#b5562b", "#f2b279", "#4d1f0a"), 0.70, 0.60, 0.80, False, ("classic", "thick", "painterly")),
    ("Acrylic Pop", "impasto", "matte", "candy", ("#ff3d3d", "#ffd23d", "#3d5aff"), 0.85, 0.40, 0.60, False, ("pop-art", "bold")),
    ("Gouache Flat", "impasto", "matte", "pastel", ("#6bb3a8", "#f2d8a6", "#2a5c55"), 0.55, 0.30, 0.55, False, ("flat", "illustration")),
    ("Palette Knife", "impasto", "fibrous", "royal", ("#2a3d99", "#ffd166", "#0a1240"), 0.75, 0.75, 0.90, False, ("knife", "sculpted")),
    ("Encaustic Wax", "impasto", "velvety", "earth", ("#d9a441", "#fff0c2", "#6b4a10"), 0.60, 0.50, 0.95, False, ("wax", "layered")),
    ("Egg Tempera", "impasto", "matte", "earth", ("#c29a5c", "#f5e3c2", "#5c4020"), 0.50, 0.45, 0.50, False, ("icon", "medieval")),
    ("Fresco Plaster", "impasto", "granular", "pastel", ("#e0b8a0", "#fff3e6", "#8f6450"), 0.40, 0.80, 0.70, False, ("wall", "ancient")),
    ("Paper Cut", "impasto", "matte", "candy", ("#ff6b6b", "#ffe66d", "#4ecdc4"), 0.80, 0.10, 0.00, False, ("collage", "layered", "flat")),
    ("Poster Paint", "impasto", "matte", "neon", ("#ff2e63", "#08d9d6", "#252a34"), 0.90, 0.35, 0.50, False, ("poster", "loud")),
]
# fmt: on


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _build() -> tuple[Material, ...]:
    materials = []
    for name, kind, texture, family, palette, intensity, rough, visc, lum, tags in _ROWS:
        materials.append(
            Material(
                id=_slug(name),
                name=name,
                type=kind,
                texture=texture,
                color_family=family,
                palette=palette,
                intensity=intensity,
                roughness=rough,
                viscosity=visc,
                luminous=lum,
                tags=tags,
            )
        )
    return tuple(materials)


MATERIALS: tuple[Material, ...] = _build()
MATERIALS_BY_ID: dict[str, Material] = {m.id: m for m in MATERIALS}
