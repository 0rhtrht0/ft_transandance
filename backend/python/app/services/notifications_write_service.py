import json
from sqlalchemy.orm import Session
from app.models.notification import Notification

def encode_content(title: str, message: str) -> str:
    return json.dumps({"title": title, "message": message})

def create_user_notification(db: Session, user_id: int, type_: str, title: str, message: str) -> Notification:
    row = Notification(user_id=user_id, type=type_, content=encode_content(title, message), is_read=False)
    db.add(row); db.commit(); db.refresh(row)
    return row

def mark_one_read(db: Session, user_id: int, notification_id: int) -> Notification | None:
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if not row: return None
    row.is_read = True; db.commit(); db.refresh(row)
    return row

def delete_one(db: Session, user_id: int, notification_id: int) -> bool:
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if not row: return False
    db.delete(row); db.commit()
    return True

def clear_all(db: Session, user_id: int) -> None:
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
    db.commit()