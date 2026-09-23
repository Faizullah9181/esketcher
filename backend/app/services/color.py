"""Colour vocabulary: turns palette hex codes into words Jev can reason about."""

import colorsys

# hue wheel names, start degree → name
_HUES = [
    (0, "red"),
    (15, "vermilion"),
    (30, "orange"),
    (45, "amber"),
    (55, "yellow"),
    (70, "lime"),
    (95, "green"),
    (150, "teal"),
    (175, "cyan"),
    (195, "azure"),
    (215, "blue"),
    (245, "indigo"),
    (265, "violet"),
    (290, "magenta"),
    (320, "pink"),
    (345, "red"),
]


def hsl(hex_color: str) -> tuple[float, float, float]:
    """Hex → (hue degrees, saturation 0..1, lightness 0..1)."""
    value = hex_color.lstrip("#")
    r, g, b = (int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))
    h, lightness, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, s, lightness


def is_neutral(hex_color: str) -> bool:
    _, s, lightness = hsl(hex_color)
    return s < 0.18 or lightness < 0.1 or lightness > 0.92


def hue_name(hex_color: str) -> str:
    h, s, lightness = hsl(hex_color)
    if s < 0.18 or lightness < 0.1 or lightness > 0.92:
        if lightness < 0.18:
            return "black"
        return "white" if lightness > 0.85 else "grey"
    name = next(n for start, n in reversed(_HUES) if h >= start)
    if lightness < 0.25:
        return f"deep {name}"
    if lightness > 0.72:
        return f"pale {name}"
    return name


def temperature(palette: tuple[str, ...]) -> str:
    """warm / cool / neutral, judged from the chromatic colours in a palette."""
    chroma = [hsl(c)[0] for c in palette if not is_neutral(c)]
    if not chroma:
        return "neutral"
    warm = sum(1 for h in chroma if h < 75 or h >= 285)
    return "warm" if warm * 2 > len(chroma) else "cool" if warm * 2 < len(chroma) else "mixed"


def describe_palette(palette: tuple[str, ...]) -> str:
    names = list(dict.fromkeys(hue_name(c) for c in palette))
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} and {names[-1]}"


def hue_distance(a: str, b: str) -> float:
    d = abs(hsl(a)[0] - hsl(b)[0])
    return min(d, 360 - d)


def harmony(a: str, b: str) -> float:
    """+1 analogous, +0.7 complementary, +0.4 triadic, -0.6 clashing, 0 if either is neutral."""
    if is_neutral(a) or is_neutral(b):
        return 0.0
    d = hue_distance(a, b)
    if d <= 35:
        return 1.0
    if d >= 150:
        return 0.7
    if 105 <= d <= 135:
        return 0.4
    return -0.6
