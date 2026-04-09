from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.game_state import GameState, cell_to_world


def test_game_state_assigns_one_blackhole_per_player_for_multiplayer_room():
    layout = {
        "grid": [[0 for _ in range(7)] for _ in range(7)],
        "cols": 7,
        "rows": 7,
        "p1": {"x": 1, "y": 1},
        "p2": {"x": 5, "y": 5},
        "door": {"x": 3, "y": 3},
        "bh1": {"x": 1, "y": 5},
        "bh2": {"x": 5, "y": 1},
    }

    state = GameState(
        room_id="r_state_4p",
        players_order=[40, 10, 30, 20],
        seed=12345,
        tick_rate=20,
        start_layout=layout,
    )

    assert set(state.players.keys()) == {10, 20, 30, 40}
    assert set(state.blackholes.keys()) == {10, 20, 30, 40}
    assert len(state.blackholes) == 4

    p1_world = cell_to_world(layout["p1"])
    p2_world = cell_to_world(layout["p2"])
    assert state.players[10]["x"] == p1_world["x"]
    assert state.players[10]["y"] == p1_world["y"]
    assert state.players[20]["x"] == p2_world["x"]
    assert state.players[20]["y"] == p2_world["y"]

    unique_blackhole_positions = {(entry["x"], entry["y"]) for entry in state.blackholes.values()}
    assert len(unique_blackhole_positions) == 4


def test_game_state_still_builds_blackholes_when_layout_has_no_bh_cells():
    layout = {
        "grid": [[0 for _ in range(6)] for _ in range(6)],
        "cols": 6,
        "rows": 6,
        "p1": {"x": 1, "y": 1},
        "p2": {"x": 4, "y": 4},
        "door": {"x": 3, "y": 2},
        "bh1": None,
        "bh2": None,
    }

    state = GameState(
        room_id="r_state_no_bh",
        players_order=[1, 2, 3],
        seed=77,
        tick_rate=20,
        start_layout=layout,
    )

    assert set(state.blackholes.keys()) == {1, 2, 3}
    assert all(entry["x"] >= 0 and entry["y"] >= 0 for entry in state.blackholes.values())
