import asyncio
import secrets

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.game_loop import (
    TICK_RATE,
    broadcast_state_snapshot,
    finish_match_with_winner,
    run_game_loop,
)
from app.core.game_state import GameState, active_games
from app.core.security import extract_bearer_token, get_user_from_token
from app.dependencies import get_db
from app.realtime.manager import (
    connect_user,
    disconnect_user,
    join_room,
    publish_room,
    send_to_user,
)
from app.services.match_service import MatchService
from app.services.notification_realtime_service import create_and_push_notification
from app.services.player_meta_service import build_players_meta


router = APIRouter()

match_service = MatchService()


def _resolve_effective_user_id(websocket: WebSocket, fallback_user_id: int, db: Session) -> int:
    # Prefer the authenticated identity when a token is available.
    token = extract_bearer_token(websocket.headers.get("Authorization"))
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        return fallback_user_id

    try:
        user = get_user_from_token(token, db)
    except Exception:
        return fallback_user_id

    return int(user.id)


def _build_match_found_notification_message(difficulty: str, stage: int, room_id: str) -> str:
    return f"Multiplayer match ready | stage {stage} · {difficulty} | Room {room_id}"


async def _persist_match_found_notifications(player_ids: list[int], difficulty: str, stage: int, room_id: str, db: Session) -> None:
    message = _build_match_found_notification_message(difficulty, stage, room_id)
    for player_id in player_ids:
        await create_and_push_notification(
            db=db,
            user_id=player_id,
            type_="match_found",
            title="Game",
            message=message,
        )


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: Session = Depends(get_db),
):

    effective_user_id = _resolve_effective_user_id(websocket, user_id, db)
    await connect_user(effective_user_id, websocket)

    try:

        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "join_matchmaking":
                match_service.join_queue(effective_user_id)
                result = match_service.try_match()

                # Quand un match est trouve (apres try_match) :
                if result:
                    room_id, players = result
                    players_list = [int(player_id) for player_id in players]
                    players_meta = build_players_meta(players_list, db)
                    seed = secrets.randbelow(2_147_483_647) + 1
                    state = GameState(
                        room_id=room_id,
                        players_order=players_list,
                        seed=seed,
                        tick_rate=TICK_RATE,
                        players_meta=players_meta,
                    )
                    active_games[room_id] = state
                    asyncio.create_task(run_game_loop(room_id))

                    for player_id in players_list:
                        join_room(player_id, room_id)

                    start_state = state.get_start_state_payload()
                    base_message = {
                        "type": "match_found",
                        "room_id": room_id,
                        "players": players_list,
                        "players_meta": players_meta,
                        "playersMeta": players_meta,
                        "seed": seed,
                        "difficulty": state.difficulty,
                        "stage": state.stage,
                        "tick_rate": TICK_RATE,
                        "start_state": start_state,
                        "startState": start_state,
                    }
                    for player_id in players_list:
                        await send_to_user(
                            player_id,
                            {
                                **base_message,
                                "player_id": player_id,
                                "playerId": player_id,
                            },
                        )
                    await _persist_match_found_notifications(
                        players_list,
                        state.difficulty,
                        state.stage,
                        room_id,
                        db,
                    )

            elif event_type == "leave_matchmaking":
                match_service.leave_queue(effective_user_id)
            elif event_type == "room_message":
                room_id = data["room_id"]
                content = data["content"]
                await publish_room(
                    room_id,
                    {
                        "type": "room_message",
                        "user_id": effective_user_id,
                        "content": content
                    }
                )
            # Recevoir l'etat du joueur (position/evaluation_points/etc.)
            elif event_type in {"player_state", "input"}:
                room_id = data.get("room_id")
                state = active_games.get(room_id)
                if state:
                    state.update_player(effective_user_id, data)
                    if data.get("reached_exit") is True and finish_match_with_winner(state, effective_user_id):
                        from app.core.game_loop import broadcast_match_end
                        asyncio.create_task(broadcast_match_end(state, effective_user_id))
                    await broadcast_state_snapshot(state)
            elif event_type == "player_finished":
                room_id = data.get("room_id")
                state = active_games.get(room_id)
                if state:
                    state.update_player(effective_user_id, data)
                    if finish_match_with_winner(state, effective_user_id):
                        from app.core.game_loop import broadcast_match_end
                        asyncio.create_task(broadcast_match_end(state, effective_user_id))
                    await broadcast_state_snapshot(state)
            elif event_type == "player_absorbed":
                room_id = data.get("room_id")
                state = active_games.get(room_id)
                if state:
                    player = state.players.get(effective_user_id, {})
                    if player.get("status") != "absorbed":
                        player["status"] = "absorbed"
                        player["evaluation_points"] = player.get("evaluation_points", 0) - 1
                        await send_to_user(effective_user_id, {
                            "type": "match.end",
                            "result": "lose",
                            "reason": "blackhole"
                        })
                        state.update_player(
                            effective_user_id,
                            {
                                **data,
                                "status": "absorbed",
                            },
                        )
                    active_players = [pid for pid in state.players_order if state.players.get(pid, {}).get("status") not in ("absorbed", "escaped")]
                    if len(active_players) == 0 and not state.game_ended:
                        state.game_ended = True # End it if everyone is absorbed
                    await broadcast_state_snapshot(state)

    except WebSocketDisconnect:
        room_id = next(
            (
                state.room_id
                for state in active_games.values()
                if effective_user_id in state.players
            ),
            None,
        )
        disconnect_user(effective_user_id)
        match_service.leave_queue(effective_user_id)
        if not room_id:
            return
        state = active_games.get(room_id)
        if state:
            state.remove_player(effective_user_id)
            if not state.players:
                state.running = False
                active_games.pop(room_id, None)
