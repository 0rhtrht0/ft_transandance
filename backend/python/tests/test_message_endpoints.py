from pathlib import Path
import asyncio
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes.messages import (
    get_messages,
    get_unread_messages_count,
    list_conversations,
    mark_conversation_as_read,
    send_message,
)
from app.api.routes import messages as messages_routes
from app.core.database import Base
from app.models.conversation import ConversationParticipant
from app.models.profile import Profile
from app.models.user import User
from app.schemas.message import MessageCreate


@pytest.fixture()
def db_session():
    db_path = PROJECT_ROOT / "test_message_api.db"
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    session.add_all(
        [
            User(id=1, username="neo42", email="neo42@example.com", hashed_password="hashed"),
            User(id=2, username="trinity", email="trinity@example.com", hashed_password="hashed"),
            User(id=3, username="morpheus", email="morpheus@example.com", hashed_password="hashed"),
            Profile(user_id=1, avatar="uploaded_avatars/neo.png", is_online=True),
            Profile(user_id=2, avatar="uploaded_avatars/trinity.png", is_online=False),
        ]
    )
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()


def test_post_message_with_recipient_creates_conversation_and_message(db_session):
    message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="Salut"),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    assert message.sender_id == 1
    assert message.content == "Salut"
    assert message.image_url is None

    participants = (
        db_session.query(ConversationParticipant)
        .filter(ConversationParticipant.conversation_id == message.conversation_id)
        .all()
    )
    participant_ids = sorted(participant.user_id for participant in participants)
    assert participant_ids == [1, 2]


def test_post_message_reuses_existing_direct_conversation(db_session):
    first_message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="hello"),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    second_message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="world"),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    assert first_message.conversation_id == second_message.conversation_id


def test_post_message_updates_sender_read_state_and_receiver_unread_count(db_session):
    first_message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="hello"),
            current_user=SimpleNamespace(id=1, username="neo42"),
            db=db_session,
        )
    )
    asyncio.run(
        send_message(
            payload=MessageCreate(
                conversation_id=first_message.conversation_id,
                content="second",
            ),
            current_user=SimpleNamespace(id=1, username="neo42"),
            db=db_session,
        )
    )

    sender_participation = (
        db_session.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == first_message.conversation_id,
            ConversationParticipant.user_id == 1,
        )
        .first()
    )
    assert sender_participation is not None
    assert sender_participation.last_read_message_id is not None

    receiver_conversations = asyncio.run(
        list_conversations(
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    assert receiver_conversations["conversations"][0]["unread_count"] == 2

    sender_conversations = asyncio.run(
        list_conversations(
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    assert sender_conversations["conversations"][0]["unread_count"] == 0


def test_mark_conversation_read_resets_unread_count(db_session):
    message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="Salut"),
            current_user=SimpleNamespace(id=1, username="neo42"),
            db=db_session,
        )
    )

    unread_before = asyncio.run(
        get_unread_messages_count(
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    assert unread_before["unread_count"] == 1

    read_state = asyncio.run(
        mark_conversation_as_read(
            conversation_id=message.conversation_id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    assert read_state["conversation_id"] == message.conversation_id
    assert read_state["unread_count"] == 0
    assert read_state["last_read_message_id"] == message.id

    unread_after = asyncio.run(
        get_unread_messages_count(
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    assert unread_after["unread_count"] == 0


def test_post_message_notifies_sender_and_recipient(db_session, monkeypatch):
    notifications = []

    async def fake_create_and_push_notification(db, user_id, type_, title, message):
        notifications.append(
            {
                "user_id": user_id,
                "type": type_,
                "title": title,
                "message": message,
            }
        )
        return {"notification": {"type": type_}}

    monkeypatch.setattr(
        messages_routes,
        "create_and_push_notification",
        fake_create_and_push_notification,
    )

    asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="Salut"),
            current_user=SimpleNamespace(id=1, username="neo42"),
            db=db_session,
        )
    )

    assert notifications == [
        {
            "user_id": 2,
            "type": "new_message",
            "title": "Message de neo42",
            "message": "Salut",
        },
        {
            "user_id": 1,
            "type": "message_sent_self",
            "title": "trinity",
            "message": "Salut",
        },
    ]


def test_get_messages_returns_ordered_history(db_session):
    first = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="m1"),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    asyncio.run(
        send_message(
            payload=MessageCreate(
                conversation_id=first.conversation_id,
                content="m2",
            ),
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )

    current_user = db_session.query(User).filter(User.id == 1).first()
    payload = asyncio.run(
        get_messages(
            conversation_id=first.conversation_id,
            current_user=current_user,
            db=db_session,
        )
    )
    messages = payload["messages"]
    assert [message["content"] for message in messages] == ["m1", "m2"]
    assert [message["sender_name"] for message in messages] == ["neo42", "trinity"]
    assert [message["sender_avatar"] for message in messages] == [
        "uploaded_avatars/neo.png",
        "uploaded_avatars/trinity.png",
    ]
    assert [message["image_url"] for message in messages] == [None, None]


def test_post_message_accepts_image_without_text(db_session):
    message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, image_url="uploaded_messages/message_1_test.png"),
            current_user=SimpleNamespace(id=1, username="neo42"),
            db=db_session,
        )
    )

    assert message.sender_id == 1
    assert message.content == ""
    assert message.image_url == "uploaded_messages/message_1_test.png"


def test_get_messages_denies_non_participant(db_session):
    message = asyncio.run(
        send_message(
            payload=MessageCreate(recipient_id=2, content="secret"),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            get_messages(
                conversation_id=message.conversation_id,
                current_user=SimpleNamespace(id=3),
                db=db_session,
            )
        )
    assert exc.value.status_code == 403


def test_post_message_requires_one_target(db_session):
    with pytest.raises(Exception):
        MessageCreate(content="invalid")


def test_post_message_rejects_unknown_recipient(db_session):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            send_message(
                payload=MessageCreate(recipient_id=99, content="Salut"),
                current_user=SimpleNamespace(id=1),
                db=db_session,
            )
        )
    assert exc.value.status_code == 404
