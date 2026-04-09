from pathlib import Path
import asyncio
from datetime import datetime, timedelta, timezone
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes import auth as auth_routes
from app.api.routes import auth_login as auth_login_routes
from app.realtime import presence as presence_routes
from app.api.routes.auth_tokens import build_access_token, set_access_cookie
from app.core.config import settings
from app.core.database import Base
from app.core.security import get_current_user, get_user_from_token, hash_password
from app.models.friendship import Friendship
from app.models.profile import Profile
from app.models.user import User
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest


@pytest.fixture(autouse=True)
def reset_login_rate_limit_state():
    auth_routes.reset_login_rate_limit_state()
    try:
        yield
    finally:
        auth_routes.reset_login_rate_limit_state()


@pytest.fixture()
def db_session():
    db_path = PROJECT_ROOT / "test_auth_notifications.db"
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    session.add_all(
        [
            User(
                id=1,
                username="neo42",
                email="neo42@example.com",
                hashed_password=hash_password("Password123!"),
            ),
            User(
                id=2,
                username="trinity",
                email="trinity@example.com",
                hashed_password=hash_password("Password123!"),
            ),
            Profile(user_id=1, is_online=False),
            Profile(user_id=2, is_online=False),
            Friendship(requester_id=1, addressee_id=2, status="accepted"),
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


def test_login_emits_friend_online_notification(db_session, monkeypatch):
    notifications = []

    async def fake_notify_online(db, user_id, username):
        notifications.append({"db": db, "user_id": user_id, "username": username})

    monkeypatch.setattr(auth_login_routes, "notify_online", fake_notify_online)

    result = asyncio.run(
        auth_routes.login(
            form_data=SimpleNamespace(username="neo42", password="Password123!"),
            db=db_session,
            request=SimpleNamespace(client=SimpleNamespace(host="tests")),
        )
    )

    assert "access_token" in result
    assert result["token_type"] == "bearer"
    assert len(notifications) == 1

    call = notifications[0]
    assert call["user_id"] == 1
    assert call["username"] == "neo42"


@pytest.mark.parametrize(
    ("notify_fn_name", "expected_type", "expected_message"),
    [
        ("notify_online", "presence.online", "neo42 is now online."),
        ("notify_offline", "presence.offline", "neo42 is now offline."),
    ],
)
def test_presence_events_are_persisted_as_notifications(
    db_session, monkeypatch, notify_fn_name, expected_type, expected_message
):
    realtime_payloads = []
    persisted_notifications = []

    async def fake_send_to_user(user_id, payload):
        realtime_payloads.append((user_id, payload))
        return True

    async def fake_create_and_push_notification(db, user_id, type_, title, message):
        persisted_notifications.append(
            {
                "db": db,
                "user_id": user_id,
                "type": type_,
                "title": title,
                "message": message,
            }
        )
        return {"notification": {"type": type_}}

    monkeypatch.setattr(presence_routes, "send_to_user", fake_send_to_user)
    monkeypatch.setattr(presence_routes, "create_and_push_notification", fake_create_and_push_notification)

    asyncio.run(getattr(presence_routes, notify_fn_name)(db_session, 1, "neo42"))

    assert len(realtime_payloads) == 1
    assert realtime_payloads[0][0] == 2
    assert realtime_payloads[0][1]["type"] == expected_type
    assert persisted_notifications == [
        {
            "db": db_session,
            "user_id": 2,
            "type": expected_type,
            "title": "neo42",
            "message": expected_message,
        }
    ]


def test_login_accepts_email_identifier(db_session):
    result = asyncio.run(
        auth_routes.login(
            form_data=SimpleNamespace(username="neo42@example.com", password="Password123!"),
            db=db_session,
            request=SimpleNamespace(client=SimpleNamespace(host="tests")),
        )
    )

    assert "access_token" in result
    assert result["token_type"] == "bearer"


def test_new_tokens_still_resolve_user_after_username_change(db_session):
    user = db_session.query(User).filter(User.id == 1).first()
    token = build_access_token(user.id, user.username)

    user.username = "neo_renamed"
    db_session.commit()

    resolved_user = get_user_from_token(token, db_session)

    assert resolved_user.id == 1
    assert resolved_user.username == "neo_renamed"


def test_legacy_username_tokens_still_resolve_user(db_session):
    token = jwt.encode(
        {
            "sub": "neo42",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    resolved_user = get_user_from_token(token, db_session)

    assert resolved_user.id == 1
    assert resolved_user.username == "neo42"


def test_get_current_user_falls_back_to_cookie_when_bearer_is_invalid(db_session):
    cookie_token = build_access_token(1, "neo42")

    current_user = get_current_user(
        request=SimpleNamespace(cookies={"access_token": f"Bearer {cookie_token}"}),
        token="invalid.token.value",
        db=db_session,
    )

    assert current_user.id == 1
    assert current_user.username == "neo42"


def test_login_is_rate_limited_after_consecutive_failures(db_session):
    for _ in range(auth_routes.settings.LOGIN_MAX_ATTEMPTS):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                auth_routes.login(
                    form_data=SimpleNamespace(username="neo42", password="wrong"),
                    db=db_session,
                    request=SimpleNamespace(client=SimpleNamespace(host="tests")),
                )
            )
        assert exc.value.status_code == 401

    with pytest.raises(HTTPException) as blocked_exc:
        asyncio.run(
            auth_routes.login(
                form_data=SimpleNamespace(username="neo42", password="wrong"),
                db=db_session,
                request=SimpleNamespace(client=SimpleNamespace(host="tests")),
            )
        )

    assert blocked_exc.value.status_code == 429


def test_forgot_and_reset_password_flow(db_session, monkeypatch):
    monkeypatch.setattr(auth_routes.settings, "PASSWORD_RESET_DEV_RETURN_TOKEN", True)

    forgot_response = auth_routes.forgot_password(
        payload=ForgotPasswordRequest(email="neo42@example.com"),
        db=db_session,
    )

    assert forgot_response["detail"]
    assert forgot_response["reset_token"]

    reset_token = forgot_response["reset_token"]
    reset_response = auth_routes.reset_password(
        payload=ResetPasswordRequest(
            token=reset_token,
            new_password="BrandNew123!",
        ),
        db=db_session,
    )
    assert reset_response["detail"] == "Password reset successful."

    login_result = asyncio.run(
        auth_routes.login(
            form_data=SimpleNamespace(username="neo42", password="BrandNew123!"),
            db=db_session,
            request=SimpleNamespace(client=SimpleNamespace(host="tests")),
        )
    )
    assert "access_token" in login_result


def test_reset_password_rejects_invalid_token(db_session):
    with pytest.raises(HTTPException) as exc:
        auth_routes.reset_password(
            payload=ResetPasswordRequest(
                token="invalid_invalid_invalid_token_value",
                new_password="BrandNew123!",
            ),
            db=db_session,
        )

    assert exc.value.status_code == 400


def test_set_access_cookie_marks_cookie_secure_behind_https_proxy():
    class DummyResponse:
        def __init__(self):
            self.headers = {}

        def set_cookie(self, **kwargs):
            self.headers["set-cookie"] = kwargs

    dummy_response = DummyResponse()

    set_access_cookie(
        dummy_response,
        "signed-token",
        request=SimpleNamespace(
            url=SimpleNamespace(scheme="http"),
            headers={"x-forwarded-proto": "https"},
        ),
    )

    assert dummy_response.headers["set-cookie"]["secure"] is True
