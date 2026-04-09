import asyncio

from fastapi import APIRouter, Depends, Query
from fastapi.params import Param
from sqlalchemy.orm import Session

from app.core.game_loop import TICK_RATE, run_game_loop
from app.core.game_state import GameState, active_games
from app.core.room_manager import room_manager
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.realtime.contracts import (
    EVENT_ROOM_CLOSED,
    EVENT_ROOM_MATCH_START,
    EVENT_ROOM_PLAYER_JOINED,
    EVENT_ROOM_PLAYER_LEFT,
    EVENT_ROOM_READY_STATE,
    EVENT_ROOM_STATE_UPDATED,
)
from app.realtime.manager import (
    join_room as subscribe_room,
    leave_room as unsubscribe_room,
    publish_room,
    send_to_user,
)

from .rooms_helpers import _map_room_error, _room_payload, _room_state_event

router = APIRouter()
QUICK_ROOM_MAX_PLAYERS = 4

def _resolve_query_default(value, fallback):
    if isinstance(value, Param):
        value = value.default
    return fallback if value is None else value


def _build_match_start_event(room, db=None) -> dict:
    payload = _room_payload(room, db)
    state = active_games.get(room.id)
    start_state = state.get_start_state_payload() if state else None

    event = {
        "type": "match_start",
        "event": EVENT_ROOM_MATCH_START,
        "tick_rate": TICK_RATE,
        **payload,
    }
    if start_state:
        event["start_state"] = start_state
        event["startState"] = start_state

    return event


async def _start_room_match(room, db: Session) -> dict:
    room_payload = _room_payload(room, db)
    if room.id not in active_games:
        active_games[room.id] = GameState(
            room_id=room.id,
            players_order=list(room.players),
            seed=room.seed,
            difficulty=room.difficulty,
            stage=room.stage,
            tick_rate=TICK_RATE,
            players_meta=room_payload.get("players_meta", []),
        )
        asyncio.create_task(run_game_loop(room.id))

    match_start_event = _build_match_start_event(room, db)
    await publish_room(room.id, match_start_event)
    return match_start_event


@router.post("/rooms")
async def create_room(
    difficulty: str = Query("moyen"),
    stage: int = Query(1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crée une nouvelle room privée avec difficulté et stage"""

    room = await room_manager.create_room(current_user.id)

    difficulty = _resolve_query_default(difficulty, "moyen")
    stage = _resolve_query_default(stage, 1)
    if not isinstance(difficulty, str):
        difficulty = str(difficulty) if difficulty is not None else "moyen"
    try:
        stage = int(stage)
    except (TypeError, ValueError):
        stage = 1

    room.difficulty = difficulty
    room.stage = stage
    subscribe_room(current_user.id, room.id)

    await send_to_user(
        current_user.id,
        {
            **_room_state_event(room, db),
            "event": EVENT_ROOM_STATE_UPDATED,
        },
    )
    return _room_payload(room, db)


@router.post("/rooms/quick-join")
async def quick_join_room(
    difficulty: str = Query("moyen"),
    stage: int = Query(1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rejoint automatiquement le lobby public courant (ou en crée un)."""

    difficulty = _resolve_query_default(difficulty, "moyen")
    stage = _resolve_query_default(stage, 1)
    if not isinstance(difficulty, str):
        difficulty = str(difficulty) if difficulty is not None else "moyen"
    try:
        stage = int(stage)
    except (TypeError, ValueError):
        stage = 1
    stage = max(1, stage)

    room, action = await room_manager.get_or_create_quick_room(
        user_id=current_user.id,
        difficulty=difficulty,
        stage=stage,
        max_players=QUICK_ROOM_MAX_PLAYERS,
    )
    if action == "created":
        room.difficulty = difficulty
        room.stage = stage

    subscribe_room(current_user.id, room.id)
    room_payload = _room_payload(room, db)

    if action == "joined":
        await publish_room(
            room.id,
            {
                "type": "player_joined",
                "event": EVENT_ROOM_PLAYER_JOINED,
                "joined_user_id": current_user.id,
                **room_payload,
            },
        )

    await publish_room(
        room.id,
        {
            **_room_state_event(room, db),
            "event": EVENT_ROOM_STATE_UPDATED,
        },
    )

    return room_payload


@router.post("/rooms/{room_id}/join")
async def join_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rejoint une room existante"""

    try:
        room = await room_manager.join_room(room_id, current_user.id)

    except ValueError as e:
        raise _map_room_error(e)

    subscribe_room(current_user.id, room.id)

    await publish_room(
        room.id,
        {
            "type": "player_joined",
            "event": EVENT_ROOM_PLAYER_JOINED,
            "joined_user_id": current_user.id,
            **_room_payload(room, db),
        },
    )
    await publish_room(
        room.id,
        {
            **_room_state_event(room, db),
            "event": EVENT_ROOM_STATE_UPDATED,
        },
    )
    return _room_payload(room, db)


@router.post("/rooms/{room_id}/ready")
async def set_room_ready(
    room_id: str,
    ready: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marque le joueur courant prêt/pas prêt dans la room"""

    ready = _resolve_query_default(ready, True)
    if isinstance(ready, str):
        ready = ready.strip().lower() in {"1", "true", "yes", "on"}

    try:
        room = await room_manager.set_player_ready(room_id, current_user.id, ready)
    except ValueError as e:
        raise _map_room_error(e)

    room_payload = _room_payload(room, db)
    await publish_room(
        room.id,
        {
            "type": "room_ready_state",
            "event": EVENT_ROOM_READY_STATE,
            "user_id": current_user.id,
            "ready": ready,
            **room_payload,
        },
    )

    await publish_room(
        room.id,
        {
            **_room_state_event(room, db),
            "event": EVENT_ROOM_STATE_UPDATED,
        },
    )
    return room_payload


@router.post("/rooms/{room_id}/start")
async def start_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Démarre la room (host uniquement, quand tous les joueurs sont prêts)."""

    try:
        room = await room_manager.start_room(room_id, current_user.id)
    except ValueError as e:
        raise _map_room_error(e)

    match_start_event = await _start_room_match(room, db)
    return {
        "status": "started",
        **match_start_event,
    }


@router.post("/rooms/{room_id}/leave")
async def leave_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Quitte une room"""
    try:
        room = await room_manager.leave_room(room_id, current_user.id)

    except ValueError as e:
        raise _map_room_error(e)

    unsubscribe_room(current_user.id, room_id)

    if room is None:
        await send_to_user(
            current_user.id,
            {
                "type": "room_closed",
                "event": EVENT_ROOM_CLOSED,
                "room_id": room_id,
                "closed_by": current_user.id,
            },
        )
        return {"status": "room deleted", "room_id": room_id}

    room_payload = _room_payload(room, db)
    await publish_room(
        room.id,
        {
            "type": "player_left",
            "event": EVENT_ROOM_PLAYER_LEFT,
            "left_user_id": current_user.id,
            **room_payload,
        },
    )
    await publish_room(
        room.id,
        {
            **_room_state_event(room, db),
            "event": EVENT_ROOM_STATE_UPDATED,
        },
    )

    return {
        "status": "left room",
        **room_payload,
    }


@router.post("/rooms/{room_id}/close")
async def close_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ferme une room"""
    try:
        room = await room_manager.close_room(room_id, current_user.id)
    except ValueError as e:
        raise _map_room_error(e)

    state = active_games.pop(room.id, None)
    if state is not None:
        if state.winner_id:
            await room_manager.set_winner(room_id, state.winner_id)
        state.running = False

    room_payload = _room_payload(room, db)
    await publish_room(
        room.id,
        {
            "type": "room_closed",
            "event": EVENT_ROOM_CLOSED,
            "closed_by": current_user.id,
            **room_payload,
        },
    )
    for player_id in room.players:
        unsubscribe_room(player_id, room.id)

    return {"status": "room closed", "room_id": room.id}
