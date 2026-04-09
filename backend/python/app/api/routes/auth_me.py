from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.exceptions import EmailAlreadyTaken, UsernameAlreadyTaken
from app.core.security import get_current_user, hash_password
from app.dependencies import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user import UserAuthResponse, UserResponse, UserUpdate

from .auth_tokens import build_access_token, set_access_cookie

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Recuperer le profil connecte",
    description="Retourne l'utilisateur associe au token bearer fourni.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def read_auth_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch(
    "/me",
    response_model=UserAuthResponse,
    summary="Mettre a jour le compte connecte",
    description="Met a jour le pseudo, email ou mot de passe puis renvoie un nouveau token.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def update_auth_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    response: Response = None,  # type: ignore[assignment]
    request: Request = None,  # type: ignore[assignment]
):
    updated = False
    persistent_user = db.get(User, current_user.id)
    if persistent_user is None:
        return {
            "user": current_user,
            "access_token": build_access_token(current_user.id, current_user.username),
            "token_type": "bearer",
        }

    if payload.username and payload.username != persistent_user.username:
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing and existing.id != persistent_user.id:
            raise UsernameAlreadyTaken()
        persistent_user.username = payload.username
        updated = True

    if payload.email and payload.email != persistent_user.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing and existing.id != persistent_user.id:
            raise EmailAlreadyTaken()
        persistent_user.email = payload.email
        updated = True

    if payload.password:
        persistent_user.hashed_password = hash_password(payload.password)
        updated = True

    if updated:
        db.commit()
        db.refresh(persistent_user)

    token = build_access_token(persistent_user.id, persistent_user.username)
    if response is not None:
        set_access_cookie(response, token, request)
    return {"user": persistent_user, "access_token": token, "token_type": "bearer"}


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Se deconnecter",
    description="Met l'utilisateur hors ligne et confirme la deconnexion.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    response: Response = None,  # type: ignore[assignment]
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if profile:
        profile.is_online = False
        db.commit()
    if response is not None:
        response.delete_cookie("access_token")
    return {"detail": "Logged out"}
