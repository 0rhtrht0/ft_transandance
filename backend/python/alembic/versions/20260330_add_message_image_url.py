"""add_message_image_url

Revision ID: 20260330_add_message_image_url
Revises: 20260320_add_pwd_reset_users
Create Date: 2026-03-30 13:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260330_add_message_image_url"
down_revision: Union[str, Sequence[str], None] = "20260320_add_pwd_reset_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    columns = inspector.get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def upgrade() -> None:
    if not _column_exists("messages", "image_url"):
        with op.batch_alter_table("messages") as batch_op:
            batch_op.add_column(sa.Column("image_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    if _column_exists("messages", "image_url"):
        with op.batch_alter_table("messages") as batch_op:
            batch_op.drop_column("image_url")
