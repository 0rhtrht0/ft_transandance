from datetime import datetime
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidCredentials
from app.core.security import extract_bearer_token, extract_cookie_token, get_user_from_token
from app.dependencies import get_db
from app.models.conversation import ConversationParticipant
from app.models.user import User
from app.realtime.contracts import (
    EVENT_CONVERSATION_MESSAGE_CREATED,
)
from app.realtime.manager import (
    connect_user,
    disconnect_user,
    join_conversation,
    leave_conversation,
    publish_conversation,
)
from app.realtime.presence import notify_offline, notify_online, set_online
from app.services.message_service import create_message
from app.services.notification_realtime_service import create_and_push_notification

router = APIRouter(tags=["realtime"])
logger = logging.getLogger(__name__)


def _extract_ws_tokens(websocket: WebSocket) -> list[str]:
    tokens = []
    for candidate in (
        extract_bearer_token(websocket.headers.get("Authorization")),
        websocket.query_params.get("token"),
        extract_cookie_token(websocket),
    ):
        if candidate and candidate not in tokens:
            tokens.append(candidate)
    return tokens


def _load_conversation_ids(db: Session, user_id: int) -> list[int]:
    return [
        row.conversation_id
        for row in db.query(ConversationParticipant)
        .filter(ConversationParticipant.user_id == user_id)
        .all()
    ]


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


async def _handle_chat_message(user_id: int, data: dict, db: Session) -> None:
    conversation_id = data.get("conversation_id")
    content = data.get("content")
    if conversation_id is None or not content:
        logger.debug("ws chat ignored: missing fields", extra={"user_id": user_id})
        return

    try:
        conversation_id = int(conversation_id)
    except (TypeError, ValueError):
        logger.debug(
            "ws chat ignored: invalid conversation_id",
            extra={"user_id": user_id, "conversation_id": conversation_id},
        )
        return

    try:
        message = create_message(
            db=db,
            sender_id=user_id,
            content=content,
            conversation_id=conversation_id,
        )
    except (LookupError, PermissionError, ValueError):
        logger.warning(
            "ws chat create_message rejected",
            extra={"user_id": user_id, "conversation_id": conversation_id},
        )
        return

    sender = db.query(User).filter(User.id == user_id).first()
    sender_name = sender.username if sender else None

    message_payload = {
        "type": "message",
        "event": EVENT_CONVERSATION_MESSAGE_CREATED,
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "sender_name": sender_name,
        "content": message.content,
        "timestamp": message.created_at.isoformat(),
    }

    await publish_conversation(conversation_id, message_payload)
    logger.info(
        "ws conversation message published",
        extra={"user_id": user_id, "conversation_id": conversation_id, "message_id": message.id},
    )

    participants = (
        db.query(ConversationParticipant.user_id)
        .filter(ConversationParticipant.conversation_id == conversation_id)
        .all()
    )
    for participant in participants:
        if participant.user_id == user_id:
            continue

        title = f"New message from {sender_name or 'Unknown'}"
        await create_and_push_notification(
            db=db,
            user_id=participant.user_id,
            type_="new_message",
            title=title,
            message=content,
        )

    await create_and_push_notification(
        db=db,
        user_id=user_id,
        type_="message_sent_self",
        title=_build_self_message_notification_title(
            _resolve_recipient_labels(db, conversation_id, user_id)
        ),
        message=content,
    )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    tokens = _extract_ws_tokens(websocket)
    if not tokens:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning("ws connect rejected: missing token")
        return

    current_user = None
    for token in tokens:
        try:
            current_user = get_user_from_token(token, db)
            break
        except InvalidCredentials:
            continue

    if current_user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning("ws connect rejected: invalid token")
        return

    user_id = current_user.id
    await connect_user(user_id, websocket)
    logger.info("ws connected", extra={"user_id": user_id})
    set_online(db, user_id, True)
    await notify_online(db, user_id, current_user.username)

    for conversation_id in _load_conversation_ids(db, user_id):
        join_conversation(user_id, conversation_id)

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat":
                await _handle_chat_message(user_id, data, db)
            elif message_type == "subscribe_conversation":
                conversation_id = data.get("conversation_id")
                if conversation_id is not None:
                    try:
                        join_conversation(user_id, int(conversation_id))
                        logger.info(
                            "ws subscribe conversation",
                            extra={"user_id": user_id, "conversation_id": int(conversation_id)},
                        )
                    except (TypeError, ValueError):
                        logger.debug(
                            "ws subscribe ignored: invalid conversation_id",
                            extra={"user_id": user_id, "conversation_id": conversation_id},
                        )
                        pass
            elif message_type == "unsubscribe_conversation":
                conversation_id = data.get("conversation_id")
                if conversation_id is not None:
                    try:
                        leave_conversation(user_id, int(conversation_id))
                        logger.info(
                            "ws unsubscribe conversation",
                            extra={"user_id": user_id, "conversation_id": int(conversation_id)},
                        )
                    except (TypeError, ValueError):
                        logger.debug(
                            "ws unsubscribe ignored: invalid conversation_id",
                            extra={"user_id": user_id, "conversation_id": conversation_id},
                        )
                        pass
            elif message_type == "heartbeat":
                await websocket.send_json(
                    {"type": "pong", "timestamp": datetime.utcnow().isoformat()}
                )
            else:
                logger.debug(
                    "ws message ignored: unknown type",
                    extra={"user_id": user_id, "message_type": message_type},
                )
    except WebSocketDisconnect:
        logger.info("ws disconnected", extra={"user_id": user_id})
    finally:
        disconnect_user(user_id)
        set_online(db, user_id, False)
        await notify_offline(db, user_id, current_user.username)
