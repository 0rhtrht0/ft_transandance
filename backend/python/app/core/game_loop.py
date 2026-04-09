import asyncio
import time
import math
import copy
from app.core.game_state import active_games
from app.realtime.manager import send_to_user
from app.core.maze_utils import compute_exit_position

TICK_RATE = 20  # Hz


def build_snapshot(state) -> dict:
    return {
        "room_id": state.room_id,
        "tick": state.tick,
        "players": state.players,
        "players_order": state.players_order,
        "seed": state.seed,
        "blackhole": state.blackhole,
        "server_time": int(time.time() * 1000),
    }


def build_blackhole_targets(snapshot: dict) -> dict:
    targets = {}
    for player_id, player in snapshot.get("players", {}).items():
        if not isinstance(player, dict):
            continue
        x = player.get("x")
        y = player.get("y")
        if x is None or y is None:
            continue
        target = {
            "x": x,
            "y": y,
        }
        if "status" in player:
            target["status"] = player["status"]
        targets[player_id] = target
    return targets


def finish_match_with_winner(state, winner_id: int) -> bool:
    if state.game_ended:
        return False

    state.ensure_player(winner_id)
    state.winner_id = winner_id
    state.game_ended = True

    winner = state.players.get(winner_id)
    if winner is not None:
        winner["status"] = "escaped"
        winner["evaluation_points"] = winner.get("evaluation_points", 0) + 1

    for loser_id in list(state.players_order):
        if loser_id == winner_id:
            continue
        loser = state.players.get(loser_id)
        if loser is None:
            continue
        loser_bh = state.blackholes.get(loser_id)
        if loser_bh:
            loser["x"] = loser_bh["x"]
            loser["y"] = loser_bh["y"]
        loser["status"] = "absorbed"
        loser["evaluation_points"] = loser.get("evaluation_points", 0) - 1

    return True


def build_localized_snapshot(snapshot: dict, user_id: int) -> dict:
    localized_snapshot = copy.deepcopy(snapshot)
    localized_snapshot["blackhole_targets"] = build_blackhole_targets(snapshot)
    for other_id in localized_snapshot.get("players", {}):
        if other_id != user_id:
            localized_snapshot["players"][other_id]["x"] = -1000.0
            localized_snapshot["players"][other_id]["y"] = -1000.0
    return localized_snapshot


async def broadcast_match_end(state, winner_id: int) -> None:
    tasks = []
    for user_id in list(state.players.keys()):
        if user_id == winner_id:
            payload = {
                "type": "match.end",
                "result": "win",
                "reason": "escape"
            }
        else:
            payload = {
                "type": "match.end",
                "result": "lose",
                "reason": "opponent_escape"
            }
        tasks.append(send_to_user(user_id, payload))
    if tasks:
        await asyncio.gather(*tasks)

async def broadcast_state_snapshot(state) -> None:
    snapshot = state.build_snapshot()
    tasks = []
    for user_id in list(state.players.keys()):
        payload = {"type": "state_update", **build_localized_snapshot(snapshot, user_id)}
        tasks.append(send_to_user(user_id, payload))
    if tasks:
        await asyncio.gather(*tasks)


async def run_game_loop(room_id: str):
    state = active_games.get(room_id)
    if not state:
        return

    tick_rate = state.tick_rate or TICK_RATE
    tick_interval = 1.0 / tick_rate
    next_tick = time.perf_counter()

    while state.running:
        now = time.perf_counter()
        if now < next_tick:
            await asyncio.sleep(next_tick - now)
        else:
            next_tick = now

        # Check win condition if not ended
        if not state.game_ended and state.exit_pos and state.blackholes:
            exit_x, exit_y = state.exit_pos['x'], state.exit_pos['y']
            WIN_THRESHOLD = 20.0  # ~tile_size * 0.7
            for user_id in list(state.players.keys()):
                player = state.players[user_id]
                dx = player['x'] - exit_x
                dy = player['y'] - exit_y
                dist = math.sqrt(dx*dx + dy*dy)
                if dist <= WIN_THRESHOLD:
                    if finish_match_with_winner(state, user_id):
                        asyncio.create_task(broadcast_match_end(state, user_id))
                    break

        state.tick += 1
        await broadcast_state_snapshot(state)
        next_tick += tick_interval
