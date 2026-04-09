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

from app.api.routes.game_results import get_my_results, submit_result
from app.core.database import Base
from app.models.game_result import GameResult
from app.models.profile import Profile  # noqa: F401
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_transaction import WalletTransaction
from app.schemas.game import GameResultSubmitRequest


@pytest.fixture()
def db_session():
    db_path = PROJECT_ROOT / "test_game_results_api.db"
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    session.add(User(id=1, username="neo42", email="neo42@example.com", hashed_password="hashed"))
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()


def test_submit_result_persists_difficulty_and_stage(db_session):
    payload = GameResultSubmitRequest(
        evaluation_points=1,
        result="victory",
        is_multiplayer=False,
        pace_value=18,
        pace_label="18",
        time_ms=42000,
        level=2,
        difficulty="moyen",
        stage=2,
    )

    response = asyncio.run(
        submit_result(
            payload=payload,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert response.difficulty == "moyen"
    assert response.stage == 2
    assert response.evaluation_points == 1
    assert response.wallet_balance == 1
    assert response.wallet_transaction_id is not None

    row = db_session.query(GameResult).filter(GameResult.id == response.id).first()
    assert row is not None
    assert row.difficulty == "moyen"
    assert row.stage == 2
    assert row.evaluation_points == 1
    wallet = db_session.query(Wallet).filter(Wallet.user_id == 1).first()
    assert wallet is not None
    assert wallet.total_evaluation_points == 1
    tx = db_session.query(WalletTransaction).filter(WalletTransaction.id == response.wallet_transaction_id).first()
    assert tx is not None
    assert tx.evaluation_points_delta == 1
    assert tx.balance_after == 1


def test_submit_result_falls_back_stage_to_level_when_missing(db_session):
    payload = GameResultSubmitRequest(
        evaluation_points=0,
        result="defeat",
        is_multiplayer=False,
        pace_value=12,
        pace_label="12",
        time_ms=15000,
        level=4,
        difficulty="facile",
    )

    response = asyncio.run(
        submit_result(
            payload=payload,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert response.stage == 4
    assert response.evaluation_points == 0

    row = db_session.query(GameResult).filter(GameResult.id == response.id).first()
    assert row is not None
    assert row.stage == 4
    assert row.evaluation_points == 0


def test_submit_result_applies_negative_points_for_multiplayer_loss(db_session):
    payload = GameResultSubmitRequest(
        evaluation_points=-1,
        result="defeat",
        is_multiplayer=True,
        pace_value=12,
        pace_label="12",
        time_ms=15000,
        level=4,
        difficulty="facile",
    )

    response = asyncio.run(
        submit_result(
            payload=payload,
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert response.evaluation_points == -1
    assert response.wallet_balance == -1

    wallet = db_session.query(Wallet).filter(Wallet.user_id == 1).first()
    assert wallet is not None
    assert wallet.total_evaluation_points == -1


def test_get_my_results_returns_difficulty_and_stage(db_session):
    asyncio.run(
        submit_result(
            payload=GameResultSubmitRequest(
                evaluation_points=1,
                result="victory",
                is_multiplayer=False,
                pace_value=15,
                pace_label="15",
                time_ms=30000,
                level=3,
                difficulty="difficile",
                stage=5,
            ),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        ),
    )

    results = get_my_results(
        limit=10,
        offset=0,
        current_user=SimpleNamespace(id=1),
        db=db_session,
    )

    assert len(results) == 1
    assert results[0].difficulty == "difficile"
    assert results[0].stage == 5
    assert results[0].evaluation_points == 1
    assert results[0].wallet_balance == 1


def test_submit_result_creates_game_notification(db_session, monkeypatch):
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

    response = asyncio.run(
        submit_result(
            payload=GameResultSubmitRequest(
                evaluation_points=1,
                result="victory",
                is_multiplayer=False,
                pace_value=18,
                pace_label="18",
                time_ms=42000,
                level=2,
                difficulty="moyen",
                stage=2,
            ),
            current_user=SimpleNamespace(id=1),
            db=db_session,
        )
    )

    assert response.result == "victory"
    assert notifications == [
        {
            "user_id": 1,
            "type": "game_victory_self",
            "title": "Victory",
            "message": "Solo victory | stage 2 · moyen | Points: +1 EP | Wallet: 1 EP | Achievements: First Escape",
        },
    ]
