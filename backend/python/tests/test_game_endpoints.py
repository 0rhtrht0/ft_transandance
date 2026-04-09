from pathlib import Path
import asyncio
import sys
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import app.api.routes.matchmaking as matchmaking_routes
import app.api.routes.ws as ws_routes
from app.api.routes.game_history import get_game_detail, get_my_history
from app.api.routes.leaderboard import get_leaderboard, get_user_evaluation_points
from app.api.routes.matchmaking import join_queue, leave_queue, matchmaking_queue
from app.core.database import Base
from app.models.game_history import GameHistory
from app.models.game_players import GamePlayers
from app.models.profile import Profile
from app.models.stage_progress import StageProgress
from app.models.user import User
from app.models.wallet import Wallet
from app.services.player_meta_service import build_players_meta


@pytest.fixture()
def db_session():
    db_path = PROJECT_ROOT / "test_api.db"
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    user_1 = User(
        id=1,
        username="neo42",
        email="neo42@example.com",
        hashed_password="hashed",
    )
    user_2 = User(
        id=2,
        username="trinity",
        email="trinity@example.com",
        hashed_password="hashed",
    )
    session.add_all([user_1, user_2])
    session.add_all(
        [
            Profile(user_id=1, avatar="uploaded_avatars/user_1.png"),
            Profile(user_id=2, avatar=None),
        ]
    )
    session.add_all(
        [
            StageProgress(user_id=1, difficulty="facile", current_stage=3),
            StageProgress(user_id=1, difficulty="moyen", current_stage=1),
            StageProgress(user_id=1, difficulty="difficile", current_stage=1),
            StageProgress(user_id=2, difficulty="facile", current_stage=2),
            StageProgress(user_id=2, difficulty="moyen", current_stage=1),
            StageProgress(user_id=2, difficulty="difficile", current_stage=1),
        ]
    )
    session.add_all(
        [
            Wallet(user_id=1, total_evaluation_points=2, unlocked_achievements=["first_escape"]),
            Wallet(user_id=2, total_evaluation_points=1, unlocked_achievements=[]),
        ]
    )
    game = GameHistory(id=1, winner_id=1, duration=320)
    session.add(game)
    session.flush()
    session.add_all(
        [
            GamePlayers(game_id=game.id, user_id=1),
            GamePlayers(game_id=game.id, user_id=2),
        ]
    )
    session.commit()

    matchmaking_queue.clear()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()
        matchmaking_queue.clear()


def test_get_leaderboard(db_session):
    result = get_leaderboard(limit=2, db=db_session)
    assert len(result) == 2
    assert result[0].username == "neo42"
    assert result[0].evaluation_points == 2


def test_get_user_evaluation_points_route(db_session):
    result = get_user_evaluation_points(user_id=1, db=db_session)
    assert result.user_id == 1
    assert result.evaluation_points == 2


def test_get_my_game_history(db_session):
    current_user = db_session.query(User).filter(User.id == 1).first()
    result = get_my_history(current_user=current_user, db=db_session)
    assert len(result) == 1
    assert result[0].game_id == 1
    assert "neo42" in result[0].players


def test_get_game_history_detail(db_session):
    current_user = db_session.query(User).filter(User.id == 1).first()
    result = get_game_detail(game_id=1, current_user=current_user, db=db_session)
    assert result.game_id == 1
    assert result.winner == "neo42"
    assert sorted(result.players) == ["neo42", "trinity"]


def test_join_matchmaking():
    matchmaking_queue.clear()
    result = asyncio.run(join_queue(current_user=SimpleNamespace(id=1)))
    assert result.status == "waiting for another player"


def test_leave_matchmaking():
    matchmaking_queue.clear()
    user = SimpleNamespace(id=1)
    asyncio.run(join_queue(current_user=user))
    result = asyncio.run(leave_queue(current_user=user))
    assert result.status == "removed from queue"


def test_join_matchmaking_creates_a_match(db_session):
    matchmaking_queue.clear()
    asyncio.run(join_queue(current_user=SimpleNamespace(id=1), db=db_session))
    result = asyncio.run(join_queue(current_user=SimpleNamespace(id=2), db=db_session))

    assert result.match == [1, 2]
    created_game = db_session.query(GameHistory).order_by(GameHistory.id.desc()).first()
    players = db_session.query(GamePlayers).filter(GamePlayers.game_id == created_game.id).all()
    assert sorted(player.user_id for player in players) == [1, 2]


def test_join_matchmaking_sends_players_meta_payload(db_session, monkeypatch):
    matchmaking_queue.clear()
    sent_messages = []

    async def fake_send_to_user(user_id, payload):
        sent_messages.append((user_id, payload))
        return True

    monkeypatch.setattr(matchmaking_routes, "send_to_user", fake_send_to_user)

    asyncio.run(matchmaking_routes.join_queue(current_user=SimpleNamespace(id=1), db=db_session))
    asyncio.run(matchmaking_routes.join_queue(current_user=SimpleNamespace(id=2), db=db_session))

    assert len(sent_messages) == 2
    for recipient_id, payload in sent_messages:
        assert recipient_id in {1, 2}
        assert payload["type"] == "match_found"
        assert payload["players"] == [1, 2]
        assert payload["start_state"] == payload["startState"]
        assert payload["start_state"]["is_multiplayer"] is True
        assert payload["start_state"]["door"] is not None

        meta_by_id = {entry["id"]: entry for entry in payload["players_meta"]}
        assert set(meta_by_id.keys()) == {1, 2}
        assert meta_by_id[1]["username"] == "neo42"
        assert meta_by_id[1]["avatar"] == "uploaded_avatars/user_1.png"
        assert meta_by_id[1]["avatar_url"] == "uploaded_avatars/user_1.png"
        assert meta_by_id[1]["evaluation_points"] == 2
        assert meta_by_id[2]["username"] == "trinity"
        assert meta_by_id[2]["avatar"] is None
        assert meta_by_id[2]["avatar_url"] is None
        assert meta_by_id[2]["evaluation_points"] == 1


def test_create_and_notify_match_persists_match_found_notifications(db_session, monkeypatch):
    persisted_notifications = []

    async def fake_send_to_user(user_id, payload):
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

    monkeypatch.setattr(matchmaking_routes, "send_to_user", fake_send_to_user)
    monkeypatch.setattr(matchmaking_routes, "create_and_push_notification", fake_create_and_push_notification)

    asyncio.run(
        matchmaking_routes._create_and_notify_match(
            matched_players=(1, 2),
            seed="ABCDEFG1",
            difficulty="moyen",
            stage=1,
            db=db_session,
        )
    )

    assert len(persisted_notifications) == 2
    assert {entry["user_id"] for entry in persisted_notifications} == {1, 2}
    for entry in persisted_notifications:
        assert entry["db"] == db_session
        assert entry["type"] == "match_found"
        assert entry["title"] == "Game"
        assert "Multiplayer match ready" in entry["message"]
        assert "stage 1" in entry["message"]
        assert "moyen" in entry["message"]


def test_ws_matchmaking_persists_match_found_notifications(db_session, monkeypatch):
    persisted_notifications = []

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

    monkeypatch.setattr(ws_routes, "create_and_push_notification", fake_create_and_push_notification)

    asyncio.run(
        ws_routes._persist_match_found_notifications(
            [1, 2],
            "moyen",
            3,
            "room-42",
            db_session,
        )
    )

    assert len(persisted_notifications) == 2
    assert {entry["user_id"] for entry in persisted_notifications} == {1, 2}
    for entry in persisted_notifications:
        assert entry["db"] == db_session
        assert entry["type"] == "match_found"
        assert entry["title"] == "Game"
        assert entry["message"] == "Multiplayer match ready | stage 3 · moyen | Room room-42"



def test_build_players_meta_keeps_usernames_when_avatar_lookup_fails(db_session, monkeypatch):
    original_query = db_session.query

    def flaky_query(*entities, **kwargs):
        first_entity = entities[0] if entities else None
        owner = getattr(first_entity, "class_", None)
        if owner is Profile:
            raise RuntimeError("avatar query unavailable")
        return original_query(*entities, **kwargs)

    monkeypatch.setattr(db_session, "query", flaky_query)

    meta = build_players_meta([1, 2], db_session)
    meta_by_id = {entry["id"]: entry for entry in meta}

    assert meta_by_id[1]["username"] == "neo42"
    assert meta_by_id[2]["username"] == "trinity"
    assert meta_by_id[1]["avatar"] is None
    assert meta_by_id[2]["avatar"] is None
    assert meta_by_id[1]["evaluation_points"] == 2
    assert meta_by_id[2]["evaluation_points"] == 1
