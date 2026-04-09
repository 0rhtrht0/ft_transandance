from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship


def _get_friendship_by_id(db: Session, friendship_id: int) -> Friendship:
    friendship = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if friendship is None:
        raise LookupError("Friend request not found")
    return friendship


def _table_exists(db: Session, table_name: str) -> bool:
    bind = db.get_bind()
    if bind is None:
        return False
    return inspect(bind).has_table(table_name)


def _normalize_statuses(
    statuses: str | set[str] | list[str] | tuple[str, ...] | None = None,
) -> set[str] | None:
    if statuses is None:
        return None
    if isinstance(statuses, str):
        return {statuses}
    return {status for status in statuses if status}


def _sort_relationships(rows):
    return sorted(
        rows,
        key=lambda row: (
            getattr(getattr(row, "created_at", None), "isoformat", lambda: "")(),
            getattr(row, "id", 0),
        ),
        reverse=True,
    )


def _merge_relationships(*relationship_groups):
    merged = {}
    for relationships in relationship_groups:
        for relationship in relationships:
            key = tuple(
                sorted((relationship.requester_id, relationship.addressee_id))
            )
            merged.setdefault(key, relationship)
    return _sort_relationships(merged.values())


def _query_legacy_friend_requests(
    db: Session,
    user_id: int,
    statuses: str | set[str] | list[str] | tuple[str, ...] | None = None,
):
    if not _table_exists(db, FriendRequest.__tablename__):
        return []

    query = (
        db.query(FriendRequest)
        .filter(
            (FriendRequest.requester_id == user_id)
            | (FriendRequest.addressee_id == user_id)
        )
    )
    normalized_statuses = _normalize_statuses(statuses)
    if normalized_statuses:
        query = query.filter(FriendRequest.status.in_(normalized_statuses))
    return query.all()


def get_friends(db: Session, user_id: int):
    modern_friendships = (
        db.query(Friendship)
        .filter(
            (Friendship.requester_id == user_id) | (Friendship.addressee_id == user_id)
        )
        .filter(Friendship.status == "accepted")
        .all()
    )
    legacy_friendships = _query_legacy_friend_requests(db, user_id, statuses="accepted")
    return _merge_relationships(
        _sort_relationships(modern_friendships),
        _sort_relationships(legacy_friendships),
    )


def get_pending_requests(db: Session, user_id: int):
    modern_requests = (
        db.query(Friendship)
        .filter(
            (Friendship.requester_id == user_id) | (Friendship.addressee_id == user_id)
        )
        .filter(Friendship.status == "pending")
        .all()
    )
    legacy_requests = _query_legacy_friend_requests(db, user_id, statuses="pending")
    return _merge_relationships(
        _sort_relationships(modern_requests),
        _sort_relationships(legacy_requests),
    )


def find_relationship_between_users(
    db: Session,
    user_a_id: int,
    user_b_id: int,
    *,
    statuses: str | set[str] | list[str] | tuple[str, ...] | None = None,
):
    query = db.query(Friendship).filter(
        (
            (Friendship.requester_id == user_a_id)
            & (Friendship.addressee_id == user_b_id)
        )
        | (
            (Friendship.requester_id == user_b_id)
            & (Friendship.addressee_id == user_a_id)
        )
    )

    normalized_statuses = _normalize_statuses(statuses)
    if normalized_statuses:
        query = query.filter(Friendship.status.in_(normalized_statuses))

    friendship = (
        query.order_by(Friendship.created_at.desc(), Friendship.id.desc()).first()
    )
    if friendship is not None:
        return friendship

    if not _table_exists(db, FriendRequest.__tablename__):
        return None

    legacy_query = db.query(FriendRequest).filter(
        (
            (FriendRequest.requester_id == user_a_id)
            & (FriendRequest.addressee_id == user_b_id)
        )
        | (
            (FriendRequest.requester_id == user_b_id)
            & (FriendRequest.addressee_id == user_a_id)
        )
    )
    if normalized_statuses:
        legacy_query = legacy_query.filter(FriendRequest.status.in_(normalized_statuses))
    return legacy_query.order_by(
        FriendRequest.created_at.desc(),
        FriendRequest.id.desc(),
    ).first()


def get_accepted_friend_ids(db: Session, user_id: int) -> list[int]:
    friendships = get_friends(db, user_id)
    friend_ids: list[int] = []
    for friendship in friendships:
        if friendship.requester_id == user_id:
            friend_ids.append(friendship.addressee_id)
        else:
            friend_ids.append(friendship.requester_id)
    return friend_ids
