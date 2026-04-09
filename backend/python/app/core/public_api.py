from __future__ import annotations

from collections import defaultdict, deque
from math import ceil
from secrets import compare_digest
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, Response, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import settings


public_api_key_header = APIKeyHeader(
    name="X-API-Key",
    scheme_name="PublicApiKey",
    description="API key required to access the public database API.",
    auto_error=False,
)


class PublicApiRateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, subject: str) -> tuple[bool, int, int]:
        now = monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            events = self._events[subject]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= self.limit:
                retry_after = max(1, ceil(self.window_seconds - (now - events[0])))
                return False, 0, retry_after

            events.append(now)
            remaining = max(self.limit - len(events), 0)
            return True, remaining, 0

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


def require_public_api_access(
    request: Request,
    response: Response,
    api_key: str | None = Security(public_api_key_header),
) -> str:
    configured_keys = [key for key in settings.PUBLIC_API_KEYS if key]
    if not configured_keys:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Public API key is not configured.",
        )

    if not api_key or not any(compare_digest(api_key, valid_key) for valid_key in configured_keys):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )

    limiter = getattr(request.app.state, "public_api_rate_limiter", None)
    if limiter is None:
        return api_key

    client_host = request.client.host if request.client else "unknown"
    allowed, remaining, retry_after = limiter.check(f"{client_host}:{api_key}")
    rate_headers = {
        "X-RateLimit-Limit": str(limiter.limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Window": str(limiter.window_seconds),
    }

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Public API rate limit exceeded.",
            headers={
                **rate_headers,
                "Retry-After": str(retry_after),
            },
        )

    for name, value in rate_headers.items():
        response.headers[name] = value

    return api_key
