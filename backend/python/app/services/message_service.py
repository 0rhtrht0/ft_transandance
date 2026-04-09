from sqlalchemy.orm import Session

from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message
from app.models.user import User


def _require_user_exists(db: Session, user_id: int) -> None:
    if db.query(User).filter(User.id == user_id).first() is None:
        raise LookupError("User not found")


def _require_conversation_access(db: Session, conversation_id: int, user_id: int) -> None:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise LookupError("Conversation not found")

    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        .first()
    )
    if participant is None:
        raise PermissionError("Access denied to this conversation")


def _get_conversation_participant(
    db: Session,
    conversation_id: int,
    user_id: int,
) -> ConversationParticipant:
    _require_conversation_access(db, conversation_id, user_id)
    participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        .first()
    )
    if participant is None:
        raise PermissionError("Access denied to this conversation")
    return participant


def get_or_create_direct_conversation(
    db: Session,
    user_a_id: int,
    user_b_id: int,
) -> Conversation:
    if user_a_id == user_b_id:
        raise ValueError("Cannot create a conversation with yourself")

    _require_user_exists(db, user_b_id)

    candidate_participations = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.user_id == user_a_id)
        .all()
    )
    for participation in candidate_participations:
        participants = (
            db.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversation_id == participation.conversation_id
            )
            .all()
        )
        participant_ids = sorted(p.user_id for p in participants)
        if participant_ids == sorted([user_a_id, user_b_id]):
            conversation = (
                db.query(Conversation)
                .filter(Conversation.id == participation.conversation_id)
                .first()
            )
            if conversation:
                return conversation

    conversation = Conversation()
    db.add(conversation)
    db.flush()

    db.add_all(
        [
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=user_a_id,
            ),
            ConversationParticipant(
                conversation_id=conversation.id,
                user_id=user_b_id,
            ),
        ]
    )
    db.commit()
    db.refresh(conversation)
    return conversation


def create_message(
    db: Session,
    sender_id: int,
    content: str | None,
    image_url: str | None = None,
    conversation_id: int | None = None,
    recipient_id: int | None = None,
) -> Message:
    normalized_content = str(content or "").strip()
    normalized_image_url = str(image_url or "").strip() or None

    if not normalized_content and not normalized_image_url:
        raise ValueError("Provide message content or an image")

    if conversation_id is None and recipient_id is None:
        raise ValueError("Either conversation_id or recipient_id must be provided")

    if conversation_id is not None:
        _require_conversation_access(db, conversation_id, sender_id)
        target_conversation_id = conversation_id
    else:
        conversation = get_or_create_direct_conversation(
            db,
            user_a_id=sender_id,
            user_b_id=recipient_id,  # type: ignore[arg-type]
        )
        target_conversation_id = conversation.id

    message = Message(
        conversation_id=target_conversation_id,
        sender_id=sender_id,
        content=normalized_content,
        image_url=normalized_image_url,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    sender_participant = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == target_conversation_id,
            ConversationParticipant.user_id == sender_id,
        )
        .first()
    )
    if sender_participant is not None:
        sender_participant.last_read_message_id = message.id
        db.commit()

    return message


def get_messages_for_conversation(
    db: Session,
    conversation_id: int,
    user_id: int,
    before_id: int | None = None,
) -> list[Message]:
    _require_conversation_access(db, conversation_id, user_id)
    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    
    if before_id is not None:
        query = query.filter(Message.id < before_id)
        
    return (
        query.order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )


def count_unread_messages_for_conversation(
    db: Session,
    conversation_id: int,
    user_id: int,
) -> int:
    participant = _get_conversation_participant(db, conversation_id, user_id)
    last_read_message_id = int(participant.last_read_message_id or 0)

    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .filter(Message.sender_id != user_id)
        .filter(Message.id > last_read_message_id)
        .count()
    )


def mark_conversation_read(
    db: Session,
    conversation_id: int,
    user_id: int,
) -> dict:
    participant = _get_conversation_participant(db, conversation_id, user_id)
    latest_message = (
        db.query(Message.id)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .first()
    )
    latest_message_id = latest_message.id if latest_message else None
    participant.last_read_message_id = latest_message_id
    db.commit()
    db.refresh(participant)

    return {
        "conversation_id": conversation_id,
        "unread_count": 0,
        "last_read_message_id": latest_message_id,
    }


def count_total_unread_messages(db: Session, user_id: int) -> int:
    participations = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.user_id == user_id)
        .all()
    )

    total = 0
    for participation in participations:
        total += count_unread_messages_for_conversation(
            db,
            participation.conversation_id,
            user_id,
        )
    return total
