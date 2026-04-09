from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.dependencies import get_current_user, get_db
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friend import FriendRequestCreate, FriendshipResponse
from app.services.friend_services import accept_friend_request, send_friend_request
from app.services.notification_realtime_service import create_and_push_notification

from .friends_helpers import _map_friend_error, _resolve_username

router = APIRouter()


def _resolve_user_label(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    username = getattr(user, "username", None)
    return username or f"User #{user_id}"


def _get_accept_target(db: Session, request_id: int):
    friendship = db.query(Friendship).filter(Friendship.id == request_id).first()
    if friendship is not None:
        return friendship
    return db.query(FriendRequest).filter(FriendRequest.id == request_id).first()


@router.post(
    "/request",
    response_model=FriendshipResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def request_friend(
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        friendship = send_friend_request(
            db,
            requester_id=current_user.id,
            addressee_id=payload.user_id,
        )
        username = _resolve_username(db, current_user)
        await create_and_push_notification(
            db=db,
            user_id=friendship.addressee_id,
            type_="friend_request_received",
            title="Demande d'ami",
            message=f"{username} vous a envoyé une demande.",
        )
        target_username = _resolve_user_label(db, friendship.addressee_id)
        await create_and_push_notification(
            db=db,
            user_id=current_user.id,
            type_="friend_request_sent_self",
            title=target_username,
            message=f"Friend request sent to {target_username}.",
        )
        return friendship
    except (LookupError, PermissionError, ValueError) as exc:
        raise _map_friend_error(exc)


@router.post(
    "/{id}/accept",
    response_model=FriendshipResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
@router.post(
    "/accept/{id}",
    response_model=FriendshipResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def accept_friend(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        legacy_request = _get_accept_target(db, id)
        if legacy_request is None:
            raise LookupError("Friend request not found")

        if isinstance(legacy_request, Friendship):
            friendship = accept_friend_request(db, friendship_id=id, current_user_id=current_user.id)
        else:
            if legacy_request.addressee_id != current_user.id:
                raise PermissionError("Only addressee can accept this friend request")
            if legacy_request.status != "pending":
                raise ValueError("Friend request is not pending")
            legacy_request.status = "accepted"
            db.commit()
            db.refresh(legacy_request)
            friendship = legacy_request

        username = _resolve_username(db, current_user)
        
        await create_and_push_notification(
            db=db,
            user_id=friendship.requester_id,
            type_="friend_request_accepted",
            title="Demande d'ami",
            message=f"{username} a accepté votre demande.",
        )
        requester_username = _resolve_user_label(db, friendship.requester_id)
        await create_and_push_notification(
            db=db,
            user_id=current_user.id,
            type_="friend_request_accepted_self",
            title=requester_username,
            message=f"{requester_username} is now your friend.",
        )
        return friendship
    except (LookupError, PermissionError, ValueError) as exc:
        raise _map_friend_error(exc)
