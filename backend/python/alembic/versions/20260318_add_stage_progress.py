"""add_stage_progress

Revision ID: 20260318_add_stage_progress
Revises: 20260312_add_chat_notifications
Create Date: 2026-03-18 09:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260318_add_stage_progress"
down_revision: Union[str, Sequence[str], None] = "20260312_add_chat_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _table_exists("stage_progress"):
        return

    op.create_table(
        "stage_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("current_stage", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "difficulty", name="uq_user_difficulty"),
    )
    op.create_index(op.f("ix_stage_progress_id"), "stage_progress", ["id"], unique=False)
    op.create_index(
        op.f("ix_stage_progress_user_id"), "stage_progress", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_stage_progress_difficulty"),
        "stage_progress",
        ["difficulty"],
        unique=False,
    )


def downgrade() -> None:
    if not _table_exists("stage_progress"):
        return
    op.drop_index(op.f("ix_stage_progress_difficulty"), table_name="stage_progress")
    op.drop_index(op.f("ix_stage_progress_user_id"), table_name="stage_progress")
    op.drop_index(op.f("ix_stage_progress_id"), table_name="stage_progress")
    op.drop_table("stage_progress")
