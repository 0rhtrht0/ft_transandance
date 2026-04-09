from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.core.database import Base
from app.core.public_api import PublicApiRateLimiter
from app.dependencies import get_db
from app.main import app
from app.models.friendship import Friendship
from app.models.game_result import GameResult
from app.models.profile import Profile
from app.models.stage_progress import StageProgress
from app.models.user import User
from app.models.wallet import Wallet


@pytest.fixture()
def public_api_client(monkeypatch):
    db_path = PROJECT_ROOT / "test_public_api.db"
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    session.add_all(
        [
            User(id=1, username="neo42", email="neo42@example.com", hashed_password="hashed"),
            User(id=2, username="trinity", email="trinity@example.com", hashed_password="hashed"),
            Profile(
                user_id=1,
                bio="Ready for the maze",
                avatar="uploaded_avatars/neo42.png",
                is_online=True,
            ),
            StageProgress(user_id=1, difficulty="facile", current_stage=3),
            Wallet(user_id=1, total_evaluation_points=2, unlocked_achievements=["first_escape"]),
            GameResult(
                user_id=1,
                evaluation_points=1,
                result="victory",
                is_multiplayer=False,
                time_ms=41000,
                level=2,
                difficulty="facile",
                stage=2,
            ),
            Friendship(requester_id=1, addressee_id=2, status="accepted"),
        ]
    )
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    monkeypatch.setattr(settings, "PUBLIC_API_KEYS", ["test-public-key"])
    app.state.public_api_rate_limiter = PublicApiRateLimiter(limit=10, window_seconds=60)
    app.dependency_overrides[get_db] = override_get_db
    app.openapi_schema = None

    client = TestClient(app)

    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        app.openapi_schema = None
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        if db_path.exists():
            db_path.unlink()


def build_headers(api_key: str = "test-public-key") -> dict[str, str]:
    return {"X-API-Key": api_key}


def test_public_api_requires_api_key(public_api_client):
    response = public_api_client.get("/api/public/profiles")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API key."

    response = public_api_client.get(
        "/api/public/profiles",
        headers=build_headers("wrong-key"),
    )
    assert response.status_code == 401


def test_public_api_supports_documented_profile_crud(public_api_client):
    list_response = public_api_client.get(
        "/api/public/profiles",
        headers=build_headers(),
    )
    assert list_response.status_code == 200
    assert list_response.headers["X-RateLimit-Limit"] == "10"
    assert len(list_response.json()) == 1

    get_response = public_api_client.get(
        "/api/public/profiles/1",
        headers=build_headers(),
    )
    assert get_response.status_code == 200
    assert get_response.json()["username"] == "neo42"
    assert get_response.json()["stats"]["evaluation_points"] == 2

    create_response = public_api_client.post(
        "/api/public/profiles",
        headers=build_headers(),
        json={
            "user_id": 2,
            "bio": "Operator and strategist",
            "avatar": "uploaded_avatars/trinity.png",
            "is_online": False,
        },
    )
    assert create_response.status_code == 201
    assert create_response.json()["user_id"] == 2
    assert create_response.json()["bio"] == "Operator and strategist"

    replace_response = public_api_client.put(
        "/api/public/profiles/2",
        headers=build_headers(),
        json={
            "bio": "Available for public API sync",
            "avatar": "uploaded_avatars/trinity-v2.png",
            "is_online": True,
        },
    )
    assert replace_response.status_code == 200
    assert replace_response.json()["bio"] == "Available for public API sync"
    assert replace_response.json()["is_online"] is True

    delete_response = public_api_client.delete(
        "/api/public/profiles/2",
        headers=build_headers(),
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"detail": "Public profile deleted"}

    missing_response = public_api_client.get(
        "/api/public/profiles/2",
        headers=build_headers(),
    )
    assert missing_response.status_code == 404
    assert missing_response.json()["detail"] == "Profile not found"


def test_public_api_is_rate_limited(public_api_client):
    app.state.public_api_rate_limiter = PublicApiRateLimiter(limit=2, window_seconds=60)

    first = public_api_client.get("/api/public/profiles", headers=build_headers())
    second = public_api_client.get("/api/public/profiles", headers=build_headers())
    third = public_api_client.get("/api/public/profiles", headers=build_headers())

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "Public API rate limit exceeded."
    assert third.headers["Retry-After"] == "60"


def test_public_api_is_documented_in_openapi(public_api_client):
    response = public_api_client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "/api/public/profiles" in schema["paths"]
    assert "/api/public/profiles/{user_id}" in schema["paths"]
    assert "PublicApiKey" in schema["components"]["securitySchemes"]
    assert schema["paths"]["/api/public/profiles"]["get"]["security"] == [
        {"PublicApiKey": []}
    ]
