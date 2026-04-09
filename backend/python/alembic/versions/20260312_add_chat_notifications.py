"""add_chat_notifications (deprecated)

Revision ID: 20260312_add_chat_notifications
Revises: 20260311_add_game_results
Create Date: 2026-03-12 13:14:00.000000

This migration was a legacy draft with a UUID-based schema that conflicts with
the active integer-based chat models. The actual chat tables are created by
20260308_add_social_chat_tables.py, so this revision is intentionally a no-op
to keep Alembic history consistent without breaking existing databases.
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "20260312_add_chat_notifications"
down_revision: Union[str, Sequence[str], None] = "20260311_add_game_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op legacy migration."""
    pass


def downgrade() -> None:
    """No-op legacy migration."""
    pass
