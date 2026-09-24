import json
import logging

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.logging_config import JsonFormatter, configure_logging
from app.models.decision import DecisionRequest
from app.rate_limit import DAY, DailyQuota, RateLimiter
from app.services import paint_selector
from app.services.jev import build_provider
from app.services.sketch_analyzer import build_state, describe_level
from tests.conftest import decision_body


def test_normalize_handles_gaps_negatives_and_empty() -> None:
    assert paint_selector.normalize({"a": 2, "b": -1}, ["a", "b", "c"]) == {
        "a": 1.0,
        "b": 0.0,
        "c": 0.0,
    }
    assert paint_selector.normalize({}, ["a", "b"]) == {"a": 0.5, "b": 0.5}


def test_rank_breaks_ties_by_id() -> None:
    ranked = paint_selector.rank({"b": 0.5, "a": 0.5, "c": 0.0})
    assert [r.material_id for r in ranked] == ["a", "b", "c"]
    assert [r.rank for r in ranked] == [1, 2, 3]


@pytest.mark.parametrize(
    ("confidence", "band"),
    [(0.9, "confident"), (0.55, "confident"), (0.4, "leaning"), (0.1, "uncertain")],
)
def test_certainty_bands(confidence, band) -> None:
    assert paint_selector.certainty(confidence) == band


def test_describe_level_edges() -> None:
    words = ("a", "b", "c", "d")
    assert describe_level(0, words) == "a"
    assert describe_level(0.5, words) == "c"
    assert describe_level(1, words) == "d"


def test_state_for_unknown_sketch_is_freeform() -> None:
    body = decision_body(context={"sketchId": "custom-1"})
    body["target"].pop("dominantColor")
    state = build_state(DecisionRequest.model_validate(body))
    assert state["sketch"]["category"] == "freeform"
    assert "dominantColor" not in state["target"]


def test_state_names_painted_neighbours() -> None:
    body = decision_body(context={"sketchId": "sk-001", "neighborMaterialIds": ["gold-leaf"]})
    state = build_state(DecisionRequest.model_validate(body))
    assert state["canvas"]["alreadyPainted"] == [
        {"name": "Gold Leaf", "hues": "orange, pale amber and deep orange", "temperature": "warm"}
    ]
    assert state["target"]["dominantColor"] == "#aabbcc"


def test_rate_limiter_window() -> None:
    now = [0.0]
    limiter = RateLimiter(2, clock=lambda: now[0])
    assert limiter.check("ip") is None
    assert limiter.check("ip") is None
    assert limiter.check("ip") == 60
    now[0] = 61
    assert limiter.check("ip") is None


def test_rate_limiter_bounds_memory() -> None:
    limiter = RateLimiter(1)
    limiter.max_keys = 2
    for key in ("a", "b", "c"):
        limiter.check(key)
    assert len(limiter._hits) == 1


def test_rate_limiter_custom_window_and_disabled() -> None:
    now = [0.0]
    limiter = RateLimiter(1, window=10, clock=lambda: now[0])
    assert limiter.check("ip") is None
    assert limiter.check("ip") == 10
    assert limiter.check("other") is None  # keys are independent
    now[0] = 10
    assert limiter.check("ip") is None
    off = RateLimiter(0)
    assert all(off.check("ip") is None for _ in range(100))


def test_daily_quota_resets_at_midnight_utc() -> None:
    now = [DAY * 5 + 3600.0]  # 01:00 UTC
    quota = DailyQuota(2, clock=lambda: now[0])
    assert quota.check("ip") is None
    assert quota.check("ip") is None
    assert quota.check("ip") == DAY - 3600
    assert quota.check("other") is None
    now[0] = DAY * 6  # midnight
    assert quota.check("ip") is None
    assert all(DailyQuota(0).check("ip") is None for _ in range(100))


def test_daily_quota_refuses_new_keys_when_full() -> None:
    quota = DailyQuota(5, clock=lambda: 100.0)
    quota.max_keys = 2
    assert quota.check("a") is None
    assert quota.check("b") is None
    assert quota.check("c") is not None  # no room: refused, not a reset for everyone
    assert quota.check("a") is None


def test_real_mode_requires_key() -> None:
    with pytest.raises(ValidationError, match="TYPESAFE_API_KEY"):
        Settings(_env_file=None, jev_mode="real")


def test_settings_helpers() -> None:
    settings = Settings(_env_file=None, cors_origins="http://a, http://b,", env="production")
    assert settings.cors_origin_list == ["http://a", "http://b"]
    assert not settings.docs_enabled


def test_build_provider_modes() -> None:
    assert build_provider(Settings(_env_file=None)).mode == "mock"
    real = build_provider(Settings(_env_file=None, jev_mode="real", typesafe_api_key="k"))
    assert real.mode == "real"


def test_json_formatter_includes_extra_fields() -> None:
    record = logging.LogRecord("x", logging.INFO, "", 0, "hello %s", ("world",), None)
    record.decision_id = "abc"
    payload = json.loads(JsonFormatter().format(record))
    assert payload["event"] == "hello world"
    assert payload["decision_id"] == "abc"


def test_json_formatter_includes_exceptions() -> None:
    try:
        raise RuntimeError("boom")
    except RuntimeError:
        import sys

        record = logging.LogRecord("x", logging.ERROR, "", 0, "failed", (), sys.exc_info())
    assert "boom" in json.loads(JsonFormatter().format(record))["exc"]


def test_configure_logging_installs_json_handler() -> None:
    configure_logging()
    assert isinstance(logging.getLogger().handlers[0].formatter, JsonFormatter)
