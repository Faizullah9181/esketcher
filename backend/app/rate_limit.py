import time
from collections import deque
from collections.abc import Callable


class RateLimiter:
    """Sliding one-minute window per client key. In-process, which is enough for a
    single-instance app; swap for Redis if this ever runs replicated."""

    max_keys = 10_000

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic) -> None:
        self.per_minute = per_minute
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> float | None:
        """Record a hit. Returns seconds to wait if over the limit, else None."""
        now = self._clock()
        hits = self._hits.get(key)
        if hits is None:
            if len(self._hits) >= self.max_keys:
                self._hits.clear()
            hits = self._hits[key] = deque()
        while hits and now - hits[0] >= 60:
            hits.popleft()
        if len(hits) >= self.per_minute:
            return round(60 - (now - hits[0]), 1)
        hits.append(now)
        return None
