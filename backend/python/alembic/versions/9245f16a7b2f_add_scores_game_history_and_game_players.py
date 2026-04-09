"""add_scores_game_history_and_game_players

Revision ID: 9245f16a7b2f
Revises: 09800560de4c
Create Date: 2026-03-07 17:01:49.357062

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9245f16a7b2f'
down_revision: Union[str, Sequence[str], None] = '09800560de4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scores_id"), "scores", ["id"], unique=False)
    op.create_index(op.f("ix_scores_user_id"), "scores", ["user_id"], unique=False)

    op.create_table(
        "game_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("winner_id", sa.Integer(), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["winner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_game_history_id"), "game_history", ["id"], unique=False)
    op.create_index(
        op.f("ix_game_history_winner_id"), "game_history", ["winner_id"], unique=False
    )

    op.create_table(
        "game_players",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["game_history.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id", "user_id", name="uq_game_players_game_user"),
    )
    op.create_index(
        op.f("ix_game_players_game_id"), "game_players", ["game_id"], unique=False
    )
    op.create_index(
        op.f("ix_game_players_user_id"), "game_players", ["user_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_game_players_user_id"), table_name="game_players")
    op.drop_index(op.f("ix_game_players_game_id"), table_name="game_players")
    op.drop_table("game_players")

    op.drop_index(op.f("ix_game_history_winner_id"), table_name="game_history")
    op.drop_index(op.f("ix_game_history_id"), table_name="game_history")
    op.drop_table("game_history")

    op.drop_index(op.f("ix_scores_user_id"), table_name="scores")
    op.drop_index(op.f("ix_scores_id"), table_name="scores")
    op.drop_table("scores")
