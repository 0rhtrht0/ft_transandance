"""add_game_results

Revision ID: 20260311_add_game_results
Revises: 20260308_social_chat_tables
Create Date: 2026-03-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260311_add_game_results"
down_revision: Union[str, Sequence[str], None] = "20260308_social_chat_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _table_exists("game_results"):
        return
    op.create_table(
        "game_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result", sa.String(), nullable=False),
        sa.Column("pace_value", sa.Integer(), nullable=True),
        sa.Column("pace_label", sa.String(), nullable=True),
        sa.Column("time_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_game_results_id"), "game_results", ["id"], unique=False)
    op.create_index(op.f("ix_game_results_user_id"), "game_results", ["user_id"], unique=False)


def downgrade() -> None:
    if not _table_exists("game_results"):
        return
    op.drop_index(op.f("ix_game_results_user_id"), table_name="game_results")
    op.drop_index(op.f("ix_game_results_id"), table_name="game_results")
    op.drop_table("game_results")
