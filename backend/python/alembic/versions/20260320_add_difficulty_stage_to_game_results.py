"""add difficulty and stage to game_results

Revision ID: 20260320_add_diff_stage_results
Revises: 20260318_add_stage_progress
Create Date: 2026-03-20 15:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260320_add_diff_stage_results"
down_revision: Union[str, Sequence[str], None] = "20260318_add_stage_progress"
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


def upgrade() -> None:
    if not _table_exists("game_results"):
        return

    if not _column_exists("game_results", "difficulty"):
        op.add_column("game_results", sa.Column("difficulty", sa.String(length=20), nullable=True))

    if not _column_exists("game_results", "stage"):
        op.add_column("game_results", sa.Column("stage", sa.Integer(), nullable=True))

    op.execute(sa.text("UPDATE game_results SET stage = level WHERE stage IS NULL"))


def downgrade() -> None:
    if not _table_exists("game_results"):
        return

    has_difficulty = _column_exists("game_results", "difficulty")
    has_stage = _column_exists("game_results", "stage")

    if not (has_difficulty or has_stage):
        return

    with op.batch_alter_table("game_results") as batch_op:
        if has_stage:
            batch_op.drop_column("stage")
        if has_difficulty:
            batch_op.drop_column("difficulty")
