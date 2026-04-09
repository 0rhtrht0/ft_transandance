from pathlib import Path
import sys

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.database import Base
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.services.social_bootstrap_service import bootstrap_social_schema


def test_bootstrap_social_schema_creates_missing_tables_and_migrates_legacy_requests(tmp_path):
    db_path = tmp_path / "social_bootstrap.db"
    engine = create_engine(f"sqlite:///{db_path}")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine, tables=[User.__table__, FriendRequest.__table__])

    with TestingSessionLocal() as session:
        session.add_all(
            [
                User(id=1, username="neo42", email="neo42@example.com", hashed_password="hashed"),
                User(id=2, username="trinity", email="trinity@example.com", hashed_password="hashed"),
                User(id=3, username="morpheus", email="morpheus@example.com", hashed_password="hashed"),
                FriendRequest(requester_id=1, addressee_id=2, status="accepted"),
                FriendRequest(requester_id=3, addressee_id=1, status="pending"),
            ]
        )
        session.commit()

    result = bootstrap_social_schema(engine, TestingSessionLocal)
    tables = set(inspect(engine).get_table_names())

    assert "friendships" in tables
    assert "notifications" in tables
    assert "conversations" in tables
    assert "conversation_participants" in tables
    assert "messages" in tables
    conversation_participant_columns = {
        column["name"] for column in inspect(engine).get_columns("conversation_participants")
    }
    assert "last_read_message_id" in conversation_participant_columns
    assert result["inserted_legacy_rows"] == 2
    assert result["upgraded_legacy_rows"] == 0

    with TestingSessionLocal() as session:
        migrated = session.query(Friendship).order_by(Friendship.id.asc()).all()
        assert len(migrated) == 2
        assert {(row.requester_id, row.addressee_id, row.status) for row in migrated} == {
            (1, 2, "accepted"),
            (3, 1, "pending"),
        }
