from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.exceptions import InvalidFilename, InvalidImageUpload, ProfileNotFound
from app.core.security import get_current_user
from app.dependencies import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.profile import AvatarUploadResponse, ProfileResponse, ProfileUpdate
from app.services.profile_service import update_profile

router = APIRouter()


@router.delete(
    "/profiles/me",
    response_model=MessageResponse,
    summary="Supprimer mon profil",
    description="Supprime le profil de l'utilisateur authentifie.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def delete_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise ProfileNotFound()

    db.delete(profile)
    db.commit()
    return {"detail": "Profile deleted"}


@router.patch(
    "/profiles/me",
    response_model=ProfileResponse,
    summary="Modifier mon profil",
    description="Met a jour partiellement la biographie et/ou l'avatar du profil connecte.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def update_my_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_profile(db, current_user, bio=data.bio, avatar=data.avatar)


@router.post(
    "/profiles/me/avatar",
    response_model=AvatarUploadResponse,
    summary="Uploader un avatar",
    description="Accepte un fichier image et met a jour l'avatar du profil connecte.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (file.content_type or "").startswith("image/"):
        raise InvalidImageUpload()

    # Use a deterministic project path so Docker/local runs share the same avatar directory.
    upload_dir = Path(__file__).resolve().parents[3] / "uploaded_avatars"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = Path(file.filename or "").name
    if not filename:
        raise InvalidFilename()

    stored_filename = f"user_{current_user.id}_{filename}"
    disk_path = upload_dir / stored_filename
    with disk_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    avatar_path = f"uploaded_avatars/{stored_filename}"

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    profile.avatar = avatar_path
    db.commit()
    db.refresh(profile)
    return {"avatar": avatar_path, "detail": "Avatar uploaded"}
