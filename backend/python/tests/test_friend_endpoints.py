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

from app.api.routes import friends as friends_routes
from app.api.routes import friends_request_actions as friends_request_actions_routes
from app.api.routes import friends_list as friends_list_routes
from app.api.routes import friends_requests as friends_requests_routes
from app.core.database import Base
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friend import FriendRequestCreate


@pytest.fixture()
def db_session():
    db_path = PROJECT_ROOT / "test_friend_api.db"
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


def test_request_friend_creates_pending_friendship(db_session):
    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    assert friendship.requester_id == 1
    assert friendship.addressee_id == 2
    assert friendship.status == "pending"


def test_request_friend_rejects_self_request(db_session):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            friends_routes.request_friend(
                payload=FriendRequestCreate(user_id=1),
                current_user=SimpleNamespace(id=1),
                db=db_session,
            )
        )
    assert exc.value.status_code == 400


def test_accept_friend_requires_addressee(db_session):
    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            friends_routes.accept_friend(
                id=friendship.id,
                current_user=SimpleNamespace(id=3),
                db=db_session,
            )
        )
    assert exc.value.status_code == 403


def test_accept_friend_updates_status(db_session):
    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    accepted = asyncio.run(
        friends_routes.accept_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    assert accepted.status == "accepted"


def test_remove_friend_requires_participation(db_session):
    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.accept_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            friends_routes.remove_friend(
                id=friendship.id,
                current_user=SimpleNamespace(id=3),
                db=db_session,
            )
        )
    assert exc.value.status_code == 403


def test_remove_friend_deletes_relationship(db_session):
    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.accept_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )

    result = asyncio.run(
        friends_routes.remove_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    assert result["detail"] == "Friend removed"
    assert (
        db_session.query(Friendship).filter(Friendship.id == friendship.id).first()
        is None
    )


def test_list_friends_returns_only_accepted_relationships(db_session):
    accepted = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.accept_friend(
            id=accepted.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=3),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    payload = asyncio.run(
        friends_routes.list_friends(current_user=SimpleNamespace(id=1), db=db_session)
    )
    assert len(payload["friends"]) == 1
    assert payload["friends"][0]["id"] == 2
    assert payload["friends"][0]["username"] == "trinity"


def test_list_friends_includes_legacy_accepted_friend_requests(db_session):
    db_session.add(
        FriendRequest(
            requester_id=1,
            addressee_id=2,
            status="accepted",
        )
    )
    db_session.commit()

    payload = asyncio.run(
        friends_routes.list_friends(current_user=SimpleNamespace(id=1), db=db_session)
    )
    assert len(payload["friends"]) == 1
    assert payload["friends"][0]["id"] == 2
    assert payload["friends"][0]["username"] == "trinity"


def test_remove_friend_deletes_legacy_accepted_friend_request(db_session):
    db_session.add(
        FriendRequest(
            requester_id=1,
            addressee_id=2,
            status="accepted",
        )
    )
    db_session.commit()

    result = asyncio.run(
        friends_routes.remove_friend(
            friend_id=2,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert result["detail"] == "Friend removed"
    assert (
        db_session.query(FriendRequest)
        .filter(
            FriendRequest.requester_id == 1,
            FriendRequest.addressee_id == 2,
            FriendRequest.status == "accepted",
        )
        .first()
        is None
    )


def test_list_requests_includes_legacy_pending_friend_requests(db_session):
    db_session.add(
        FriendRequest(
            requester_id=3,
            addressee_id=1,
            status="pending",
        )
    )
    db_session.commit()

    payload = asyncio.run(
        friends_routes.list_requests(current_user=SimpleNamespace(id=1), db=db_session)
    )

    assert len(payload["requests"]) == 1
    assert payload["requests"][0]["requester"]["username"] == "morpheus"
    assert payload["requests"][0]["addressee"]["username"] == "neo42"


def test_friends_summary_returns_coherent_friends_requests_and_counts(db_session):
    accepted = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.accept_friend(
            id=accepted.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=3),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    payload = asyncio.run(
        friends_routes.friends_summary(current_user=SimpleNamespace(id=1), db=db_session)
    )

    assert payload["counts"] == {
        "friends": 1,
        "online": 0,
        "pending_incoming": 0,
        "pending_outgoing": 1,
    }
    assert len(payload["friends"]) == 1
    assert payload["friends"][0]["username"] == "trinity"
    assert len(payload["requests"]) == 1
    assert payload["requests"][0]["addressee"]["username"] == "morpheus"


def test_request_friend_sends_notifications_to_addressee_and_requester(db_session, monkeypatch):
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
        friends_request_actions_routes,
        "create_and_push_notification",
        fake_create_and_push_notification,
    )

    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    assert notifications == [
        {
            "user_id": 2,
            "type": "friend_request_received",
            "title": "Demande d'ami",
            "message": "neo42 vous a envoyé une demande.",
        },
        {
            "user_id": 1,
            "type": "friend_request_sent_self",
            "title": "trinity",
            "message": "Friend request sent to trinity.",
        },
    ]
    assert friendship.id is not None


def test_accept_friend_sends_notifications_to_requester_and_acceptor(db_session, monkeypatch):
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
        friends_request_actions_routes,
        "create_and_push_notification",
        fake_create_and_push_notification,
    )

    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    notifications.clear()

    asyncio.run(
        friends_routes.accept_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    assert notifications == [
        {
            "user_id": 1,
            "type": "friend_request_accepted",
            "title": "Demande d'ami",
            "message": "trinity a accepté votre demande.",
        },
        {
            "user_id": 2,
            "type": "friend_request_accepted_self",
            "title": "neo42",
            "message": "neo42 is now your friend.",
        },
    ]
    assert friendship.id is not None


def test_reject_request_sends_notifications_to_both_users(db_session, monkeypatch):
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
        "app.services.activity_notification_service.create_and_push_notification",
        fake_create_and_push_notification,
    )

    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    notifications.clear()

    result = asyncio.run(
        friends_requests_routes.reject_request(
            id=friendship.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )

    assert result["detail"] == "Friend request rejected"
    assert notifications == [
        {
            "user_id": 1,
            "type": "friend_request_rejected",
            "title": "Friend request",
            "message": "trinity rejected your friend request.",
        },
        {
            "user_id": 2,
            "type": "friend_request_rejected_self",
            "title": "neo42",
            "message": "You rejected neo42's friend request.",
        },
    ]


def test_cancel_request_sends_notifications_to_both_users(db_session, monkeypatch):
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
        "app.services.activity_notification_service.create_and_push_notification",
        fake_create_and_push_notification,
    )

    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    notifications.clear()

    result = asyncio.run(
        friends_requests_routes.cancel_request(
            id=friendship.id,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert result["detail"] == "Friend request cancelled"
    assert notifications == [
        {
            "user_id": 2,
            "type": "friend_request_cancelled",
            "title": "Friend request",
            "message": "neo42 cancelled the friend request.",
        },
        {
            "user_id": 1,
            "type": "friend_request_cancelled_self",
            "title": "trinity",
            "message": "Friend request to trinity cancelled.",
        },
    ]


def test_remove_friend_sends_notifications_to_both_users(db_session, monkeypatch):
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
        "app.services.activity_notification_service.create_and_push_notification",
        fake_create_and_push_notification,
    )

    friendship = asyncio.run(
        friends_routes.request_friend(
            payload=FriendRequestCreate(user_id=2),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )
    asyncio.run(
        friends_routes.accept_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=2),
            db=db_session,
        )
    )
    notifications.clear()

    result = asyncio.run(
        friends_list_routes.remove_friend(
            id=friendship.id,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert result["detail"] == "Friend removed"
    assert notifications == [
        {
            "user_id": 1,
            "type": "friend_removed_self",
            "title": "trinity",
            "message": "You removed trinity from your friends.",
        },
        {
            "user_id": 2,
            "type": "friend_removed",
            "title": "Friend removed",
            "message": "neo42 removed you from friends.",
        },
    ]
