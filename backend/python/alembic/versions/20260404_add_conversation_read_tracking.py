"""add conversation read tracking

Revision ID: 20260404_conv_read_track
Revises: 20260401_wallets_eval_points
Create Date: 2026-04-04 11:55:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260404_conv_read_track"
down_revision: Union[str, Sequence[str], None] = "20260401_wallets_eval_points"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    connection = op.get_bind()

    if _table_exists("conversation_participants") and not _column_exists(
        "conversation_participants",
        "last_read_message_id",
    ):
        op.add_column(
            "conversation_participants",
            sa.Column("last_read_message_id", sa.Integer(), nullable=True),
        )

    if _table_exists("conversation_participants") and _table_exists("messages") and _column_exists(
        "conversation_participants",
        "last_read_message_id",
    ):
        latest_messages = connection.execute(
            sa.text(
                """
                SELECT conversation_id, MAX(id) AS latest_message_id
                FROM messages
                GROUP BY conversation_id
                """
            )
        ).fetchall()
        for row in latest_messages:
            connection.execute(
                sa.text(
                    """
                    UPDATE conversation_participants
                    SET last_read_message_id = :latest_message_id
                    WHERE conversation_id = :conversation_id
                      AND last_read_message_id IS NULL
                    """
                ),
                {
                    "conversation_id": row.conversation_id,
                    "latest_message_id": row.latest_message_id,
                },
            )


def downgrade() -> None:
    if _table_exists("conversation_participants") and _column_exists(
        "conversation_participants",
        "last_read_message_id",
    ):
        with op.batch_alter_table("conversation_participants") as batch_op:
            batch_op.drop_column("last_read_message_id")
