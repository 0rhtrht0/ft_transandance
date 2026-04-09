from jose import jwt
from jose.exceptions import JWTError
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import InvalidCredentials
from app.models.user import User


def extract_bearer_token(authorization: str | None) -> str | None:
    scheme, token = get_authorization_scheme_param(authorization)
    if not authorization or scheme.lower() != "bearer" or not token:
        return None
    return token


def get_user_from_token(token: str, db: Session) -> User:
    credentials_exception = InvalidCredentials()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        subject = payload.get("sub")
        username = str(subject).strip() if subject is not None else None
        user_id = payload.get("uid", payload.get("user_id"))
        if subject is None:
            raise credentials_exception
        if not username:
            raise credentials_exception
        if isinstance(user_id, str):
            user_id = int(user_id) if user_id.isdigit() else None
        elif not isinstance(user_id, int):
            user_id = None
    except JWTError as exc:
        raise credentials_exception from exc

    user = None
    if user_id is not None:
        user = db.query(User).filter(User.id == user_id).first()
    if user is None and username is not None:
        user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    return user


def extract_cookie_token(connection) -> str | None:
    cookie_token = connection.cookies.get("access_token")
    if not cookie_token:
        return None
    if cookie_token.lower().startswith("bearer "):
        return cookie_token.split(" ", 1)[1].strip()
    return cookie_token
