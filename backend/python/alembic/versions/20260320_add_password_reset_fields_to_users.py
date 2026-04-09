"""add password reset fields to users

Revision ID: 20260320_add_pwd_reset_users
Revises: 20260320_add_diff_stage_results
Create Date: 2026-03-20 18:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260320_add_pwd_reset_users"
down_revision: Union[str, Sequence[str], None] = "20260320_add_diff_stage_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return any(idx["name"] == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    if not _table_exists("users"):
        return

    with op.batch_alter_table("users") as batch_op:
        if not _column_exists("users", "password_reset_token_hash"):
            batch_op.add_column(sa.Column("password_reset_token_hash", sa.String(), nullable=True))
        if not _column_exists("users", "password_reset_expires_at"):
            batch_op.add_column(sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))

    if not _column_exists("users", "password_reset_token_hash"):
        return

    if not _index_exists("users", "ix_users_password_reset_token_hash"):
        op.create_index(
            "ix_users_password_reset_token_hash",
            "users",
            ["password_reset_token_hash"],
            unique=False,
        )


def downgrade() -> None:
    if not _table_exists("users"):
        return

    with op.batch_alter_table("users") as batch_op:
        if _column_exists("users", "password_reset_expires_at"):
            batch_op.drop_column("password_reset_expires_at")
        if _column_exists("users", "password_reset_token_hash"):
            batch_op.drop_column("password_reset_token_hash")

    if _index_exists("users", "ix_users_password_reset_token_hash"):
        op.drop_index("ix_users_password_reset_token_hash", table_name="users")
