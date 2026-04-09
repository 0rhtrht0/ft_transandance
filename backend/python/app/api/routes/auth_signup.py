from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.exceptions import UsernameOrEmailAlreadyExists
from app.core.security import hash_password
from app.dependencies import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse

router = APIRouter()


@router.post(
    "/signup",
    response_model=UserResponse,
    summary="Creer un compte",
    description="Cree un nouvel utilisateur et stocke le mot de passe de maniere hashee.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR
    ),
)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        (User.email == user.email) | (User.username == user.username)
    ).first()
    if existing_user:
        raise UsernameOrEmailAlreadyExists()

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
