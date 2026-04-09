from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidCredentials

from .security_tokens import extract_cookie_token, get_user_from_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _get_db_for_auth():
    from app.dependencies import get_db
    yield from get_db()


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(_get_db_for_auth),
):
    if token:
        try:
            return get_user_from_token(token, db)
        except InvalidCredentials:
            pass

    cookie_token = extract_cookie_token(request)
    if not cookie_token or cookie_token == token:
        raise InvalidCredentials()
    return get_user_from_token(cookie_token, db)
