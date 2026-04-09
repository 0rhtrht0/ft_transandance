"""add_social_chat_tables

Revision ID: 20260308_social_chat_tables
Revises: 9245f16a7b2f
Create Date: 2026-03-08 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260308_social_chat_tables"
down_revision: Union[str, Sequence[str], None] = "9245f16a7b2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _table_exists("friend_requests"):
        op.create_table(
            "friend_requests",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("requester_id", sa.Integer(), nullable=False),
            sa.Column("addressee_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["addressee_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_friend_requests_id"), "friend_requests", ["id"], unique=False)

    if not _table_exists("friendships"):
        op.create_table(
            "friendships",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("requester_id", sa.Integer(), nullable=False),
            sa.Column("addressee_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["addressee_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_friendships_id"), "friendships", ["id"], unique=False)

    if not _table_exists("conversations"):
        op.create_table(
            "conversations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_conversations_id"), "conversations", ["id"], unique=False)

    if not _table_exists("conversation_participants"):
        op.create_table(
            "conversation_participants",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("conversation_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "conversation_id",
                "user_id",
                name="uq_conversation_user",
            ),
        )
        op.create_index(
            op.f("ix_conversation_participants_id"),
            "conversation_participants",
            ["id"],
            unique=False,
        )

    if not _table_exists("messages"):
        op.create_table(
            "messages",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("conversation_id", sa.Integer(), nullable=False),
            sa.Column("sender_id", sa.Integer(), nullable=False),
            sa.Column("content", sa.String(length=1000), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"]),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_messages_id"), "messages", ["id"], unique=False)
        op.create_index(
            op.f("ix_messages_conversation_id"),
            "messages",
            ["conversation_id"],
            unique=False,
        )

    if not _table_exists("notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("content", sa.String(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)


def downgrade() -> None:
    if _table_exists("notifications"):
        op.drop_table("notifications")
    if _table_exists("messages"):
        op.drop_table("messages")
    if _table_exists("conversation_participants"):
        op.drop_table("conversation_participants")
    if _table_exists("conversations"):
        op.drop_table("conversations")
    if _table_exists("friendships"):
        op.drop_table("friendships")
    if _table_exists("friend_requests"):
        op.drop_table("friend_requests")
