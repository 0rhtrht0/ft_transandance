from sqlalchemy.orm import Session
from app.models.notification import Notification

def list_user_notifications(db: Session, user_id: int, limit: int) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )

def count_unread(rows: list[Notification]) -> int:
    return sum(1 for row in rows if not row.is_read)