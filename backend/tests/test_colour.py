import asyncio

import pytest

from app.catalog.materials import MATERIALS, MATERIALS_BY_ID
from app.catalog.palettes import PALETTES, PALETTES_BY_ID
from app.models.decision import DecisionRequest, JevHealth, PaletteRequest
from app.services import color
from app.services.jev import JevClient, MockJevProvider
from tests.conftest import decision_body


def test_hue_names_cover_the_wheel() -> None:
    assert color.hue_name("#ff0000") == "red"
    assert color.hue_name("#00a0ff") == "azure"
    assert color.hue_name("#101010") == "black"
    assert color.hue_name("#f5f5f5") == "white"
    assert color.hue_name("#808080") == "grey"
    assert color.hue_name("#330000") == "deep red"
    assert color.hue_name("#ffb3c6").startswith("pale")
    assert color.describe_palette(("#ff0000", "#ff0000", "#ff0000")) == "red"


def test_temperature() -> None:
    assert color.temperature(("#ff5a1f", "#ffb36b", "#6b1500")) == "warm"
    assert color.temperature(("#1f4fff", "#9db4ff", "#081a66")) == "cool"
    assert color.temperature(("#f2f2f2", "#ffffff", "#8a8a8a")) == "neutral"
    assert color.temperature(("#ff0000", "#0000ff", "#808080")) == "mixed"


@pytest.mark.parametrize(
    ("a", "b", "expected"),
    [
        ("#ff0000", "#ff4000", 1.0),
        ("#ff0000", "#00ffff", 0.7),
        ("#ff0000", "#00ff00", 0.4),
        ("#ff0000", "#ffff00", -0.6),
        ("#ff0000", "#808080", 0.0),
    ],
)
def test_harmony(a, b, expected) -> None:
    assert color.harmony(a, b) == expected


def test_every_palette_is_reachable() -> None:
    families = {m.color_family for m in MATERIALS}
    for palette in PALETTES:
        assert set(palette.families) <= families
        assert any(m.color_family in palette.families for m in MATERIALS)


def _palette_request(sketch_id: str = "sk-091") -> PaletteRequest:
    body = decision_body(context={"sketchId": sketch_id})
    body["target"].update(kind="board", label="whole sketch", areaRatio=1)
    return PaletteRequest.model_validate({"target": body["target"], "context": body["context"]})


def test_mock_picks_a_palette_that_suits_the_subject() -> None:
    client = JevClient(MockJevProvider(0))
    machine = asyncio.run(client.decide_palette(_palette_request("sk-061")))  # mechanical
    assert machine.palette in PALETTES_BY_ID
    assert sum(machine.probabilities.values()) == pytest.approx(1, abs=0.01)
    assert machine.probabilities["metal-mono"] >= 0.2


def test_mock_follows_the_palette_and_harmonises() -> None:
    client = JevClient(MockJevProvider(0))
    candidates = [m.id for m in MATERIALS if m.type in ("liquid", "chrome")]
    body = decision_body(candidateMaterials=candidates[:16])
    plain = asyncio.run(client.decide(DecisionRequest.model_validate(body)))
    body["context"] = {"sketchId": "sk-091", "palette": "ocean-ice"}
    guided = asyncio.run(client.decide(DecisionRequest.model_validate(body)))
    ocean = [
        k
        for k in guided.probabilities
        if MATERIALS_BY_ID[k].color_family in PALETTES_BY_ID["ocean-ice"].families
    ]
    assert sum(guided.probabilities[k] for k in ocean) > sum(plain.probabilities[k] for k in ocean)
    body["context"] = {"sketchId": "sk-091", "neighborMaterialIds": ["deep-sea-gel", "lagoon-wash"]}
    harmonised = asyncio.run(client.decide(DecisionRequest.model_validate(body)))
    assert harmonised.probabilities != plain.probabilities


def test_palette_route_and_listing(client) -> None:
    listed = client.get("/api/materials/palettes").json()
    assert [p["id"] for p in listed] == [p.id for p in PALETTES]
    request = _palette_request().model_dump(by_alias=True)
    data = client.post("/api/jev/palette", json=request).json()
    assert data["palette"] in PALETTES_BY_ID
    assert set(data["probabilities"]) == set(PALETTES_BY_ID)
    assert data["provider"] == "mock"


def test_palette_context_is_validated_and_described(client) -> None:
    bad = client.post(
        "/api/jev/decide", json=decision_body(context={"sketchId": "sk-091", "palette": "no-such"})
    )
    assert bad.json()["detail"]["code"] == "bad_candidates"


def test_palette_errors_are_native(client_for) -> None:
    class Down:
        mode = "real"
        model = "jev-latest"

        async def ask(self, state, questions):
            return {"answers": {}}

        async def health(self) -> JevHealth:
            return JevHealth(mode="real", model="jev-latest", online=True)

        async def aclose(self) -> None:
            return None

    result = client_for(Down()).post(
        "/api/jev/palette", json=_palette_request().model_dump(by_alias=True)
    )
    assert result.status_code == 502
    assert result.json()["detail"]["code"] == "jev_malformed"

    class Empty(Down):
        async def ask(self, state, questions):
            return None

    assert (
        client_for(Empty())
        .post("/api/jev/palette", json=_palette_request().model_dump(by_alias=True))
        .status_code
        == 502
    )


def test_state_carries_the_palette_direction() -> None:
    from app.services.sketch_analyzer import build_state

    body = decision_body(context={"sketchId": "sk-091", "palette": "neon-night"})
    state = build_state(DecisionRequest.model_validate(body))
    assert state["canvas"]["paletteDirection"]["name"] == "Neon night"
