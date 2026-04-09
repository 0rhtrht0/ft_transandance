from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import ProfileNotFound, UserNotFound

from app.models.game_result import GameResult
from app.models.profile import Profile
from app.models.stage_progress import StageProgress
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_transaction import WalletTransaction
from app.services.friend_services import get_accepted_friend_ids


PROFILE_DIFFICULTIES = ("facile", "moyen", "difficile")


def get_user_profile(db: Session, user_id: int):
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        # Instead of throwing 404, we lazily create the profile
        profile = Profile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


def get_existing_profile(db: Session, user_id: int):
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise ProfileNotFound()
    return profile


def update_profile(db: Session, user: User, bio: str | None = None, avatar: str | None = None):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    if bio is not None:
        profile.bio = bio
    if avatar is not None:
        profile.avatar = avatar
    db.commit()
    db.refresh(profile)

    return profile


def get_user_evaluation_points(db: Session, user_id: int) -> int:
    total = (
        db.query(Wallet.total_evaluation_points)
        .filter(Wallet.user_id == user_id)
        .scalar()
    )
    return int(total or 0)


def build_profile_details(
    db: Session,
    user_id: int,
    viewer_user_id: int | None = None,
    create_missing_profile: bool = True,
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserNotFound()

    profile = (
        get_user_profile(db, user_id)
        if create_missing_profile
        else get_existing_profile(db, user_id)
    )

    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    wins = (
        db.query(func.count(GameResult.id))
        .filter(GameResult.user_id == user_id, GameResult.result == "victory")
        .scalar()
    )
    losses = (
        db.query(func.count(GameResult.id))
        .filter(GameResult.user_id == user_id, GameResult.result == "defeat")
        .scalar()
    )
    friends_count = len(set(get_accepted_friend_ids(db, user_id)))
    wallet_transactions = (
        db.query(func.count(WalletTransaction.id))
        .filter(WalletTransaction.user_id == user_id)
        .scalar()
    )

    progression_rows = (
        db.query(StageProgress)
        .filter(StageProgress.user_id == user_id)
        .all()
    )
    progression_by_difficulty = {
        row.difficulty: int(row.current_stage or 1)
        for row in progression_rows
    }

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "username": user.username,
        "bio": profile.bio,
        "avatar": profile.avatar,
        "is_online": bool(profile.is_online),
        "is_me": viewer_user_id == user_id if viewer_user_id is not None else False,
        "stats": {
            "evaluation_points": get_user_evaluation_points(db, user_id),
            "wallet_transactions": int(wallet_transactions or 0),
            "wins": int(wins or 0),
            "losses": int(losses or 0),
            "friends_count": int(friends_count or 0),
            "unlocked_achievements": list(wallet.unlocked_achievements or []) if wallet else [],
        },
        "progression": [
            {
                "difficulty": difficulty,
                "current_stage": progression_by_difficulty.get(difficulty, 1),
            }
            for difficulty in PROFILE_DIFFICULTIES
        ],
    }
