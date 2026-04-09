import re
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import standard_error_responses
from app.core.security import hash_password
from app.core.usernames import USERNAME_MAX_LENGTH
from app.dependencies import get_db
from app.models.user import User
from app.realtime.presence import notify_online, set_online
from app.schemas.auth import GoogleAuthRequest, GoogleClientConfigResponse
from app.schemas.common import TokenResponse

from .auth_rate_limit import _clear_login_failures_for_username
from .auth_tokens import build_access_token, set_access_cookie

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

router = APIRouter()


def _slugify_username(seed: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_]+", "_", seed.lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if len(cleaned) < 3:
        cleaned = "player"
    return cleaned[:USERNAME_MAX_LENGTH]


def _unique_username(db: Session, base: str) -> str:
    candidate = base
    suffix = 1
    while db.query(User).filter(User.username == candidate).first():
        suffix_text = f"_{suffix}"
        max_base = max(3, USERNAME_MAX_LENGTH - len(suffix_text))
        candidate = f"{base[:max_base]}{suffix_text}"
        suffix += 1
    return candidate


def _get_request_scheme(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto:
        return forwarded_proto.split(",", 1)[0].strip() or request.url.scheme
    return request.url.scheme


def _get_request_host(request: Request) -> str:
    forwarded_host = request.headers.get("x-forwarded-host", "")
    if forwarded_host:
        return forwarded_host.split(",", 1)[0].strip() or request.headers.get("host", request.url.netloc)
    return request.headers.get("host", request.url.netloc)


def _build_frontend_origin(request: Request) -> str:
    return f"{_get_request_scheme(request)}://{_get_request_host(request)}"


def _build_google_redirect_target(request: Request, token: str, user: User) -> str:
    fragment = urlencode(
        {
            "google_access_token": token,
            "google_user_id": user.id,
            "google_username": user.username,
        }
    )
    return f"{_build_frontend_origin(request)}/auth#{fragment}"


def _build_google_error_redirect_target(request: Request, detail: str) -> str:
    fragment = urlencode({"google_error": detail})
    return f"{_build_frontend_origin(request)}/auth#{fragment}"


async def _verify_google_token(credential: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google login is not configured on the server.",
        )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                GOOGLE_TOKENINFO_URL,
                params={"id_token": credential},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google verification service unavailable.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential.",
        )

    data = response.json()
    if data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience mismatch.",
        )

    issuer = data.get("iss")
    if issuer not in settings.GOOGLE_ALLOWED_ISSUERS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token issuer.",
        )

    email = data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email.",
        )

    email_verified = data.get("email_verified")
    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if email_verified is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email is not verified.",
        )

    return data


async def _authenticate_google_credential(
    credential: str,
    db: Session,
) -> tuple[User, str]:
    token_info = await _verify_google_token(credential)

    email = token_info.get("email", "").lower()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        preferred_name = token_info.get("name") or token_info.get("given_name") or email.split("@")[0]
        base_username = _slugify_username(preferred_name)
        username = _unique_username(db, base_username)

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    set_online(db, user.id, True)
    await notify_online(db, user.id, user.username)

    await _clear_login_failures_for_username(user.username)

    token = build_access_token(user.id, user.username)
    return user, token


@router.get(
    "/google/config",
    response_model=GoogleClientConfigResponse,
    summary="Recuperer la config Google publique",
    description="Expose la configuration publique necessaire au frontend pour Google Identity Services.",
)
def google_client_config() -> GoogleClientConfigResponse:
    configured = bool(settings.GOOGLE_CLIENT_ID)
    return {
        "enabled": configured,
        "client_id": settings.GOOGLE_CLIENT_ID if configured else "",
    }


@router.post(
    "/google",
    response_model=TokenResponse,
    summary="Se connecter avec Google",
    description="Verifie un ID token Google et cree l'utilisateur si besoin.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_503_SERVICE_UNAVAILABLE,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def login_google(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
    response: Response = None,  # type: ignore[assignment]
    request: Request = None,  # type: ignore[assignment]
):
    user, token = await _authenticate_google_credential(payload.credential, db)
    if response is not None:
        set_access_cookie(response, token, request)
    return {"access_token": token, "token_type": "bearer"}


@router.post(
    "/google/redirect",
    summary="Terminer la connexion Google en mode redirect",
    description="Traite un retour Google Identity cote backend puis redirige vers le frontend avec la session active.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_503_SERVICE_UNAVAILABLE,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def login_google_redirect(
    credential: str = Form(...),
    db: Session = Depends(get_db),
    request: Request = None,  # type: ignore[assignment]
):
    try:
        user, token = await _authenticate_google_credential(credential, db)
    except HTTPException as exc:
        return RedirectResponse(
            url=_build_google_error_redirect_target(request, str(exc.detail)),
            status_code=status.HTTP_303_SEE_OTHER,
        )

    response = RedirectResponse(
        url=_build_google_redirect_target(request, token, user),
        status_code=status.HTTP_303_SEE_OTHER,
    )
    set_access_cookie(response, token, request)
    return response
