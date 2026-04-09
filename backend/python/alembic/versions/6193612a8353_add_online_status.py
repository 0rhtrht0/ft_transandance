"""add online status

Revision ID: 6193612a8353
Revises: 00ea5baf73f1
Create Date: 2026-03-07 15:41:03.790790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6193612a8353'
down_revision: Union[str, Sequence[str], None] = '00ea5baf73f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    """Upgrade schema."""
    if not _column_exists("profiles", "is_online"):
        op.add_column("profiles", sa.Column("is_online", sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    if _column_exists("profiles", "is_online"):
        op.drop_column("profiles", "is_online")
