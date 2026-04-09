import logging

from sqlalchemy.orm import Session
from app.realtime.manager import send_to_user
from app.realtime.contracts import EVENT_NOTIFICATION_CREATED
from app.services.notifications_write_service import create_user_notification

logger = logging.getLogger(__name__)


def _sanitize_notification_text(value: str, fallback: str) -> str:
    cleaned = (value or "").strip()
    return cleaned if cleaned else fallback

async def create_and_push_notification(db: Session, user_id: int, type_: str, title: str, message: str) -> dict:
    safe_type = _sanitize_notification_text(type_, "info")
    safe_title = _sanitize_notification_text(title, "Notification")
    safe_message = _sanitize_notification_text(message, "")

    row = create_user_notification(db, user_id, safe_type, safe_title, safe_message)
    payload = {
        "type": "notification",
        "event": EVENT_NOTIFICATION_CREATED,
        "notification": {
            "id": row.id,
            "type": safe_type,
            "title": safe_title,
            "message": safe_message,
            "read": False,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        },
    }

    delivered = await send_to_user(user_id, payload)
    logger.info(
        "notification persisted and pushed",
        extra={"user_id": user_id, "notification_id": row.id, "delivered": delivered},
    )
    return payload