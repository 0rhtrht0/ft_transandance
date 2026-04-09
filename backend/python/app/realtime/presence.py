import logging

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.realtime.contracts import EVENT_PRESENCE_OFFLINE, EVENT_PRESENCE_ONLINE
from app.realtime.manager import send_to_user
from app.services.friend_services import get_accepted_friend_ids
from app.services.notification_realtime_service import create_and_push_notification

logger = logging.getLogger(__name__)


def set_online(db: Session, user_id: int, is_online: bool) -> None:
    try:
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        if not profile:
            return
        profile.is_online = is_online
        db.commit()
    except OperationalError:
        db.rollback()
        logger.warning("Skipping presence profile update because supporting tables are unavailable.")


def _get_friend_ids(db: Session, user_id: int) -> list[int]:
    try:
        return get_accepted_friend_ids(db, user_id)
    except OperationalError:
        db.rollback()
        logger.warning("Skipping presence notification because friendships data is unavailable.")
        return []


async def _persist_presence_notification(db: Session, friend_id: int, username: str, is_online: bool) -> None:
    status_label = "online" if is_online else "offline"
    try:
        await create_and_push_notification(
            db=db,
            user_id=friend_id,
            type_=f"presence.{status_label}",
            title=username,
            message=f"{username} is now {status_label}.",
        )
    except OperationalError:
        db.rollback()
        logger.warning("Skipping persisted presence notification because notifications tables are unavailable.")


async def notify_online(db: Session, user_id: int, username: str) -> None:
    friend_ids = _get_friend_ids(db, user_id)
    payload = {
        "type": "presence.online",
        "event": EVENT_PRESENCE_ONLINE,
        "user_id": user_id,
        "username": username,
    }
    for fid in friend_ids:
        await send_to_user(fid, payload)
        await _persist_presence_notification(db, fid, username, True)


async def notify_offline(db: Session, user_id: int, username: str) -> None:
    friend_ids = _get_friend_ids(db, user_id)
    payload = {
        "type": "presence.offline",
        "event": EVENT_PRESENCE_OFFLINE,
        "user_id": user_id,
        "username": username,
    }
    for fid in friend_ids:
        await send_to_user(fid, payload)
        await _persist_presence_notification(db, fid, username, False)
