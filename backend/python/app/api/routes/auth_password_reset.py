from datetime import datetime, timedelta, timezone
import hashlib
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import standard_error_responses
from app.core.security import hash_password
from app.dependencies import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from app.schemas.common import MessageResponse
from app.services.password_reset_mailer import send_password_reset_token

from .auth_rate_limit import _clear_login_failures_for_username

router = APIRouter()
logger = logging.getLogger(__name__)

def _get_origin_from_request(request: Request | None) -> str:
    # Use standard settings if available
    origin = settings.PUBLIC_FRONTEND_ORIGIN

    if request is None:
        return origin

    # Try an origin header sent by the client, fallback to referer
    client_origin = request.headers.get("origin") or request.headers.get("referer")

    # If the origin is in our allowed CORS list, trust it and use it!
    if client_origin:
        client_origin = client_origin.rstrip("/")
        if client_origin in settings.CORS_ALLOW_ORIGINS:
            origin = client_origin

    return origin

def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Demander une reinitialisation de mot de passe",
    description="Genere un token de reset pour un compte existant.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request = None,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email.lower()).first()

    raw_token: str | None = None
    if user:
        raw_token = secrets.token_urlsafe(32)
        user.password_reset_token_hash = _hash_reset_token(raw_token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )
        db.commit()

        dynamic_origin = _get_origin_from_request(request)
        try:
            send_password_reset_token(user.email, raw_token, origin=dynamic_origin)
        except Exception:
            logger.exception("Failed to send password reset email")

    response = {
        "detail": "If an account exists, a reset token has been generated.",
    }
    if settings.PASSWORD_RESET_DEV_RETURN_TOKEN and raw_token:
        response["reset_token"] = raw_token

    return response


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reinitialiser le mot de passe",
    description="Valide le token de reset et remplace le mot de passe utilisateur.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_hash = _hash_reset_token(payload.token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()

    if not user or not user.password_reset_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    expiry = user.password_reset_expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry < datetime.now(timezone.utc):
        user.password_reset_token_hash = None
        user.password_reset_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.commit()
    await _clear_login_failures_for_username(user.username)

    return {"detail": "Password reset successful."}
