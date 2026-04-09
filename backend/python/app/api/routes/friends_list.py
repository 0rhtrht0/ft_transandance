from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.dependencies import get_current_user, get_db
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services.activity_notification_service import notify_friendship_removed
from app.services.friend_services import (
    delete_friend,
    delete_friendship_record,
    find_relationship_between_users,
    get_friends,
    get_pending_requests,
)

from .friends_helpers import _map_friend_error, _serialize_relationship, _serialize_user

router = APIRouter()


def _get_relationship_record_by_id(db: Session, relationship_id: int):
    friendship = db.query(Friendship).filter(Friendship.id == relationship_id).first()
    if friendship is not None:
        return friendship
    return db.query(FriendRequest).filter(FriendRequest.id == relationship_id).first()


@router.delete(
    "/{friend_id}",
    response_model=MessageResponse,
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def remove_friend(
    friend_id: int | None = None,
    id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_id = friend_id if friend_id is not None else id
    if resolved_id is None:
        raise HTTPException(status_code=400, detail="Friend id is required")
    friendship = find_relationship_between_users(
        db,
        current_user.id,
        resolved_id,
        statuses="accepted",
    )
    target_record = friendship if friendship is not None else _get_relationship_record_by_id(db, resolved_id)
    if target_record is None:
        raise _map_friend_error(LookupError("Friend request not found"))
    other_user_id = (
        target_record.addressee_id
        if target_record.requester_id == current_user.id
        else target_record.requester_id
    )
    try:
        if friendship:
            delete_friendship_record(db, friendship, current_user_id=current_user.id)
        else:
            delete_friend(db, friendship_id=resolved_id, current_user_id=current_user.id)
    except (LookupError, PermissionError, ValueError) as exc:
        raise _map_friend_error(exc)

    await notify_friendship_removed(
        db=db,
        actor_id=current_user.id,
        other_user_id=other_user_id,
    )
    return {"detail": "Friend removed"}


@router.get(
    "/",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendships = get_friends(db, user_id=current_user.id)
    user_cache: dict[int, dict] = {}
    friends_payload = []
    for friendship in friendships:
        friend_id = (
            friendship.addressee_id
            if friendship.requester_id == current_user.id
            else friendship.requester_id
        )
        friends_payload.append(_serialize_user(db, friend_id, user_cache))

    return {"friends": friends_payload}


@router.get(
    "/summary",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def friends_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendships = get_friends(db, user_id=current_user.id)
    pending_requests = get_pending_requests(db, user_id=current_user.id)

    user_cache: dict[int, dict] = {}
    friends_payload = []
    for friendship in friendships:
        friend_id = (
            friendship.addressee_id
            if friendship.requester_id == current_user.id
            else friendship.requester_id
        )
        friends_payload.append(_serialize_user(db, friend_id, user_cache))

    requests_payload = [
        _serialize_relationship(db, request, user_cache)
        for request in pending_requests
    ]
    pending_incoming = [
        request
        for request in requests_payload
        if request.get("addressee_id") == current_user.id
    ]
    pending_outgoing = [
        request
        for request in requests_payload
        if request.get("requester_id") == current_user.id
    ]

    return {
        "friends": friends_payload,
        "requests": requests_payload,
        "counts": {
            "friends": len(friends_payload),
            "online": sum(1 for friend in friends_payload if friend.get("is_online")),
            "pending_incoming": len(pending_incoming),
            "pending_outgoing": len(pending_outgoing),
        },
    }
