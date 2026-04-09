from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.services.player_meta_service import build_players_meta


def _map_room_error(error: ValueError) -> HTTPException:
    detail = str(error)
    if detail == "Room not found":
        status_code = 404
    elif detail in {"Only host can close the room", "Only host can start the room"}:
        status_code = 403
    elif detail in {"Room has already started"}:
        status_code = 409
    else:
        status_code = 400
    return HTTPException(status_code=status_code, detail=detail)


def _resolve_db_session(db) -> Session | None:
    if db is None:
        return None
    if not hasattr(db, "query"):
        return None
    return db


def _room_players_meta(room, db=None) -> list[dict]:
    return build_players_meta(room.players, _resolve_db_session(db))


def _room_payload(room, db=None) -> dict:
    ready_players = [player_id for player_id in room.players if player_id in room.ready_players]
    all_ready = len(room.players) >= 2 and len(ready_players) == len(room.players)
    return {
        "room_id": room.id,
        "host_id": room.host_id,
        "max_players": room.max_players,
        "players": room.players,
        "players_meta": _room_players_meta(room, db),
        "status": room.status,
        "ready_players": ready_players,
        "all_ready": all_ready,
        "seed": room.seed,
        "difficulty": room.difficulty,
        "stage": room.stage,
    }


def _room_state_event(room, db=None) -> dict:
    return {
        "type": "room_state",
        **_room_payload(room, db),
    }
