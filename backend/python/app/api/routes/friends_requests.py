from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.dependencies import get_current_user, get_db
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services.friend_services import get_pending_requests
from app.services.activity_notification_service import (
    notify_friend_request_cancelled,
    notify_friend_request_rejected,
)

from .friends_helpers import _map_friend_error, _serialize_relationship

router = APIRouter()


def _get_request_record(db: Session, request_id: int):
    friendship = db.query(Friendship).filter(Friendship.id == request_id).first()
    if friendship is not None:
        return friendship
    return db.query(FriendRequest).filter(FriendRequest.id == request_id).first()


@router.get(
    "/requests",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def list_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requests = get_pending_requests(db, current_user.id)

    user_cache: dict[int, dict] = {}
    payload = [
        _serialize_relationship(db, friendship, user_cache)
        for friendship in requests
    ]

    return {"requests": payload}


@router.post(
    "/reject/{id}",
    response_model=MessageResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def reject_request(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendship = _get_request_record(db, id)
    if friendship is None:
        raise _map_friend_error(LookupError("Friend request not found"))
    if friendship.addressee_id != current_user.id:
        raise _map_friend_error(PermissionError("Only addressee can reject this request"))
    if friendship.status != "pending":
        raise _map_friend_error(ValueError("Friend request is not pending"))

    requester_id = friendship.requester_id
    addressee_id = friendship.addressee_id
    db.delete(friendship)
    db.commit()
    await notify_friend_request_rejected(
        db=db,
        requester_id=requester_id,
        addressee_id=addressee_id,
    )
    return {"detail": "Friend request rejected"}


@router.post(
    "/cancel/{id}",
    response_model=MessageResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def cancel_request(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    friendship = _get_request_record(db, id)
    if friendship is None:
        raise _map_friend_error(LookupError("Friend request not found"))
    if friendship.requester_id != current_user.id:
        raise _map_friend_error(PermissionError("Only requester can cancel this request"))
    if friendship.status != "pending":
        raise _map_friend_error(ValueError("Friend request is not pending"))

    requester_id = friendship.requester_id
    addressee_id = friendship.addressee_id
    db.delete(friendship)
    db.commit()
    await notify_friend_request_cancelled(
        db=db,
        requester_id=requester_id,
        addressee_id=addressee_id,
    )
    return {"detail": "Friend request cancelled"}
