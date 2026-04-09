import asyncio
import time

from fastapi import HTTPException, Request, status

from app.core.config import settings

FAILED_LOGIN_ATTEMPTS: dict[str, list[float]] = {}
LOGIN_BLOCKED_UNTIL: dict[str, float] = {}
LOGIN_RATE_LIMIT_LOCK = asyncio.Lock()


def reset_login_rate_limit_state() -> None:
    FAILED_LOGIN_ATTEMPTS.clear()
    LOGIN_BLOCKED_UNTIL.clear()


def _login_rate_limit_key(username: str, request: Request | None) -> str:
    client_host = "unknown"
    if request is not None and request.client is not None and request.client.host:
        client_host = request.client.host
    return f"{client_host}:{username.strip().lower()}"


async def _ensure_login_not_blocked(key: str) -> None:
    now = time.monotonic()
    async with LOGIN_RATE_LIMIT_LOCK:
        blocked_until = LOGIN_BLOCKED_UNTIL.get(key)
        if blocked_until is None:
            return

        if blocked_until <= now:
            LOGIN_BLOCKED_UNTIL.pop(key, None)
            FAILED_LOGIN_ATTEMPTS.pop(key, None)
            return

        retry_after = max(1, int(blocked_until - now))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )


async def _record_login_failure(key: str) -> None:
    now = time.monotonic()
    window = settings.LOGIN_ATTEMPT_WINDOW_SECONDS
    max_attempts = settings.LOGIN_MAX_ATTEMPTS
    block_seconds = settings.LOGIN_BLOCK_SECONDS

    async with LOGIN_RATE_LIMIT_LOCK:
        previous_attempts = FAILED_LOGIN_ATTEMPTS.get(key, [])
        recent_attempts = [attempt for attempt in previous_attempts if now - attempt <= window]
        recent_attempts.append(now)
        FAILED_LOGIN_ATTEMPTS[key] = recent_attempts

        if len(recent_attempts) >= max_attempts:
            LOGIN_BLOCKED_UNTIL[key] = now + block_seconds
            FAILED_LOGIN_ATTEMPTS.pop(key, None)


async def _clear_login_failures(key: str) -> None:
    async with LOGIN_RATE_LIMIT_LOCK:
        FAILED_LOGIN_ATTEMPTS.pop(key, None)
        LOGIN_BLOCKED_UNTIL.pop(key, None)


async def _clear_login_failures_for_username(username: str) -> None:
    username_suffix = f":{username.strip().lower()}"
    async with LOGIN_RATE_LIMIT_LOCK:
        for key in [key for key in FAILED_LOGIN_ATTEMPTS if key.endswith(username_suffix)]:
            FAILED_LOGIN_ATTEMPTS.pop(key, None)
        for key in [key for key in LOGIN_BLOCKED_UNTIL if key.endswith(username_suffix)]:
            LOGIN_BLOCKED_UNTIL.pop(key, None)
