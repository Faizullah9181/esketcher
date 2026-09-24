from typing import Any

import pytest

from app.models.decision import JevHealth
from app.services.jev import JevQuotaError, JevUnavailableError
from tests.conftest import decision_body


class StubProvider:
    """Provider that returns a canned SystemOne response or raises."""

    mode = "real"
    model = "jev-latest"

    def __init__(self, response: Any = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[tuple[dict, dict]] = []

    async def ask(self, state, questions):
        self.calls.append((state, questions))
        if self.error:
            raise self.error
        return self.response

    async def health(self) -> JevHealth:
        return JevHealth(mode="real", model=self.model, online=True)

    async def aclose(self) -> None:
        return None


def test_decide_region_returns_full_distribution(client) -> None:
    response = client.post("/api/jev/decide", json=decision_body())
    assert response.status_code == 200
    data = response.json()
    candidates = decision_body()["candidateMaterials"]
    assert set(data["probabilities"]) == set(candidates)
    assert sum(data["probabilities"].values()) == pytest.approx(1, abs=0.01)
    assert data["selectedMaterial"] == data["ranking"][0]["materialId"]
    assert data["provider"] == "mock"
    assert data["certainty"] in {"confident", "leaning", "uncertain"}
    assert data["treatment"] is None


def test_decide_sketch_includes_treatment(client) -> None:
    data = client.post("/api/jev/decide", json=decision_body(scope="sketch")).json()
    assert data["treatment"]["mode"] in {"focal-accent", "full-flood", "duotone", "spectrum-mix"}
    assert sum(data["treatment"]["probabilities"].values()) == pytest.approx(1, abs=0.01)


def test_real_answer_is_normalised_and_ranked(client_for) -> None:
    provider = StubProvider(
        {
            "model": "jev-1.13.0",
            "answers": {
                "material": {
                    "type": "choice",
                    "choice": "watercolor",
                    "confidence": 0.41,
                    # missing ink-wash and an unknown key: both must be handled
                    "probabilities": {"watercolor": 0.5, "neon-liquid": 0.3, "chrome": 0.2, "x": 9},
                }
            },
            "usage": {"input_tokens": 486, "output_tokens": 93},
        }
    )
    body = decision_body(candidateMaterials=["neon-liquid", "ink-wash", "watercolor"])
    data = client_for(provider).post("/api/jev/decide", json=body).json()
    assert data["selectedMaterial"] == "watercolor"
    assert data["probabilities"] == {"neon-liquid": 0.375, "ink-wash": 0.0, "watercolor": 0.625}
    assert [r["materialId"] for r in data["ranking"]] == ["watercolor", "neon-liquid", "ink-wash"]
    assert data["certainty"] == "leaning"
    assert data["model"] == "jev-1.13.0"
    assert data["usage"] == {"inputTokens": 486, "outputTokens": 93}

    state, questions = provider.calls[0]
    assert state["target"]["kind"] == "iris"
    assert state["canvas"]["alreadyPainted"] == []  # "chrome" is not a catalog id
    criteria = questions["material"]["criteria"]
    assert set(criteria) == {"neon-liquid", "ink-wash", "watercolor"}
    assert criteria["neon-liquid"]["traits"]["behavior"] == "liquid"
    assert criteria["neon-liquid"]["traits"]["colours"]["temperature"] == "warm"
    assert "magenta" in criteria["neon-liquid"]["what"]
    assert "harmonise" in questions["material"]["instructions"]


@pytest.mark.parametrize(
    "response",
    [
        None,
        {"answers": "nope"},
        {"answers": {}},
        {"answers": {"material": {"type": "noul", "noul": 0.9}}},
        {"answers": {"material": {"type": "choice", "choice": "a"}}},
    ],
)
def test_malformed_answers_become_502(client_for, response) -> None:
    result = client_for(StubProvider(response)).post("/api/jev/decide", json=decision_body())
    assert result.status_code == 502
    assert result.json()["detail"]["code"] == "jev_malformed"


def test_sketch_scope_requires_treatment_answer(client_for) -> None:
    only_material = {
        "answers": {
            "material": {"type": "choice", "choice": "watercolor", "probabilities": {}},
        }
    }
    result = client_for(StubProvider(only_material)).post(
        "/api/jev/decide", json=decision_body(scope="sketch")
    )
    assert result.status_code == 502


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (JevUnavailableError("down"), 503, "jev_unavailable"),
        (JevQuotaError("broke"), 502, "jev_quota"),
    ],
)
def test_provider_errors_map_to_native_codes(client_for, error, status, code) -> None:
    result = client_for(StubProvider(error=error)).post("/api/jev/decide", json=decision_body())
    assert result.status_code == status
    assert result.json()["detail"] == {"code": code, "message": error.message}


@pytest.mark.parametrize(
    "overrides",
    [
        {"candidateMaterials": ["neon-liquid"]},
        {"candidateMaterials": ["neon-liquid", "neon-liquid"]},
        {"candidateMaterials": ["Neon Liquid", "ink-wash"]},
        {"scope": "planet"},
        {"target": {"kind": "Eye!", "label": "x"}},
    ],
)
def test_request_validation(client, overrides) -> None:
    assert client.post("/api/jev/decide", json=decision_body(**overrides)).status_code == 422


def test_unknown_candidate_is_rejected(client) -> None:
    body = decision_body(candidateMaterials=["neon-liquid", "not-a-paint"])
    result = client.post("/api/jev/decide", json=body)
    assert result.status_code == 422
    assert result.json()["detail"]["code"] == "bad_candidates"


def test_retry_excludes_rejected_and_tells_jev(client_for) -> None:
    provider = StubProvider(
        {"answers": {"material": {"type": "choice", "probabilities": {"watercolor": 1}}}}
    )
    body = decision_body(rejectedMaterialIds=["neon-liquid"], attempt=2)
    data = client_for(provider).post("/api/jev/retry", json=body).json()
    assert "neon-liquid" not in data["probabilities"]
    state, questions = provider.calls[0]
    assert "neon-liquid" not in questions["material"]["criteria"]
    assert state["canvas"]["rejectedByUser"] == ["Neon Liquid"]
    assert state["canvas"]["attempt"] == 2


def test_retry_with_sketch_scope(client) -> None:
    body = decision_body(scope="sketch", rejectedMaterialIds=["ink-wash"])
    assert client.post("/api/jev/retry", json=body).json()["treatment"] is not None


def test_retry_needs_two_remaining(client) -> None:
    body = decision_body(
        candidateMaterials=["neon-liquid", "ink-wash"], rejectedMaterialIds=["ink-wash"]
    )
    result = client.post("/api/jev/retry", json=body)
    assert result.status_code == 422
    assert result.json()["detail"]["code"] == "bad_candidates"


def test_rate_limit(client_for) -> None:
    client = client_for(jev_rate_limit_per_minute=2)
    for _ in range(2):
        assert client.post("/api/jev/decide", json=decision_body()).status_code == 200
    blocked = client.post("/api/jev/decide", json=decision_body())
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) >= 1


def test_daily_limit_per_client(client_for) -> None:
    client = client_for(jev_daily_limit_per_client=2)
    for _ in range(2):
        assert client.post("/api/jev/decide", json=decision_body()).status_code == 200
    blocked = client.post("/api/jev/decide", json=decision_body())
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "daily_limit"
    assert int(blocked.headers["retry-after"]) <= 86_401


def test_daily_budget_is_shared_by_every_client(client_for) -> None:
    client = client_for(jev_daily_budget=3)
    for _ in range(3):
        assert client.post("/api/jev/decide", json=decision_body()).status_code == 200
    blocked = client.post(
        "/api/jev/palette",
        json={"target": decision_body()["target"], "context": decision_body()["context"]},
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "jev_budget"


def test_blocked_clients_do_not_spend_the_budget(client_for) -> None:
    client = client_for(jev_rate_limit_per_minute=1, jev_daily_budget=5)
    assert client.post("/api/jev/decide", json=decision_body()).status_code == 200
    for _ in range(10):
        assert (
            client.post("/api/jev/decide", json=decision_body()).json()["detail"]["code"]
            == "rate_limited"
        )
    assert client.app.state.limits.jev_budget._counts == {"*": 1}
