"""
Add is_online column to profiles table

Revision ID: 20260307_add_is_online_profiles
Revises: 20260306_add_avatar_to_profiles
Create Date: 2026-03-07
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260307_add_is_online_profiles'
down_revision: Union[str, Sequence[str], None] = '20260306_add_avatar_to_profiles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade():
    if not _column_exists("profiles", "is_online"):
        op.add_column(
            "profiles",
            sa.Column(
                "is_online",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )


def downgrade():
    if _column_exists("profiles", "is_online"):
        op.drop_column("profiles", "is_online")
