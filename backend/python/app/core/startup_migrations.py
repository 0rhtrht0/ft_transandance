from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.core.database import Base, engine

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
APP_TABLE_HINTS = {
    "users",
    "profiles",
    "friend_requests",
    "friendships",
    "conversations",
    "conversation_participants",
    "messages",
    "notifications",
    "game_results",
    "wallets",
}


def _load_model_metadata():
    from app.models.conversation import Conversation, ConversationParticipant
    from app.models.friend_request import FriendRequest
    from app.models.friendship import Friendship
    from app.models.game_history import GameHistory
    from app.models.game_players import GamePlayers
    from app.models.game_result import GameResult
    from app.models.message import Message
    from app.models.notification import Notification
    from app.models.profile import Profile
    from app.models.progression import Progression
    from app.models.stage_progress import StageProgress
    from app.models.user import User
    from app.models.wallet import Wallet
    from app.models.wallet_transaction import WalletTransaction

    _ = (
        Conversation,
        ConversationParticipant,
        FriendRequest,
        Friendship,
        GameHistory,
        GamePlayers,
        GameResult,
        Message,
        Notification,
        Profile,
        Progression,
        StageProgress,
        User,
        Wallet,
        WalletTransaction,
    )
    return Base.metadata


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            ["alembic", *args],
            cwd=str(PROJECT_ROOT),
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        stdout = (exc.stdout or "").strip()
        stderr = (exc.stderr or "").strip()
        if stdout:
            logger.error("Alembic stdout:\n%s", stdout)
        if stderr:
            logger.error("Alembic stderr:\n%s", stderr)
        raise

    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if stdout:
        logger.info(stdout)
    if stderr:
        logger.info(stderr)
    return result


def _is_existing_schema_without_history(exc: subprocess.CalledProcessError, bind: Engine) -> bool:
    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())
    if "alembic_version" in table_names:
        return False

    if not (table_names & APP_TABLE_HINTS):
        return False

    output = "\n".join(
        part for part in [(exc.stdout or "").lower(), (exc.stderr or "").lower()] if part
    )
    return "already exists" in output


def run_startup_migrations(bind: Engine = engine) -> str:
    try:
        _run_alembic("upgrade", "head")
        return "upgraded"
    except subprocess.CalledProcessError as exc:
        if not _is_existing_schema_without_history(exc, bind):
            raise

        logger.warning(
            "Existing database schema detected without Alembic history; "
            "creating any missing tables and stamping head."
        )
        _load_model_metadata().create_all(bind=bind)
        _run_alembic("stamp", "head")
        return "stamped_head"


def main() -> None:
    run_startup_migrations()


if __name__ == "__main__":
    main()
