from pathlib import Path
import asyncio
import sys
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes.users import search_users
from app.core.database import Base
from app.models.profile import Profile
from app.models.user import User


def test_user_search_returns_matching_users_with_single_character_query():
    db_path = PROJECT_ROOT / "test_user_search.db"
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
            User(id=3, username="tank", email="tank@example.com", hashed_password="hashed"),
            Profile(user_id=2, avatar="uploaded_avatars/trinity.png", is_online=True),
        ]
    )
    session.commit()

    try:
        payload = asyncio.run(
            search_users(
                q="t",
                limit=20,
                current_user=SimpleNamespace(id=1),
                db=session,
            )
        )

        usernames = [row["username"] for row in payload["users"]]
        assert usernames == ["tank", "trinity"]
        assert all(row["id"] != 1 for row in payload["users"])
        assert payload["users"][1]["avatar"] == "uploaded_avatars/trinity.png"
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()
