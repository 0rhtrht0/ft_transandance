from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.game_state import active_games, build_start_state_payload
from app.core.maze_generator import generate_maze_logic
from app.core.room_manager import room_manager
from app.dependencies import get_db

from .rooms_helpers import _map_room_error, _room_payload

router = APIRouter()


@router.get("/rooms/{room_id}")
async def get_room(
    room_id: str,
    db: Session = Depends(get_db),
):
    """Récupère les infos d'une room"""

    try:
        room = await room_manager.get_room(room_id)

    except ValueError as e:
        raise _map_room_error(e)

    return _room_payload(room, db)


@router.get("/rooms/{room_id}/start-state")
async def get_room_start_state(
    room_id: str,
    db: Session = Depends(get_db),
):
    """Retourne l'état initial validé (map, porte, spawns) pour la room."""

    try:
        room = await room_manager.get_room(room_id)
    except ValueError as e:
        raise _map_room_error(e)

    state = active_games.get(room_id)
    if state:
        return {
            "room_id": room_id,
            "validated": True,
            "source": "active_game",
            "start_state": state.get_start_state_payload(),
        }

    is_multiplayer = len(room.players) > 1
    layout = generate_maze_logic(
        seed=room.seed,
        difficulty=room.difficulty,
        stage=room.stage,
        is_multiplayer=is_multiplayer,
    )

    return {
        "room_id": room_id,
        "validated": True,
        "source": "generated_preview",
        "start_state": build_start_state_payload(
            layout=layout,
            seed=room.seed,
            difficulty=room.difficulty,
            stage=room.stage,
            is_multiplayer=is_multiplayer,
        ),
    }
