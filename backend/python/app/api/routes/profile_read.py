from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.security import get_current_user
from app.dependencies import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import ProfileDetailResponse, ProfileResponse
from app.services.profile_service import build_profile_details, get_user_profile

router = APIRouter()


@router.get(
    "/profiles/me",
    response_model=ProfileResponse,
    summary="Recuperer mon profil",
    description="Retourne le profil associe a l'utilisateur authentifie.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_profile(db, current_user.id)


@router.get(
    "/profiles",
    response_model=list[ProfileResponse],
    summary="Lister les profils",
    description="Liste les profils avec filtre optionnel par pseudo et pagination.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR
    ),
)
def list_profiles(
    username: str | None = Query(
        default=None,
        description="Filtre optionnel par pseudo utilisateur (partiel, insensible a la casse)",
        examples=["neo"],
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
        description="Nombre maximal de profils retournes",
        examples=[10],
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Index de depart pour la pagination",
        examples=[0],
    ),
    db: Session = Depends(get_db),
):
    query = db.query(Profile).join(User)
    if username:
        query = query.filter(User.username.ilike(f"%{username}%"))
    return query.offset(offset).limit(limit).all()


@router.get(
    "/profiles/online",
    response_model=list[ProfileResponse],
    summary="Lister les profils en ligne",
    description="Retourne tous les profils actuellement marques en ligne.",
    responses=standard_error_responses(status.HTTP_500_INTERNAL_SERVER_ERROR),
)
def get_online_profiles(db: Session = Depends(get_db)):
    return db.query(Profile).filter(Profile.is_online.is_(True)).all()


@router.get(
    "/profiles/{user_id}",
    response_model=ProfileDetailResponse,
    summary="Recuperer le profil public d'un utilisateur",
    description="Retourne les informations publiques d'un utilisateur ainsi que ses points d'evaluation et statistiques principales.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_public_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_profile_details(db, user_id, viewer_user_id=current_user.id)
