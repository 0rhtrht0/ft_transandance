from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.models.user import User
from app.services.profile_service import get_user_evaluation_points


def _map_friend_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=403, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


def _serialize_user(db: Session, user_id: int, cache: dict[int, dict] | None = None) -> dict:
    if cache is not None and user_id in cache:
        return cache[user_id]
    user = db.query(User).filter(User.id == user_id).first()
    profile = db.query(Profile).filter(Profile.user_id == user_id).first() if user else None
    data = {
        "id": user.id if user else user_id,
        "username": user.username if user else "Unknown",
        "avatar": profile.avatar if profile else None,
        "is_online": profile.is_online if profile else None,
        "last_seen": getattr(profile, "last_seen", None),
        "evaluation_points": get_user_evaluation_points(db, user_id) if user else 0,
    }
    if cache is not None:
        cache[user_id] = data
    return data


def _serialize_relationship(db: Session, relationship, cache: dict[int, dict] | None = None) -> dict:
    return {
        "id": relationship.id,
        "requester_id": relationship.requester_id,
        "addressee_id": relationship.addressee_id,
        "status": relationship.status,
        "created_at": relationship.created_at,
        "requester": _serialize_user(db, relationship.requester_id, cache),
        "addressee": _serialize_user(db, relationship.addressee_id, cache),
    }


def _resolve_username(db: Session, current_user: User) -> str:
    username = getattr(current_user, "username", None)
    if username:
        return username
    user = db.query(User).filter(User.id == current_user.id).first()
    if user and user.username:
        return user.username
    return "Unknown"
