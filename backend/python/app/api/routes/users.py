from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.dependencies import get_current_user, get_db
from app.models.profile import Profile
from app.models.user import User
from app.services.friend_services import get_accepted_friend_ids
from app.services.profile_service import get_user_evaluation_points

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get(
    "/search",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def search_users(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.username.ilike(f"%{q}%"))
        .filter(User.id != current_user.id)
        .order_by(User.username.asc())
        .limit(limit)
        .all()
    )

    current_friend_ids = set(get_accepted_friend_ids(db, current_user.id))
    results = []
    for user in users:
        profile = db.query(Profile).filter(Profile.user_id == user.id).first()
        user_friend_ids = set(get_accepted_friend_ids(db, user.id))
        mutual_count = len(current_friend_ids.intersection(user_friend_ids))
        results.append(
            {
                "id": user.id,
                "username": user.username,
                "avatar": profile.avatar if profile else None,
                "is_online": profile.is_online if profile else False,
                "is_friend": user.id in current_friend_ids,
                "mutual_friends": mutual_count,
                "evaluation_points": get_user_evaluation_points(db, user.id),
            }
        )

    return {"users": results}
