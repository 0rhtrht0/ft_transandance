from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from jose import jwt

from app.core.config import settings

ACCESS_TOKEN_EXPIRE_MINUTES = 30


def build_access_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": username, "uid": user_id, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def set_access_cookie(response: Response, token: str, request: Request | None) -> None:
    forwarded_proto = ""
    if request is not None:
        forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",", 1)[0].strip().lower()
    secure_cookie = bool(request and (request.url.scheme == "https" or forwarded_proto == "https"))
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
