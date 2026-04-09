"""add wallets and evaluation points

Revision ID: 20260401_wallets_eval_points
Revises: 20260330_add_message_image_url
Create Date: 2026-04-01 12:00:00.000000
"""

from __future__ import annotations

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260401_wallets_eval_points"
down_revision: Union[str, Sequence[str], None] = "20260330_add_message_image_url"
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

    if _table_exists("game_results"):
        has_score = _column_exists("game_results", "score")
        has_evaluation_points = _column_exists("game_results", "evaluation_points")
        has_is_multiplayer = _column_exists("game_results", "is_multiplayer")

        if not has_evaluation_points:
            op.add_column(
                "game_results",
                sa.Column("evaluation_points", sa.Integer(), nullable=False, server_default="0"),
            )

        if has_score:
            connection.execute(
                sa.text(
                    """
                    UPDATE game_results
                    SET evaluation_points = CASE
                        WHEN lower(coalesce(result, '')) = 'victory' THEN 1
                        ELSE 0
                    END
                    """
                )
            )

        if not has_is_multiplayer:
            op.add_column(
                "game_results",
                sa.Column("is_multiplayer", sa.Boolean(), nullable=False, server_default=sa.false()),
            )

        if has_score:
            with op.batch_alter_table("game_results") as batch_op:
                batch_op.drop_column("score")

    if not _table_exists("wallets"):
        op.create_table(
            "wallets",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("total_evaluation_points", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("unlocked_achievements", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
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
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id"),
        )
        op.create_index(op.f("ix_wallets_id"), "wallets", ["id"], unique=False)
        op.create_index(op.f("ix_wallets_user_id"), "wallets", ["user_id"], unique=False)

    if not _table_exists("wallet_transactions"):
        op.create_table(
            "wallet_transactions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("wallet_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("game_result_id", sa.Integer(), nullable=True),
            sa.Column("evaluation_points_delta", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("balance_before", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("balance_after", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("transaction_type", sa.String(length=50), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=True),
            sa.Column("context", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["game_result_id"], ["game_results.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["wallet_id"], ["wallets.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_wallet_transactions_id"),
            "wallet_transactions",
            ["id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_wallet_transactions_wallet_id"),
            "wallet_transactions",
            ["wallet_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_wallet_transactions_user_id"),
            "wallet_transactions",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_wallet_transactions_game_result_id"),
            "wallet_transactions",
            ["game_result_id"],
            unique=False,
        )

    if _table_exists("wallets"):
        user_ids = [row[0] for row in connection.execute(sa.text("SELECT id FROM users")).fetchall()]
        for user_id in user_ids:
            existing_wallet_id = connection.execute(
                sa.text("SELECT id FROM wallets WHERE user_id = :user_id"),
                {"user_id": user_id},
            ).scalar()
            if existing_wallet_id is not None:
                continue

            total_evaluation_points = 0
            if _table_exists("game_results") and _column_exists("game_results", "evaluation_points"):
                total_evaluation_points = int(
                    connection.execute(
                        sa.text(
                            """
                            SELECT COALESCE(SUM(evaluation_points), 0)
                            FROM game_results
                            WHERE user_id = :user_id
                            """
                        ),
                        {"user_id": user_id},
                    ).scalar()
                    or 0
                )

            connection.execute(
                sa.text(
                    """
                    INSERT INTO wallets (user_id, total_evaluation_points, unlocked_achievements)
                    VALUES (:user_id, :total_evaluation_points, :unlocked_achievements)
                    """
                ),
                {
                    "user_id": user_id,
                    "total_evaluation_points": total_evaluation_points,
                    "unlocked_achievements": json.dumps([]),
                },
            )

    if _table_exists("wallet_transactions") and _table_exists("wallets"):
        wallet_rows = connection.execute(
            sa.text("SELECT id, user_id, total_evaluation_points FROM wallets")
        ).fetchall()
        for wallet_id, user_id, total_evaluation_points in wallet_rows:
            if int(total_evaluation_points or 0) == 0:
                continue
            existing_transaction_id = connection.execute(
                sa.text(
                    """
                    SELECT id
                    FROM wallet_transactions
                    WHERE wallet_id = :wallet_id AND transaction_type = 'legacy_migration'
                    LIMIT 1
                    """
                ),
                {"wallet_id": wallet_id},
            ).scalar()
            if existing_transaction_id is not None:
                continue
            connection.execute(
                sa.text(
                    """
                    INSERT INTO wallet_transactions (
                        wallet_id,
                        user_id,
                        game_result_id,
                        evaluation_points_delta,
                        balance_before,
                        balance_after,
                        transaction_type,
                        description,
                        context
                    )
                    VALUES (
                        :wallet_id,
                        :user_id,
                        NULL,
                        :delta,
                        0,
                        :delta,
                        'legacy_migration',
                        'Legacy migration balance',
                        :context
                    )
                    """
                ),
                {
                    "wallet_id": wallet_id,
                    "user_id": user_id,
                    "delta": int(total_evaluation_points or 0),
                    "context": json.dumps({"source": "migration"}),
                },
            )


def downgrade() -> None:
    if _table_exists("wallet_transactions"):
        op.drop_index(op.f("ix_wallet_transactions_game_result_id"), table_name="wallet_transactions")
        op.drop_index(op.f("ix_wallet_transactions_user_id"), table_name="wallet_transactions")
        op.drop_index(op.f("ix_wallet_transactions_wallet_id"), table_name="wallet_transactions")
        op.drop_index(op.f("ix_wallet_transactions_id"), table_name="wallet_transactions")
        op.drop_table("wallet_transactions")

    if _table_exists("wallets"):
        op.drop_index(op.f("ix_wallets_user_id"), table_name="wallets")
        op.drop_index(op.f("ix_wallets_id"), table_name="wallets")
        op.drop_table("wallets")

    if _table_exists("game_results") and _column_exists("game_results", "evaluation_points"):
        if not _column_exists("game_results", "score"):
            op.add_column(
                "game_results",
                sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
            )
            op.execute(sa.text("UPDATE game_results SET score = CASE WHEN evaluation_points > 0 THEN evaluation_points ELSE 0 END"))

        with op.batch_alter_table("game_results") as batch_op:
            if _column_exists("game_results", "is_multiplayer"):
                batch_op.drop_column("is_multiplayer")
            batch_op.drop_column("evaluation_points")
