from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.models.user import User
from app.models.wallet import Wallet


def _normalize_player_ids(player_ids: Iterable[int | str]) -> list[int]:
    normalized: list[int] = []
    seen_ids: set[int] = set()

    for raw_id in player_ids:
        try:
            player_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if player_id <= 0 or player_id in seen_ids:
            continue
        seen_ids.add(player_id)
        normalized.append(player_id)

    return normalized


def build_players_meta(player_ids: Iterable[int | str], db: Session | None = None) -> list[dict]:
    ordered_ids = _normalize_player_ids(player_ids)
    if not ordered_ids:
        return []

    fallback_meta = [
        {
            "id": player_id,
            "username": f"Joueur #{player_id}",
            "avatar": None,
            "avatar_url": None,
            "evaluation_points": 0,
        }
        for player_id in ordered_ids
    ]

    if db is None or not hasattr(db, "query"):
        return fallback_meta

    users_by_id: dict[int, str] = {}
    avatars_by_id: dict[int, str | None] = {}
    evaluation_points_by_id: dict[int, int] = {}

    try:
        user_rows = (
            db.query(User.id, User.username)
            .filter(User.id.in_(ordered_ids))
            .all()
        )
        for user_id, username in user_rows:
            users_by_id[int(user_id)] = username
    except Exception:
        return fallback_meta

    # Avatar lookup is best effort: keep usernames even if avatar storage/query fails.
    try:
        avatar_rows = (
            db.query(Profile.user_id, Profile.avatar)
            .filter(Profile.user_id.in_(ordered_ids))
            .all()
        )
        for user_id, avatar in avatar_rows:
            avatars_by_id[int(user_id)] = avatar
    except Exception:
        avatars_by_id = {}

    try:
        wallet_rows = (
            db.query(Wallet.user_id, Wallet.total_evaluation_points)
            .filter(Wallet.user_id.in_(ordered_ids))
            .all()
        )
        for user_id, total_evaluation_points in wallet_rows:
            evaluation_points_by_id[int(user_id)] = int(total_evaluation_points or 0)
    except Exception:
        evaluation_points_by_id = {}

    return [
        {
            "id": player_id,
            "username": users_by_id.get(player_id) or f"Joueur #{player_id}",
            "avatar": avatars_by_id.get(player_id),
            "avatar_url": avatars_by_id.get(player_id),
            "evaluation_points": int(evaluation_points_by_id.get(player_id, 0)),
        }
        for player_id in ordered_ids
    ]
