from pathlib import Path
import sys
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes import profile_read as profile_read_routes
from app.core.database import Base
from app.models.friendship import Friendship
from app.models.game_result import GameResult
from app.models.profile import Profile
from app.models.stage_progress import StageProgress
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_transaction import WalletTransaction


def create_db_session():
    db_path = PROJECT_ROOT / "test_profile_api.db"
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    return session, engine, db_path


def destroy_db_session(session, engine, db_path: Path):
    session.close()
    Base.metadata.drop_all(bind=engine)
    if db_path.exists():
        db_path.unlink()


def test_get_public_profile_returns_points_and_stats():
    session, engine, db_path = create_db_session()
    try:
        session.add_all(
            [
                User(id=1, username="neo42", email="neo42@example.com", hashed_password="hashed"),
                User(id=2, username="trinity", email="trinity@example.com", hashed_password="hashed"),
                User(id=3, username="morpheus", email="morpheus@example.com", hashed_password="hashed"),
                Profile(user_id=2, bio="Operator and maze strategist", avatar="uploaded_avatars/trinity.png", is_online=True),
                StageProgress(user_id=2, difficulty="facile", current_stage=4),
                StageProgress(user_id=2, difficulty="moyen", current_stage=3),
                Wallet(
                    user_id=2,
                    total_evaluation_points=5,
                    unlocked_achievements=["first_escape", "steady_orbit"],
                ),
                GameResult(
                    user_id=2,
                    evaluation_points=1,
                    result="victory",
                    is_multiplayer=False,
                    time_ms=58000,
                    level=2,
                    difficulty="moyen",
                    stage=2,
                ),
                GameResult(
                    user_id=2,
                    evaluation_points=1,
                    result="victory",
                    is_multiplayer=True,
                    time_ms=61000,
                    level=3,
                    difficulty="moyen",
                    stage=3,
                ),
                GameResult(
                    user_id=2,
                    evaluation_points=-1,
                    result="defeat",
                    is_multiplayer=True,
                    time_ms=43000,
                    level=1,
                    difficulty="facile",
                    stage=1,
                ),
                Friendship(requester_id=1, addressee_id=2, status="accepted"),
                Friendship(requester_id=2, addressee_id=3, status="accepted"),
            ]
        )
        session.commit()
        session.add_all(
            [
                WalletTransaction(
                    wallet_id=session.query(Wallet).filter(Wallet.user_id == 2).first().id,
                    user_id=2,
                    evaluation_points_delta=1,
                    balance_before=0,
                    balance_after=1,
                    transaction_type="solo_escape",
                    description="Solo escape",
                    context={},
                ),
                WalletTransaction(
                    wallet_id=session.query(Wallet).filter(Wallet.user_id == 2).first().id,
                    user_id=2,
                    evaluation_points_delta=1,
                    balance_before=1,
                    balance_after=2,
                    transaction_type="multiplayer_result",
                    description="Multiplayer victory",
                    context={},
                ),
            ]
        )
        session.commit()

        payload = profile_read_routes.get_public_profile(
            user_id=2,
            db=session,
            current_user=SimpleNamespace(id=1),
        )

        assert payload["user_id"] == 2
        assert payload["username"] == "trinity"
        assert payload["bio"] == "Operator and maze strategist"
        assert payload["is_online"] is True
        assert payload["is_me"] is False
        assert payload["stats"]["evaluation_points"] == 5
        assert payload["stats"]["wallet_transactions"] == 2
        assert payload["stats"]["wins"] == 2
        assert payload["stats"]["losses"] == 1
        assert payload["stats"]["friends_count"] == 2
        assert payload["stats"]["unlocked_achievements"] == ["first_escape", "steady_orbit"]
        assert payload["progression"] == [
            {"difficulty": "facile", "current_stage": 4},
            {"difficulty": "moyen", "current_stage": 3},
            {"difficulty": "difficile", "current_stage": 1},
        ]
    finally:
        destroy_db_session(session, engine, db_path)


def test_get_public_profile_marks_viewer_profile_as_me():
    session, engine, db_path = create_db_session()
    try:
        session.add(
            User(id=7, username="apollo", email="apollo@example.com", hashed_password="hashed")
        )
        session.commit()

        payload = profile_read_routes.get_public_profile(
            user_id=7,
            db=session,
            current_user=SimpleNamespace(id=7),
        )

        assert payload["is_me"] is True
        assert payload["stats"]["evaluation_points"] == 0
        assert payload["stats"]["friends_count"] == 0
    finally:
        destroy_db_session(session, engine, db_path)
