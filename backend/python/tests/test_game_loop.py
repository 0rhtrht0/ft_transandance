from pathlib import Path
import sys
from types import SimpleNamespace

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.game_loop import build_localized_snapshot, finish_match_with_winner


class DummyState(SimpleNamespace):
    def ensure_player(self, user_id: int):
        return self.players.setdefault(user_id, {"x": 0.0, "y": 0.0})


def test_finish_match_with_winner_marks_losers_absorbed():
    state = DummyState(
        game_ended=False,
        winner_id=None,
        players_order=[7, 9],
        players={
            7: {"x": 10.0, "y": 20.0},
            9: {"x": 30.0, "y": 40.0},
        },
        blackholes={
            7: {"x": 110.0, "y": 120.0},
            9: {"x": 210.0, "y": 220.0},
        },
    )

    changed = finish_match_with_winner(state, 7)

    assert changed is True
    assert state.game_ended is True
    assert state.winner_id == 7
    assert state.players[7]["status"] == "escaped"
    assert state.players[9]["status"] == "absorbed"
    assert state.players[9]["x"] == 210.0
    assert state.players[9]["y"] == 220.0


def test_build_localized_snapshot_hides_other_players_only():
    snapshot = {
        "players": {
            7: {"x": 14.0, "y": 28.0, "status": "active"},
            9: {"x": 42.0, "y": 56.0, "status": "active"},
        },
        "blackholes": {
            7: {"x": 100.0, "y": 120.0},
            9: {"x": 180.0, "y": 200.0},
        },
    }

    localized = build_localized_snapshot(snapshot, 7)

    assert localized["players"][7]["x"] == 14.0
    assert localized["players"][7]["y"] == 28.0
    assert localized["players"][9]["x"] == -1000.0
    assert localized["players"][9]["y"] == -1000.0
    assert localized["blackhole_targets"][7]["x"] == 14.0
    assert localized["blackhole_targets"][7]["y"] == 28.0
    assert localized["blackhole_targets"][9]["x"] == 42.0
    assert localized["blackhole_targets"][9]["y"] == 56.0
    assert localized["blackhole_targets"][9]["status"] == "active"
    assert localized["blackholes"][9]["x"] == 180.0
    assert localized["blackholes"][9]["y"] == 200.0


def test_finish_match_with_winner_is_idempotent():
    state = DummyState(
        game_ended=True,
        winner_id=7,
        players_order=[7, 9],
        players={
            7: {"x": 10.0, "y": 20.0, "status": "escaped"},
            9: {"x": 30.0, "y": 40.0, "status": "absorbed"},
        },
        blackholes={
            7: {"x": 110.0, "y": 120.0},
            9: {"x": 210.0, "y": 220.0},
        },
    )

    changed = finish_match_with_winner(state, 7)

    assert changed is False
    assert state.winner_id == 7
