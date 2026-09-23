"""Jev integration.

    JevProvider           talks to a model: ask(state, questions) -> raw SystemOne response
      ├── RealJevProvider   POST https://api.typesafe.ai/v1/systemone
      └── MockJevProvider   deterministic local stand-in with the same response shape
    JevClient             the app-facing API: decide_paint / rank_paint_candidates /
                          decide_sketch_treatment / get_health

Both providers return the exact SystemOne wire format, so JevClient runs the same
code in mock and real mode and the UI cannot tell them apart.
"""

import asyncio
import hashlib
import json
import logging
import math
import time
import uuid
from typing import Any, Protocol

import httpx
from pydantic import SecretStr

from app.catalog.materials import MATERIALS_BY_ID
from app.catalog.palettes import PALETTES, PALETTES_BY_ID
from app.config import Settings
from app.models.decision import (
    DecisionRequest,
    DecisionResponse,
    JevHealth,
    PaletteDecision,
    PaletteRequest,
    RankedMaterial,
    RetryRequest,
    TreatmentDecision,
    Usage,
)
from app.services import color, paint_selector
from app.services.sketch_analyzer import build_state

logger = logging.getLogger("esketcher.jev")


# ── Errors ──────────────────────────────────────────────────────────────────


class JevError(Exception):
    code = "jev_error"
    http_status = 502

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class JevUnavailableError(JevError):
    code = "jev_unavailable"
    http_status = 503


class JevTimeoutError(JevError):
    code = "jev_timeout"
    http_status = 504


class JevAuthError(JevError):
    code = "jev_auth"


class JevQuotaError(JevError):
    code = "jev_quota"


class JevMalformedError(JevError):
    code = "jev_malformed"


class CandidateError(ValueError):
    """The request's candidate set can't be decided over."""


# ── Providers ───────────────────────────────────────────────────────────────


class JevProvider(Protocol):
    mode: str
    model: str

    async def ask(self, state: dict[str, Any], questions: dict[str, Any]) -> dict[str, Any]: ...

    async def health(self) -> JevHealth: ...

    async def aclose(self) -> None: ...


class RealJevProvider:
    mode = "real"
    retries = 2
    health_ttl_seconds = 30.0

    def __init__(
        self,
        api_key: SecretStr,
        base_url: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key.get_secret_value()}"},
            timeout=timeout_seconds,
            transport=transport,
        )
        self._health: tuple[float, JevHealth] | None = None

    async def ask(self, state: dict[str, Any], questions: dict[str, Any]) -> dict[str, Any]:
        body = {"model": self.model, "state": state, "questions": questions}
        last_error: JevError = JevUnavailableError("Jev was not reached")
        for attempt in range(self.retries):
            if attempt:
                await asyncio.sleep(0.2 * attempt)
            try:
                response = await self._client.post("/v1/systemone", json=body)
            except httpx.TimeoutException:
                last_error = JevTimeoutError("Jev did not answer in time")
                continue
            except httpx.TransportError:
                last_error = JevUnavailableError("Could not connect to Jev")
                continue
            status = response.status_code
            if status in (401, 403):
                raise JevAuthError("TypeSafe rejected the API key")
            if status == 402:
                raise JevQuotaError("TypeSafe account is out of credit")
            if status == 429 or status >= 500:
                last_error = JevUnavailableError(f"TypeSafe returned HTTP {status}")
                continue
            if status >= 400:
                raise JevMalformedError(f"TypeSafe refused the question (HTTP {status})")
            try:
                return response.json()
            except ValueError as exc:
                raise JevMalformedError("TypeSafe returned non-JSON") from exc
        raise last_error

    async def health(self) -> JevHealth:
        now = time.monotonic()
        if self._health and now - self._health[0] < self.health_ttl_seconds:
            return self._health[1]
        started = time.perf_counter()
        try:
            response = await self._client.get("/v1/models")
            response.raise_for_status()
            names = [m["name"] for m in response.json().get("models", [])]
            result = JevHealth(
                mode="real",
                model=self.model,
                online=self.model in names,
                latency_ms=round((time.perf_counter() - started) * 1000),
                available_models=names,
                error=None if self.model in names else f"model {self.model} not available",
            )
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            result = JevHealth(
                mode="real", model=self.model, online=False, error=type(exc).__name__
            )
        self._health = (now, result)
        return result

    async def aclose(self) -> None:
        await self._client.aclose()


# Region kinds → material behaviours that suit them. The mock's "taste".
_KIND_AFFINITY: dict[str, dict[str, float]] = {
    "eye": {"liquid": 0.5, "ink": 0.35, "holographic": 0.45, "glitter": 0.3, "crystal": 0.2},
    "iris": {"liquid": 0.55, "holographic": 0.5, "crystal": 0.35, "glitter": 0.25},
    "pupil": {"ink": 0.6, "chrome": 0.3},
    "petal": {"watercolor": 0.6, "impasto": 0.35, "glitter": 0.2, "smoke": 0.15},
    "leaf": {"watercolor": 0.45, "grain": 0.3, "crystal": 0.2, "impasto": 0.2},
    "gear": {"chrome": 0.75, "lava": 0.3, "grain": 0.2},
    "sky": {"smoke": 0.5, "watercolor": 0.45, "holographic": 0.3, "spray": 0.2},
    "water": {"liquid": 0.5, "watercolor": 0.5, "crystal": 0.3},
    "wing": {"holographic": 0.6, "glitter": 0.4, "crystal": 0.35, "watercolor": 0.2},
    "planet": {"lava": 0.35, "holographic": 0.3, "smoke": 0.35, "glitter": 0.25},
    "ring": {"glitter": 0.5, "chrome": 0.3, "crystal": 0.3},
    "letter": {"pixel": 0.55, "spray": 0.5, "impasto": 0.35, "chrome": 0.25},
    "teeth": {"crystal": 0.4, "chrome": 0.35, "grain": 0.2},
    "mouth": {"liquid": 0.4, "lava": 0.35, "ink": 0.2},
    "horn": {"chrome": 0.4, "grain": 0.35, "lava": 0.2},
    "skin": {"impasto": 0.5, "watercolor": 0.4, "grain": 0.3},
    "face": {"impasto": 0.45, "watercolor": 0.4, "grain": 0.3, "chrome": 0.15},
    "mask": {"chrome": 0.45, "impasto": 0.4, "holographic": 0.2},
    "building": {"grain": 0.35, "pixel": 0.3, "chrome": 0.3, "spray": 0.25},
    "window": {"pixel": 0.4, "liquid": 0.25, "glitter": 0.2},
    "mountain": {"grain": 0.4, "watercolor": 0.35, "lava": 0.2, "smoke": 0.2},
    "fabric": {"grain": 0.5, "holographic": 0.3, "impasto": 0.2},
    "body": {"impasto": 0.45, "watercolor": 0.35, "smoke": 0.2},
    "shell": {"holographic": 0.55, "chrome": 0.35, "crystal": 0.3},
    "flame": {"lava": 0.7, "smoke": 0.3},
    "core": {"lava": 0.5, "glitter": 0.3, "liquid": 0.3},
    "vessel": {"crystal": 0.4, "impasto": 0.35, "chrome": 0.3},
    "board": {},
}
# Sketch categories → palette directions that suit them. The mock's colour taste.
_CATEGORY_PALETTES: dict[str, tuple[str, ...]] = {
    "eyes": ("neon-night", "royal-jewel"),
    "faces": ("earth-botanical", "pastel-dream"),
    "hands": ("earth-botanical", "pastel-dream"),
    "bodies": ("earth-botanical", "sunset-fire"),
    "flowers": ("pastel-dream", "sunset-fire", "earth-botanical"),
    "botanical": ("earth-botanical", "ocean-ice"),
    "animals": ("earth-botanical", "ocean-ice"),
    "insects": ("royal-jewel", "neon-night"),
    "landscapes": ("sunset-fire", "ocean-ice"),
    "planets": ("royal-jewel", "neon-night", "sunset-fire"),
    "architecture": ("metal-mono", "neon-night"),
    "mechanical": ("metal-mono", "sunset-fire"),
    "objects": ("earth-botanical", "metal-mono"),
    "typography": ("neon-night", "sunset-fire"),
    "geometry": ("royal-jewel", "ocean-ice"),
    "symbols": ("royal-jewel", "sunset-fire"),
    "creatures": ("neon-night", "ocean-ice"),
    "monsters": ("neon-night", "sunset-fire"),
    "masks": ("royal-jewel", "sunset-fire"),
    "fashion": ("royal-jewel", "pastel-dream"),
    "surreal": ("pastel-dream", "ocean-ice"),
}
_ALL_MATERIALS = tuple(MATERIALS_BY_ID.values())

_CHAOS_BEHAVIORS = {"pixel": 0.45, "glitter": 0.35, "holographic": 0.35, "spray": 0.25}
_HARD_BEHAVIORS = {"chrome", "crystal"}
_SOFT_BEHAVIORS = {"watercolor", "smoke", "liquid"}


def _unit(*parts: object) -> float:
    """Stable pseudo-random number in [0, 1) derived from the inputs."""
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def _softmax(scores: dict[str, float], temperature: float) -> dict[str, float]:
    peak = max(scores.values())
    weights = {k: math.exp((v - peak) / temperature) for k, v in scores.items()}
    total = sum(weights.values())
    return {k: round(w / total, 4) for k, w in weights.items()}


def _confidence(probabilities: dict[str, float]) -> float:
    """TypeSafe's documented confidence: (n * p_max - 1) / (n - 1).

    0 for a uniform distribution, 1 when all mass is on one option
    (docs.typesafe.ai, "Confidence").
    """
    n = len(probabilities)
    if n < 2:
        return 1.0
    top = max(probabilities.values())
    return round(min(1.0, max(0.0, (n * top - 1) / (n - 1))), 2)


def _choice_answer(probabilities: dict[str, float]) -> dict[str, Any]:
    return {
        "type": "choice",
        "choice": max(probabilities, key=probabilities.__getitem__),
        "confidence": _confidence(probabilities),
        "probabilities": probabilities,
    }


class MockJevProvider:
    """A deterministic Jev stand-in.

    It scores each criterion from the traits JevClient sends (the same traits real
    Jev reads), adds seeded noise and applies a softmax whose temperature varies with
    the input, so some answers are decisive and some are genuinely uncertain.
    """

    mode = "mock"
    model = "jev-mock"

    def __init__(self, latency_ms: int = 180) -> None:
        self._latency_ms = latency_ms

    async def ask(self, state: dict[str, Any], questions: dict[str, Any]) -> dict[str, Any]:
        # The mock's "taste" is stable per target; canvas context (painted neighbours,
        # chaos) shifts scores but must not reshuffle the noise. Retries do.
        canvas = state.get("canvas", {})
        seed = json.dumps(
            {
                "sketch": state.get("sketch"),
                "target": state.get("target"),
                "attempt": canvas.get("attempt"),
                "rejected": canvas.get("rejectedByUser"),
            },
            sort_keys=True,
        )
        if self._latency_ms:
            await asyncio.sleep(self._latency_ms * (0.6 + 0.8 * _unit(seed, "lag")) / 1000)
        answers: dict[str, Any] = {}
        for name, question in questions.items():
            if name == "treatment":
                answers[name] = _choice_answer(self._treatment(state, question, seed))
            elif name == "palette":
                answers[name] = _choice_answer(self._palette(state, question, seed))
            else:
                answers[name] = _choice_answer(self._material(state, question, seed))
        return {
            "model": self.model,
            "answers": answers,
            "usage": {
                "input_tokens": len(json.dumps(state)) // 4,
                "output_tokens": 12 * len(questions),
            },
        }

    def _material(self, state: dict[str, Any], question: dict[str, Any], seed: str) -> dict:
        target = state["target"]
        metrics = target["metrics"]
        kind = target["kind"]
        chaos = state["canvas"]["mood"].startswith("chaotic")
        painted = [p["name"] for p in state["canvas"].get("alreadyPainted", [])]
        painted_bases = [m.palette[0] for m in _ALL_MATERIALS if m.name in painted]
        direction = next(
            (
                p
                for p in PALETTES
                if p.name == state["canvas"].get("paletteDirection", {}).get("name")
            ),
            None,
        )
        affinity = next((v for k, v in _KIND_AFFINITY.items() if k in kind), {})
        focal = any(f in kind for f in ("eye", "iris", "core", "window", "sun"))

        scores: dict[str, float] = {}
        for key, criterion in question["criteria"].items():
            traits = criterion["traits"]
            behavior = traits["behavior"]
            score = affinity.get(behavior, 0.0)
            score += (metrics["complexity"] - 0.5) * (traits["roughness"] - 0.5) * 1.2
            if behavior in _SOFT_BEHAVIORS:
                score += (metrics["areaRatio"] - 0.25) * 0.8
            if behavior in _HARD_BEHAVIORS:
                score += (metrics["symmetry"] - 0.5) * 0.6
            if traits["luminous"] and focal:
                score += 0.3
            if chaos:
                score += _CHAOS_BEHAVIORS.get(behavior, 0.0)
            if criterion["what"].split(":")[0] in painted:
                score -= 0.5
            # colour sense: follow the palette direction and harmonise with the board
            if direction and traits["colorFamily"] in direction.families:
                score += 0.6
            material = MATERIALS_BY_ID.get(key)
            if material and painted_bases:
                score += (
                    0.35
                    * sum(color.harmony(material.palette[0], b) for b in painted_bases)
                    / len(painted_bases)
                )
            score += (_unit(seed, key) - 0.5) * 0.5
            scores[key] = score

        temperature = 0.06 + 0.16 * _unit(seed, "temperature") + (0.1 if chaos else 0.0)
        return _softmax(scores, temperature)

    def _palette(self, state: dict[str, Any], question: dict[str, Any], seed: str) -> dict:
        category = state["sketch"]["category"]
        likes = _CATEGORY_PALETTES.get(category, ())
        scores = {
            key: (0.8 if key in likes[:1] else 0.45 if key in likes else 0.0)
            + (_unit(seed, "palette", key) - 0.5) * 0.6
            for key in question["criteria"]
        }
        return _softmax(scores, 0.18)

    def _treatment(self, state: dict[str, Any], question: dict[str, Any], seed: str) -> dict:
        metrics = state["target"]["metrics"]
        base = {
            "focal-accent": 0.35 + (1 - metrics["areaRatio"]) * 0.2,
            "full-flood": 0.6 - metrics["complexity"] * 0.6,
            "duotone": metrics["symmetry"] * 0.7,
            "spectrum-mix": metrics["complexity"] * 0.7 + metrics["strokeDensity"] * 0.3,
        }
        scores = {
            key: base.get(key, 0.0) + (_unit(seed, "treatment", key) - 0.5) * 0.4
            for key in question["criteria"]
        }
        return _softmax(scores, 0.2)

    async def health(self) -> JevHealth:
        return JevHealth(
            mode="mock", model=self.model, online=True, latency_ms=0, available_models=[self.model]
        )

    async def aclose(self) -> None:
        return None


def build_provider(settings: Settings) -> JevProvider:
    if settings.jev_mode == "real":
        return RealJevProvider(
            api_key=settings.typesafe_api_key,
            base_url=settings.typesafe_base_url,
            model=settings.jev_model,
            timeout_seconds=settings.jev_timeout_seconds,
        )
    return MockJevProvider(latency_ms=0 if settings.env == "test" else 180)


# ── Client ──────────────────────────────────────────────────────────────────


def _parse_choice(answers: dict[str, Any], name: str) -> dict[str, Any]:
    answer = answers.get(name)
    if not isinstance(answer, dict) or answer.get("type") != "choice":
        raise JevMalformedError(f"Jev returned no '{name}' choice")
    if not isinstance(answer.get("probabilities"), dict):
        raise JevMalformedError(f"Jev's '{name}' answer has no probabilities")
    return answer


class JevClient:
    def __init__(self, provider: JevProvider) -> None:
        self.provider = provider

    async def decide_paint(self, request: DecisionRequest) -> DecisionResponse:
        return await self._decide(request, with_treatment=False)

    async def decide_sketch_treatment(self, request: DecisionRequest) -> DecisionResponse:
        return await self._decide(request, with_treatment=True)

    async def rank_paint_candidates(self, request: DecisionRequest) -> list[RankedMaterial]:
        return (await self.decide_paint(request)).ranking

    async def decide(self, request: DecisionRequest) -> DecisionResponse:
        if request.scope == "sketch":
            return await self.decide_sketch_treatment(request)
        return await self.decide_paint(request)

    async def retry(self, request: RetryRequest) -> DecisionResponse:
        rejected = set(request.rejected_material_ids)
        remaining = [m for m in request.candidate_materials if m not in rejected]
        if len(remaining) < 2:
            raise CandidateError("fewer than two candidates remain after rejections")
        narrowed = DecisionRequest(
            target=request.target,
            context=request.context,
            candidate_materials=remaining,
            scope=request.scope,
        )
        canvas_extra = {
            "rejectedByUser": [MATERIALS_BY_ID[m].name for m in rejected if m in MATERIALS_BY_ID],
            "attempt": request.attempt,
        }
        return await self._decide(
            narrowed, with_treatment=request.scope == "sketch", canvas_extra=canvas_extra
        )

    async def get_health(self) -> JevHealth:
        return await self.provider.health()

    async def decide_palette(self, request: PaletteRequest) -> PaletteDecision:
        """Board-level colour plan, asked once before a sketch's regions are painted."""
        state = build_state(request)
        started = time.perf_counter()
        raw = await self.provider.ask(state, paint_selector.build_palette_question())
        latency_ms = round((time.perf_counter() - started) * 1000)
        answers = raw.get("answers") if isinstance(raw, dict) else None
        if not isinstance(answers, dict):
            raise JevMalformedError("Jev returned no answers")
        answer = _parse_choice(answers, "palette")
        keys = [p.id for p in PALETTES]
        probabilities = paint_selector.normalize(answer["probabilities"], keys)
        confidence = min(1.0, max(0.0, float(answer.get("confidence", 0.0))))
        decision = PaletteDecision(
            decision_id=str(uuid.uuid4()),
            palette=max(keys, key=probabilities.__getitem__),
            probabilities=probabilities,
            confidence=confidence,
            certainty=paint_selector.certainty(confidence),
            latency_ms=latency_ms,
            provider=self.provider.mode,
            model=str(raw.get("model", self.provider.model)),
        )
        logger.info(
            "jev_palette",
            extra={
                "decision_id": decision.decision_id,
                "palette": decision.palette,
                "confidence": confidence,
                "latency_ms": latency_ms,
            },
        )
        return decision

    async def _decide(
        self,
        request: DecisionRequest,
        with_treatment: bool,
        canvas_extra: dict[str, Any] | None = None,
    ) -> DecisionResponse:
        unknown = [m for m in request.candidate_materials if m not in MATERIALS_BY_ID]
        if unknown:
            raise CandidateError(f"unknown materials: {', '.join(sorted(unknown))}")
        if request.context.palette and request.context.palette not in PALETTES_BY_ID:
            raise CandidateError(f"unknown palette: {request.context.palette}")
        candidates = [MATERIALS_BY_ID[m] for m in request.candidate_materials]
        keys = [m.id for m in candidates]

        state = build_state(request)
        if canvas_extra:
            state["canvas"].update(canvas_extra)
        questions = paint_selector.build_questions(candidates, with_treatment)

        started = time.perf_counter()
        raw = await self.provider.ask(state, questions)
        latency_ms = round((time.perf_counter() - started) * 1000)

        answers = raw.get("answers") if isinstance(raw, dict) else None
        if not isinstance(answers, dict):
            raise JevMalformedError("Jev returned no answers")
        material = _parse_choice(answers, "material")
        probabilities = paint_selector.normalize(material["probabilities"], keys)
        ranking = paint_selector.rank(probabilities)
        confidence = min(1.0, max(0.0, float(material.get("confidence", 0.0))))

        treatment = None
        if with_treatment:
            answer = _parse_choice(answers, "treatment")
            modes = list(paint_selector.TREATMENT_CRITERIA)
            treatment_probs = paint_selector.normalize(answer["probabilities"], modes)
            treatment = TreatmentDecision(
                mode=max(modes, key=treatment_probs.__getitem__),
                probabilities=treatment_probs,
                confidence=min(1.0, max(0.0, float(answer.get("confidence", 0.0)))),
            )

        usage = raw.get("usage")
        decision = DecisionResponse(
            decision_id=str(uuid.uuid4()),
            selected_material=ranking[0].material_id,
            probabilities=probabilities,
            ranking=ranking,
            confidence=confidence,
            certainty=paint_selector.certainty(confidence),
            treatment=treatment,
            latency_ms=latency_ms,
            provider=self.provider.mode,
            model=str(raw.get("model", self.provider.model)),
            usage=Usage(
                input_tokens=int(usage.get("input_tokens", 0)),
                output_tokens=int(usage.get("output_tokens", 0)),
            )
            if isinstance(usage, dict)
            else None,
        )
        logger.info(
            "jev_decision",
            extra={
                "decision_id": decision.decision_id,
                "provider": decision.provider,
                "model": decision.model,
                "scope": request.scope,
                "candidates": len(keys),
                "selected": decision.selected_material,
                "confidence": decision.confidence,
                "latency_ms": latency_ms,
            },
        )
        return decision
