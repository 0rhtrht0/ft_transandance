from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.exceptions import ProfileNotFound, UserNotFound
from app.core.public_api import require_public_api_access
from app.dependencies import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.profile import (
    ProfileDetailResponse,
    PublicProfileCreate,
    PublicProfileReplace,
)
from app.services.profile_service import build_profile_details


router = APIRouter(
    prefix="/api/public",
    tags=["public-api"],
    dependencies=[Depends(require_public_api_access)],
)


@router.get(
    "/profiles",
    response_model=list[ProfileDetailResponse],
    summary="List public profiles",
    description=(
        "Returns public profiles stored in the database. "
        "This endpoint is protected by the X-API-Key header and rate limited."
    ),
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_429_TOO_MANY_REQUESTS,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status.HTTP_503_SERVICE_UNAVAILABLE,
    ),
)
def list_public_profiles(
    username: str | None = Query(
        default=None,
        description="Optional username filter",
        examples=["neo"],
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Profile.user_id).join(User, User.id == Profile.user_id)
    if username:
        query = query.filter(User.username.ilike(f"%{username}%"))

    user_ids = [
        user_id
        for (user_id,) in query.order_by(User.username.asc()).offset(offset).limit(limit).all()
    ]
    return [
        build_profile_details(db, user_id, create_missing_profile=False)
        for user_id in user_ids
    ]


@router.get(
    "/profiles/{user_id}",
    response_model=ProfileDetailResponse,
    summary="Get one public profile",
    description="Returns one public profile with evaluation points and progression details.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_429_TOO_MANY_REQUESTS,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status.HTTP_503_SERVICE_UNAVAILABLE,
    ),
)
def get_public_api_profile(user_id: int, db: Session = Depends(get_db)):
    return build_profile_details(db, user_id, create_missing_profile=False)


@router.post(
    "/profiles",
    response_model=ProfileDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a public profile",
    description="Creates a profile row for an existing user so the resource can be managed through the public API.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_429_TOO_MANY_REQUESTS,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status.HTTP_503_SERVICE_UNAVAILABLE,
    ),
)
def create_public_profile(payload: PublicProfileCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise UserNotFound()

    existing_profile = db.query(Profile).filter(Profile.user_id == payload.user_id).first()
    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile already exists",
        )

    profile = Profile(
        user_id=payload.user_id,
        bio=payload.bio,
        avatar=payload.avatar,
        is_online=payload.is_online,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return build_profile_details(db, payload.user_id, create_missing_profile=False)


@router.put(
    "/profiles/{user_id}",
    response_model=ProfileDetailResponse,
    summary="Replace a public profile",
    description="Replaces the stored public profile fields for an existing profile.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_429_TOO_MANY_REQUESTS,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status.HTTP_503_SERVICE_UNAVAILABLE,
    ),
)
def replace_public_profile(
    user_id: int,
    payload: PublicProfileReplace,
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise ProfileNotFound()

    profile.bio = payload.bio
    profile.avatar = payload.avatar
    profile.is_online = payload.is_online
    db.commit()
    db.refresh(profile)

    return build_profile_details(db, user_id, create_missing_profile=False)


@router.delete(
    "/profiles/{user_id}",
    response_model=MessageResponse,
    summary="Delete a public profile",
    description="Deletes the profile row for the provided user id.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_429_TOO_MANY_REQUESTS,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status.HTTP_503_SERVICE_UNAVAILABLE,
    ),
)
def delete_public_profile(user_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise ProfileNotFound()

    db.delete(profile)
    db.commit()
    return {"detail": "Public profile deleted"}
