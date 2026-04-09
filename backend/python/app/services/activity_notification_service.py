from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.notification_realtime_service import create_and_push_notification
from app.services.wallet_service import build_achievement_catalog


def _resolve_user_label(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    username = getattr(user, "username", None)
    return username or f"User #{user_id}"


def _resolve_achievement_labels(codes: list[str] | None) -> list[str]:
    if not codes:
        return []
    labels_by_code = {
        entry["code"]: entry["label"]
        for entry in build_achievement_catalog()
        if entry.get("code") and entry.get("label")
    }
    return [labels_by_code.get(code, code) for code in codes]


def _format_points_delta(delta: int | None) -> str:
    normalized = int(delta or 0)
    if normalized > 0:
        return f"+{normalized} EP"
    return f"{normalized} EP"


async def notify_friend_request_rejected(
    db: Session,
    requester_id: int,
    addressee_id: int,
) -> None:
    requester_label = _resolve_user_label(db, requester_id)
    addressee_label = _resolve_user_label(db, addressee_id)

    await create_and_push_notification(
        db=db,
        user_id=requester_id,
        type_="friend_request_rejected",
        title="Friend request",
        message=f"{addressee_label} rejected your friend request.",
    )
    await create_and_push_notification(
        db=db,
        user_id=addressee_id,
        type_="friend_request_rejected_self",
        title=requester_label,
        message=f"You rejected {requester_label}'s friend request.",
    )


async def notify_friend_request_cancelled(
    db: Session,
    requester_id: int,
    addressee_id: int,
) -> None:
    requester_label = _resolve_user_label(db, requester_id)
    addressee_label = _resolve_user_label(db, addressee_id)

    await create_and_push_notification(
        db=db,
        user_id=addressee_id,
        type_="friend_request_cancelled",
        title="Friend request",
        message=f"{requester_label} cancelled the friend request.",
    )
    await create_and_push_notification(
        db=db,
        user_id=requester_id,
        type_="friend_request_cancelled_self",
        title=addressee_label,
        message=f"Friend request to {addressee_label} cancelled.",
    )


async def notify_friendship_removed(
    db: Session,
    actor_id: int,
    other_user_id: int,
) -> None:
    actor_label = _resolve_user_label(db, actor_id)
    other_label = _resolve_user_label(db, other_user_id)

    await create_and_push_notification(
        db=db,
        user_id=actor_id,
        type_="friend_removed_self",
        title=other_label,
        message=f"You removed {other_label} from your friends.",
    )
    await create_and_push_notification(
        db=db,
        user_id=other_user_id,
        type_="friend_removed",
        title="Friend removed",
        message=f"{actor_label} removed you from friends.",
    )


async def notify_game_result_recorded(
    db: Session,
    user_id: int,
    *,
    result: str,
    is_multiplayer: bool,
    stage: int | None,
    difficulty: str | None,
    evaluation_points: int | None,
    wallet_balance: int | None,
    unlocked_achievements: list[str] | None = None,
) -> None:
    normalized_result = str(result or "").strip().lower()
    is_victory = normalized_result == "victory"
    title = "Victory" if is_victory else "Defeat"
    type_ = "game_victory_self" if is_victory else "game_defeat_self"
    mode_label = "Multiplayer" if is_multiplayer else "Solo"

    location_parts = []
    if stage:
        location_parts.append(f"stage {stage}")
    if difficulty:
        location_parts.append(str(difficulty))
    location_label = " · ".join(location_parts)

    message_parts = [f"{mode_label} {title.lower()}"]
    if location_label:
        message_parts.append(location_label)
    message_parts.append(f"Points: {_format_points_delta(evaluation_points)}")
    if wallet_balance is not None:
        message_parts.append(f"Wallet: {int(wallet_balance)} EP")

    achievement_labels = _resolve_achievement_labels(unlocked_achievements)
    if achievement_labels:
        message_parts.append(f"Achievements: {', '.join(achievement_labels)}")

    await create_and_push_notification(
        db=db,
        user_id=user_id,
        type_=type_,
        title=title,
        message=" | ".join(message_parts),
    )
