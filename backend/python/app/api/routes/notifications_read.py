import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User
from app.services.notifications_read_service import count_unread, list_user_notifications

router = APIRouter()


def _decode_content(content: str) -> tuple[str, str]:
    try:
        payload = json.loads(content)
        if isinstance(payload, dict):
            title = str(payload.get("title") or "Notification")
            message = str(payload.get("message") or "")
            return title, message
    except Exception:
        pass
    return "Notification", content


def _serialize_notification(row: Notification) -> dict:
    title, message = _decode_content(row.content)
    return {
        "id": row.id,
        "type": row.type,
        "title": title,
        "message": message,
        "read": bool(row.is_read),
        "created_at": row.created_at,
    }


@router.get("/")
async def list_notifications(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = list_user_notifications(db, current_user.id, limit)
    payload = [_serialize_notification(row) for row in rows]
    return {
        "notifications": payload,
        "unread_count": count_unread(rows),
        "total_count": len(rows),
    }


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = list_user_notifications(db, current_user.id, 500)
    return {"unread_count": count_unread(rows)}
