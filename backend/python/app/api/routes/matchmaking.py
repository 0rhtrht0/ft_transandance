import asyncio
import random
import string

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.game_state import build_start_state_payload
from app.core.maze_generator import generate_maze_logic
from app.dependencies import get_current_user, get_db
from app.models.game_history import GameHistory
from app.models.game_players import GamePlayers
from app.models.user import User
from app.realtime.manager import send_to_user
from app.schemas.game import MatchmakingJoinResponse, MatchmakingLeaveResponse
from app.services.notification_realtime_service import create_and_push_notification
from app.services.player_meta_service import build_players_meta

router = APIRouter(tags=["matchmaking"])

matchmaking_queue: dict[str, list[dict]] = {
    "facile": [],
    "moyen": [],
    "difficile": [],
}
matchmaking_lock = asyncio.Lock()
MATCHMAKING_DIFFICULTIES = ("facile", "moyen", "difficile")


def _ensure_matchmaking_queue() -> None:
    for key in MATCHMAKING_DIFFICULTIES:
        matchmaking_queue.setdefault(key, [])


def _resolve_query_default(value, fallback):
    if hasattr(value, "default"):
        return value.default
    return fallback if value is None else value


def generate_seed() -> str:
    """Genere un seed aleatoire pour le jeu"""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _build_match_found_notification_message(difficulty: str, stage: int, game_id: int) -> str:
    return f"Multiplayer match ready | stage {stage} · {difficulty} | Game #{game_id}"


@router.post(
    "/matchmaking/join",
    response_model=MatchmakingJoinResponse,
    summary="Rejoindre la file de matchmaking",
    description="Ajoute l'utilisateur courant a la file par difficulty et retourne un match des que 2 joueurs sont disponibles.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def join_queue(
    difficulty: str = Query("moyen"),
    stage: int = Query(1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rejoint la file de matchmaking pour une difficulte et stage donnes"""

    difficulty = _resolve_query_default(difficulty, "moyen")
    stage = _resolve_query_default(stage, 1)
    _ensure_matchmaking_queue()

    if difficulty not in matchmaking_queue:
        difficulty = "moyen"

    matched_players: tuple[int, int] | None = None
    seed = generate_seed()

    async with matchmaking_lock:
        queue = matchmaking_queue[difficulty]

        if any(p["user_id"] == current_user.id for p in queue):
            return MatchmakingJoinResponse(status="already in queue")

        queue.append({"user_id": current_user.id, "stage": stage})
        
        # When 2 players join, start a 10s timer to gather more players. Max is 4.
        if len(queue) == 2:
            asyncio.create_task(_flush_queue_after_delay(difficulty, 10))

        if len(queue) >= 4:
            matched_players = tuple(queue.pop(0)["user_id"] for _ in range(4))
        else:
            matched_players = None

    if matched_players is None:
        return MatchmakingJoinResponse(status="waiting for another player")

    await _create_and_notify_match(matched_players, seed, difficulty, stage, db)

    return MatchmakingJoinResponse(
        match=list(matched_players),
        seed=seed,
        difficulty=difficulty,
        stage=stage,
    )


@router.post(
    "/matchmaking/leave",
    response_model=MatchmakingLeaveResponse,
    summary="Quitter la file de matchmaking",
    description="Retire l'utilisateur courant de la file s'il y est present.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def leave_queue(
    difficulty: str = Query("moyen"),
    current_user: User = Depends(get_current_user),
):
    """Quitte la file de matchmaking"""

    difficulty = _resolve_query_default(difficulty, "moyen")
    _ensure_matchmaking_queue()

    if difficulty not in matchmaking_queue:
        return MatchmakingLeaveResponse(status="not in queue")

    async with matchmaking_lock:
        queue = matchmaking_queue[difficulty]
        for index, player in enumerate(queue):
            if player["user_id"] == current_user.id:
                queue.pop(index)
                return MatchmakingLeaveResponse(status="removed from queue")

    return MatchmakingLeaveResponse(status="not in queue")


async def _flush_queue_after_delay(difficulty: str, delay: int):
    await asyncio.sleep(delay)
    matched_players = None
    seed = generate_seed()
    
    async with matchmaking_lock:
        queue = matchmaking_queue[difficulty]
        if len(queue) >= 2:
            num = min(len(queue), 4)
            # Remove them from the queue
            matched_players = tuple(queue.pop(0)["user_id"] for _ in range(num))
            stage = 1
            
    if matched_players:
        from app.dependencies import get_db
        db_generator = get_db()
        db = next(db_generator)
        try:
            await _create_and_notify_match(matched_players, seed, difficulty, stage, db)
        finally:
            db.close()

async def _create_and_notify_match(matched_players, seed, difficulty, stage, db):
    new_game = GameHistory(
        duration=0,
        winner_id=None,
        seed=seed,
        difficulty=difficulty,
        stage=stage,
    )
    db.add(new_game)
    db.flush()

    db.add_all(
        [
            GamePlayers(game_id=new_game.id, user_id=pid) for pid in matched_players
        ]
    )
    db.commit()
    db.refresh(new_game)

    players_meta = build_players_meta(list(matched_players), db)
    start_layout = generate_maze_logic(
        seed=seed,
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )
    start_state = build_start_state_payload(
        layout=start_layout,
        seed=seed,
        difficulty=difficulty,
        stage=stage,
        is_multiplayer=True,
    )

    base_message = {
        "type": "match_found",
        "game_id": new_game.id,
        "players": list(matched_players),
        "players_meta": players_meta,
        "playersMeta": players_meta,
        "seed": seed,
        "difficulty": difficulty,
        "stage": stage,
        "start_state": start_state,
        "startState": start_state,
    }
    
    tasks = [
        send_to_user(pid, {**base_message, "player_id": pid, "playerId": pid})
        for pid in matched_players
    ]
    await asyncio.gather(*tasks)

    notification_message = _build_match_found_notification_message(difficulty, stage, new_game.id)
    for pid in matched_players:
        await create_and_push_notification(
            db=db,
            user_id=pid,
            type_="match_found",
            title="Game",
            message=notification_message,
        )
