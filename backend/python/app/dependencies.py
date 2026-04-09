from app.core.database import SessionLocal

from fastapi import Depends
from app.core.exceptions import AdminPrivilegesRequired
from app.core.security import get_current_user
from app.models.user import User

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def is_admin_user(current_user: User = Depends(get_current_user)):
    if not getattr(current_user, "is_admin", False):
        raise AdminPrivilegesRequired()
    return current_user
