import asyncio
from collections import Counter

import pytest

from app.catalog.materials import MATERIALS
from app.catalog.sketches import SKETCHES
from app.models.decision import DecisionRequest
from app.services.jev import JevClient, MockJevProvider
from tests.conftest import decision_body


def _request(**overrides) -> DecisionRequest:
    return DecisionRequest.model_validate(decision_body(**overrides))


def _decide(request: DecisionRequest, latency: int = 0):
    return asyncio.run(JevClient(MockJevProvider(latency)).decide(request))


def test_mock_is_deterministic() -> None:
    first, second = _decide(_request()), _decide(_request())
    assert first.probabilities == second.probabilities
    assert first.decision_id != second.decision_id


def test_mock_latency_is_simulated() -> None:
    assert _decide(_request(), latency=20).latency_ms >= 10


def test_mock_distributions_look_real() -> None:
    """Across many sketches the mock must not always pick the first candidate, and
    must produce all three certainty bands."""
    candidates = [m.id for m in MATERIALS[::11]][:10]
    winners, bands = Counter(), Counter()
    for sketch in SKETCHES[:60]:
        body = decision_body(
            candidateMaterials=candidates,
            context={"sketchId": sketch.id, "chaos": sketch.seed % 5 == 0},
        )
        body["target"]["kind"] = sketch.category.rstrip("s")
        body["target"]["complexity"] = sketch.complexity
        decision = _decide(DecisionRequest.model_validate(body))
        assert sum(decision.probabilities.values()) == pytest.approx(1, abs=0.01)
        winners[decision.selected_material] += 1
        bands[decision.certainty] += 1
    assert len(winners) >= 4
    assert winners[candidates[0]] < 30
    assert set(bands) == {"confident", "leaning", "uncertain"}


def test_mock_avoids_already_painted_neighbours() -> None:
    base = _decide(_request())
    top = base.selected_material
    context = {"sketchId": "sk-091", "neighborMaterialIds": [top]}
    penalised = _decide(_request(context=context))
    assert penalised.probabilities[top] < base.probabilities[top]


def test_mock_health() -> None:
    health = asyncio.run(MockJevProvider().health())
    assert health.online and health.mode == "mock"


def test_rank_paint_candidates_orders_by_probability() -> None:
    ranking = asyncio.run(JevClient(MockJevProvider(0)).rank_paint_candidates(_request()))
    probabilities = [r.probability for r in ranking]
    assert probabilities == sorted(probabilities, reverse=True)
    assert len(ranking) == len(decision_body()["candidateMaterials"])


def test_mock_confidence_uses_typesafes_documented_formula() -> None:
    from app.services.jev import _confidence

    assert _confidence({"a": 0.56, "b": 0.21, "c": 0.16, "d": 0.07}) == 0.41
    assert _confidence({"a": 0.91, "b": 0.09}) == 0.82
    assert _confidence({"a": 0.25, "b": 0.25, "c": 0.25, "d": 0.25}) == 0.0
    assert _confidence({"only": 1.0}) == 1.0
