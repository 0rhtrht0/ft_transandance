import logging

from sqlalchemy import text
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, ConversationParticipant
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.message import Message
from app.models.notification import Notification

logger = logging.getLogger(__name__)

SOCIAL_TABLES = (
    FriendRequest.__table__,
    Friendship.__table__,
    Conversation.__table__,
    ConversationParticipant.__table__,
    Message.__table__,
    Notification.__table__,
)


def ensure_social_tables(bind) -> list[str]:
    inspector = inspect(bind)
    if not inspector.has_table("users"):
        logger.warning("Skipping social schema bootstrap because the users table is unavailable.")
        return []

    existing_tables = set(inspector.get_table_names())
    created_tables: list[str] = []

    for table in SOCIAL_TABLES:
        if table.name in existing_tables:
            continue
        table.create(bind=bind, checkfirst=True)
        created_tables.append(table.name)
        existing_tables.add(table.name)

    return created_tables


def ensure_social_columns(bind) -> list[str]:
    inspector = inspect(bind)
    if "conversation_participants" not in inspector.get_table_names():
        return []

    columns = {column["name"] for column in inspector.get_columns("conversation_participants")}
    added_columns: list[str] = []
    if "last_read_message_id" not in columns:
        bind.execute(
            text(
                "ALTER TABLE conversation_participants "
                "ADD COLUMN last_read_message_id INTEGER"
            )
        )
        added_columns.append("conversation_participants.last_read_message_id")

    return added_columns


def migrate_legacy_friend_requests(db: Session) -> dict[str, int]:
    bind = db.get_bind()
    if bind is None:
        return {"inserted": 0, "upgraded": 0}

    inspector = inspect(bind)
    if not inspector.has_table(FriendRequest.__tablename__) or not inspector.has_table(Friendship.__tablename__):
        return {"inserted": 0, "upgraded": 0}

    legacy_rows = (
        db.query(FriendRequest)
        .order_by(FriendRequest.created_at.asc(), FriendRequest.id.asc())
        .all()
    )
    modern_rows = db.query(Friendship).all()
    modern_by_pair = {
        tuple(sorted((row.requester_id, row.addressee_id))): row
        for row in modern_rows
    }

    inserted = 0
    upgraded = 0

    for legacy in legacy_rows:
        key = tuple(sorted((legacy.requester_id, legacy.addressee_id)))
        modern = modern_by_pair.get(key)

        if modern is None:
            modern = Friendship(
                requester_id=legacy.requester_id,
                addressee_id=legacy.addressee_id,
                status=legacy.status or "pending",
                created_at=legacy.created_at,
            )
            db.add(modern)
            db.flush()
            modern_by_pair[key] = modern
            inserted += 1
            continue

        if modern.status != "accepted" and (legacy.status or "").lower() == "accepted":
            modern.status = "accepted"
            if getattr(modern, "created_at", None) is None and legacy.created_at is not None:
                modern.created_at = legacy.created_at
            upgraded += 1

    if inserted or upgraded:
        db.commit()

    return {"inserted": inserted, "upgraded": upgraded}


def initialize_conversation_read_tracking(db: Session) -> int:
    bind = db.get_bind()
    if bind is None:
        return 0

    inspector = inspect(bind)
    if "conversation_participants" not in inspector.get_table_names() or "messages" not in inspector.get_table_names():
        return 0

    initialized = 0
    participations = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.last_read_message_id.is_(None))
        .all()
    )

    for participation in participations:
        latest_message = (
            db.query(Message.id)
            .filter(Message.conversation_id == participation.conversation_id)
            .order_by(Message.id.desc())
            .first()
        )
        if latest_message is None:
            continue
        participation.last_read_message_id = latest_message.id
        initialized += 1

    if initialized:
        db.commit()

    return initialized


def bootstrap_social_schema(bind, session_factory) -> dict[str, object]:
    created_tables = ensure_social_tables(bind)
    added_columns = ensure_social_columns(bind)

    with session_factory() as db:
        migration_stats = migrate_legacy_friend_requests(db)
        initialized_reads = initialize_conversation_read_tracking(db)

    if created_tables:
        logger.info("Social tables ensured: %s", ", ".join(created_tables))
    if added_columns:
        logger.info("Social columns ensured: %s", ", ".join(added_columns))
    if migration_stats["inserted"] or migration_stats["upgraded"]:
        logger.info(
            "Legacy social data synchronized: inserted=%s upgraded=%s",
            migration_stats["inserted"],
            migration_stats["upgraded"],
        )
    if initialized_reads:
        logger.info("Conversation read tracking initialized: %s", initialized_reads)

    return {
        "created_tables": created_tables,
        "added_columns": added_columns,
        "inserted_legacy_rows": migration_stats["inserted"],
        "upgraded_legacy_rows": migration_stats["upgraded"],
        "initialized_read_states": initialized_reads,
    }
