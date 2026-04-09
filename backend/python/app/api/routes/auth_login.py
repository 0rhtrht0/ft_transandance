from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.errors import standard_error_responses
from app.core.exceptions import IncorrectUsernameOrPassword
from app.core.security import verify_password
from app.dependencies import get_db
from app.models.user import User
from app.realtime.presence import notify_online, set_online
from app.schemas.common import TokenResponse

from .auth_rate_limit import (
    _clear_login_failures,
    _ensure_login_not_blocked,
    _login_rate_limit_key,
    _record_login_failure,
)
from .auth_tokens import build_access_token, set_access_cookie

router = APIRouter()


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Se connecter",
    description=(
        "Authentifie un utilisateur via formulaire OAuth2 "
        "(`username`, `password`) et renvoie un token JWT bearer."
    ),
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_429_TOO_MANY_REQUESTS,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    response: Response = None,  # type: ignore[assignment]
    request: Request = None,  # type: ignore[assignment]
):
    login_identifier = form_data.username.strip()
    rate_limit_key = _login_rate_limit_key(login_identifier, request)
    await _ensure_login_not_blocked(rate_limit_key)

    normalized_identifier = login_identifier.lower()
    user = (
        db.query(User)
        .filter(
            or_(
                func.lower(User.username) == normalized_identifier,
                func.lower(User.email) == normalized_identifier,
            )
        )
        .first()
    )
    if not user or not verify_password(form_data.password, user.hashed_password):
        await _record_login_failure(rate_limit_key)
        raise IncorrectUsernameOrPassword()

    await _clear_login_failures(rate_limit_key)

    set_online(db, user.id, True)
    await notify_online(db, user.id, user.username)

    token = build_access_token(user.id, user.username)
    if response is not None:
        set_access_cookie(response, token, request)
    return {"access_token": token, "token_type": "bearer"}
