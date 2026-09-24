"""In-process request limits. Enough for the single-instance deploy; move the
counters to Redis or the database if this ever runs replicated. A restart resets
them, so the TypeSafe account's own spend cap stays the hard ceiling."""

import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from app.config import Settings

DAY = 86_400


class RateLimiter:
    """Sliding window per client key. A limit of 0 or less disables it."""

    max_keys = 10_000

    def __init__(
        self, limit: int, window: float = 60, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.limit = limit
        self.window = window
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> float | None:
        """Record a hit. Returns seconds to wait if over the limit, else None."""
        if self.limit <= 0:
            return None
        now = self._clock()
        hits = self._hits.get(key)
        if hits is None:
            if len(self._hits) >= self.max_keys:
                self._hits.clear()
            hits = self._hits[key] = deque()
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return round(self.window - (now - hits[0]), 1)
        hits.append(now)
        return None


class DailyQuota:
    """Calls per key per UTC day. A limit of 0 or less disables it."""

    max_keys = 100_000

    def __init__(self, limit: int, clock: Callable[[], float] = time.time) -> None:
        self.limit = limit
        self._clock = clock
        self._day = -1
        self._counts: dict[str, int] = {}

    def check(self, key: str) -> float | None:
        """Count a call. Returns seconds until midnight UTC if the quota is used up, else None."""
        if self.limit <= 0:
            return None
        now = self._clock()
        day = int(now // DAY)
        if day != self._day:
            self._day, self._counts = day, {}
        count = self._counts.get(key, 0)
        if count >= self.limit:
            return round(DAY - now % DAY, 1)
        if not count and len(self._counts) >= self.max_keys:
            return round(DAY - now % DAY, 1)  # refuse new keys rather than forget old ones
        self._counts[key] = count + 1
        return None


@dataclass
class Limits:
    requests: RateLimiter  # every /api request, per client
    jev: RateLimiter  # Jev decisions per client per minute
    jev_daily: DailyQuota  # Jev decisions per client per UTC day
    jev_budget: DailyQuota  # Jev decisions for the whole server per UTC day
    writes: RateLimiter  # project creates and saves per client per minute

    @classmethod
    def from_settings(cls, settings: Settings) -> "Limits":
        return cls(
            requests=RateLimiter(settings.rate_limit_per_minute),
            jev=RateLimiter(settings.jev_rate_limit_per_minute),
            jev_daily=DailyQuota(settings.jev_daily_limit_per_client),
            jev_budget=DailyQuota(settings.jev_daily_budget),
            writes=RateLimiter(settings.project_writes_per_minute),
        )
