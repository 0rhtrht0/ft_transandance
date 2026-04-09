from pathlib import Path
import sys

import pytest
from pydantic import ValidationError

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes import auth_google as auth_google_routes
from app.schemas.user import UserCreate, UserUpdate


def test_user_create_rejects_username_longer_than_fifteen_characters():
    with pytest.raises(ValidationError):
        UserCreate(
            username="a" * 16,
            email="neo42@example.com",
            password="S3cureP@ssw0rd",
        )


def test_user_update_rejects_username_longer_than_fifteen_characters():
    with pytest.raises(ValidationError):
        UserUpdate(username="b" * 16)


def test_google_slugify_username_is_capped_to_backend_limit():
    username = auth_google_routes._slugify_username("Pseudo Google Vraiment Beaucoup Trop Long")

    assert len(username) <= 15
