from collections import defaultdict
from pathlib import Path
import shutil
import time

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.exceptions import InvalidFilename
from app.dependencies import get_current_user, get_db
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message
from app.models.profile import Profile
from app.models.user import User
from app.realtime.contracts import EVENT_CONVERSATION_MESSAGE_CREATED
from app.realtime.manager import publish_conversation
from app.schemas.message import (
    ConversationReadStateResponse,
    ConversationsListResponse,
    MessageCreate,
    MessageImageUploadResponse,
    MessageResponse,
    MessagesListResponse,
    UnreadMessagesCountResponse,
)
from app.services.message_service import (
    count_total_unread_messages,
    count_unread_messages_for_conversation,
    create_message,
    get_messages_for_conversation,
    mark_conversation_read,
)
from app.services.notification_realtime_service import create_and_push_notification

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _resolve_message_preview(message: Message) -> str:
    if str(message.content or "").strip():
        return message.content
    if message.image_url:
        return "Sent an image."
    return ""


def _resolve_recipient_labels(db: Session, conversation_id: int, sender_id: int) -> list[str]:
    participants = (
        db.query(ConversationParticipant.user_id, User.username)
        .join(User, User.id == ConversationParticipant.user_id)
        .filter(ConversationParticipant.conversation_id == conversation_id)
        .all()
    )

    labels = []
    for participant_id, username in participants:
        if participant_id == sender_id:
            continue
        labels.append(username or f"User #{participant_id}")
    return labels


def _build_self_message_notification_title(recipient_labels: list[str]) -> str:
    labels = [label for label in recipient_labels if str(label or "").strip()]
    if not labels:
        return "Conversation"
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]}, {labels[1]}"
    return f"{labels[0]}, {labels[1]} +{len(labels) - 2}"


def _message_upload_dir() -> Path:
    upload_dir = Path(__file__).resolve().parents[3] / "uploaded_messages"
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _map_message_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=403, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.post(
    "",
    response_model=MessageResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def send_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        message = create_message(
            db=db,
            sender_id=current_user.id,
            content=payload.content,
            image_url=payload.image_url,
            conversation_id=payload.conversation_id,
            recipient_id=payload.recipient_id,
        )
        sender_name = getattr(current_user, "username", None)
        sender_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
        sender_avatar = sender_profile.avatar if sender_profile else None

        realtime_payload = {
            "type": "message",
            "event": EVENT_CONVERSATION_MESSAGE_CREATED,
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender_id": message.sender_id,
            "sender_name": sender_name,
            "sender_avatar": sender_avatar,
            "content": message.content,
            "image_url": message.image_url,
            "timestamp": message.created_at.isoformat() if message.created_at else None,
        }
        await publish_conversation(message.conversation_id, realtime_payload)

        recipients = (
            db.query(ConversationParticipant.user_id)
            .filter(ConversationParticipant.conversation_id == message.conversation_id)
            .all()
        )
        for recipient in recipients:
            if recipient.user_id == current_user.id:
                continue
            await create_and_push_notification(
                db=db,
                user_id=recipient.user_id,
                type_="new_message",
                title=f"Message de {sender_name or 'Unknown'}",
                message=_resolve_message_preview(message),
            )

        recipient_labels = _resolve_recipient_labels(db, message.conversation_id, current_user.id)
        await create_and_push_notification(
            db=db,
            user_id=current_user.id,
            type_="message_sent_self",
            title=_build_self_message_notification_title(recipient_labels),
            message=_resolve_message_preview(message),
        )

        return message
    except (LookupError, PermissionError, ValueError) as exc:
        raise _map_message_error(exc)


@router.post(
    "/uploads",
    response_model=MessageImageUploadResponse,
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def upload_message_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file.content_type:
        # Default to octet-stream if unknown
        pass

    filename = Path(file.filename or "").name
    if not filename:
        raise InvalidFilename()

    upload_dir = _message_upload_dir()
    stored_filename = f"message_{current_user.id}_{time.time_ns()}_{filename}"
    disk_path = upload_dir / stored_filename
    with disk_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "image_url": f"uploaded_messages/{stored_filename}",
        "detail": "Image uploaded",
    }


@router.get(
    "/conversations",
    response_model=ConversationsListResponse,
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation_rows = (
        db.query(Conversation)
        .join(ConversationParticipant)
        .filter(ConversationParticipant.user_id == current_user.id)
        .all()
    )

    conversation_ids = [conversation.id for conversation in conversation_rows]
    if not conversation_ids:
        return {"conversations": []}

    participant_rows = (
        db.query(ConversationParticipant, User, Profile)
        .join(User, User.id == ConversationParticipant.user_id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .filter(ConversationParticipant.conversation_id.in_(conversation_ids))
        .all()
    )

    participants_total_count: dict[int, int] = defaultdict(int)
    other_participants: dict[int, list[dict]] = defaultdict(list)

    for participation, user, profile in participant_rows:
        participants_total_count[participation.conversation_id] += 1
        if user.id == current_user.id:
            continue
        other_participants[participation.conversation_id].append(
            {
                "id": user.id,
                "username": user.username,
                "avatar": profile.avatar if profile else None,
                "is_online": profile.is_online if profile else None,
                "last_seen": getattr(profile, "last_seen", None),
            }
        )

    conversations_payload = []
    for conversation in conversation_rows:
        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .first()
        )

        last_message_payload = None
        updated_at = conversation.created_at
        if last_message:
            sender = db.query(User).filter(User.id == last_message.sender_id).first()
            last_message_payload = {
                "id": last_message.id,
                "conversation_id": last_message.conversation_id,
                "sender_id": last_message.sender_id,
                "sender_name": sender.username if sender else None,
                "content": last_message.content,
                "image_url": last_message.image_url,
                "created_at": last_message.created_at,
            }
            updated_at = last_message.created_at

        total_count = participants_total_count.get(conversation.id, 0)
        conversation_type = "direct" if total_count <= 2 else "room"
        unread_count = count_unread_messages_for_conversation(
            db,
            conversation.id,
            current_user.id,
        )

        conversations_payload.append(
            {
                "id": conversation.id,
                "type": conversation_type,
                "name": None,
                "participants": other_participants.get(conversation.id, []),
                "participants_count": total_count,
                "last_message": last_message_payload,
                "updated_at": updated_at,
                "unread_count": unread_count,
            }
        )

    conversations_payload.sort(key=lambda item: item["updated_at"], reverse=True)
    return {"conversations": conversations_payload}


@router.get(
    "/unread-count",
    response_model=UnreadMessagesCountResponse,
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def get_unread_messages_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"unread_count": count_total_unread_messages(db, current_user.id)}


@router.patch(
    "/conversations/{conversation_id}/read",
    response_model=ConversationReadStateResponse,
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def mark_conversation_as_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return mark_conversation_read(db, conversation_id, current_user.id)
    except (LookupError, PermissionError, ValueError) as exc:
        raise _map_message_error(exc)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessagesListResponse,
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def get_messages(
    conversation_id: int,
    limit: int = Query(default=100, ge=1, le=200),
    before_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        if not isinstance(before_id, int):
            before_id = None
        messages = get_messages_for_conversation(
            db=db,
            conversation_id=conversation_id,
            user_id=current_user.id,
            before_id=before_id,
        )
        if not isinstance(limit, int):
            limit = 100
        
        # Take the most recent messages from the results
        messages = messages[-limit:]
        if not isinstance(current_user, User):
            return messages
        sender_ids = {message.sender_id for message in messages}
        if sender_ids:
            users = db.query(User).filter(User.id.in_(sender_ids)).all()
            sender_map = {user.id: user.username for user in users}
            profiles = db.query(Profile).filter(Profile.user_id.in_(sender_ids)).all()
            sender_avatar_map = {profile.user_id: profile.avatar for profile in profiles}
        else:
            sender_map = {}
            sender_avatar_map = {}

        payload = [
            {
                "id": message.id,
                "conversation_id": message.conversation_id,
                "sender_id": message.sender_id,
                "sender_name": sender_map.get(message.sender_id),
                "sender_avatar": sender_avatar_map.get(message.sender_id),
                "content": message.content,
                "image_url": message.image_url,
                "created_at": message.created_at,
            }
            for message in messages
        ]
        return {"messages": payload}
    except (LookupError, PermissionError, ValueError) as exc:
        raise _map_message_error(exc)
