import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationCreatePayload
from app.services.notifications_write_service import (
    clear_all,
    create_user_notification,
    delete_one,
    mark_one_read,
)

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


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = create_user_notification(
        db=db,
        user_id=current_user.id,
        type_=payload.type,
        title=payload.title,
        message=payload.message,
    )
    return _serialize_notification(row)


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = mark_one_read(db, current_user.id, notification_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return _serialize_notification(row)


@router.patch("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"detail": "All notifications marked as read"}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = delete_one(db, current_user.id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clear_all(db, current_user.id)
