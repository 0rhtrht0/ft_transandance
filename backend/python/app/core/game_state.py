from __future__ import annotations

from dataclasses import dataclass, field
import random
import time
from typing import Any, Optional

from .maze_generator import generate_maze_logic

DEFAULT_TILE_SIZE = 28


def cell_to_world(cell: dict[str, int], tile_size: int = DEFAULT_TILE_SIZE) -> dict[str, float]:
    return {
        "x": cell["x"] * tile_size + tile_size * 0.5,
        "y": cell["y"] * tile_size + tile_size * 0.5,
    }


def build_start_state_payload(
    layout: dict[str, Any],
    seed: int | str,
    difficulty: str,
    stage: int,
    is_multiplayer: bool,
    spawn_by_player: Optional[dict[int, dict[str, int]]] = None,
    blackholes_by_player: Optional[dict[int, dict[str, int]]] = None,
    tile_size: int = DEFAULT_TILE_SIZE,
) -> dict[str, Any]:
    door = layout.get("door") if isinstance(layout, dict) else None
    door_world = cell_to_world(door, tile_size) if isinstance(door, dict) else None

    return {
        "seed": seed,
        "difficulty": difficulty,
        "stage": stage,
        "is_multiplayer": is_multiplayer,
        "tile_size": tile_size,
        "cols": layout.get("cols"),
        "rows": layout.get("rows"),
        "grid": layout.get("grid"),
        "p1": layout.get("p1"),
        "p2": layout.get("p2"),
        "door": door,
        "door_world": door_world,
        "bh1": layout.get("bh1"),
        "bh2": layout.get("bh2"),
        "spawn_by_player": {
            str(player_id): cell
            for player_id, cell in (spawn_by_player or {}).items()
            if isinstance(cell, dict)
        },
        "blackholes_by_player": {
            str(player_id): cell
            for player_id, cell in (blackholes_by_player or {}).items()
            if isinstance(cell, dict)
        },
    }


@dataclass
class GameState:
    room_id: str
    players_order: list[int]
    seed: int
    tick_rate: int
    difficulty: str = "moyen"
    stage: int = 1
    tick: int = 0
    running: bool = True
    game_ended: bool = False
    winner_id: Optional[int] = None
    exit_pos: Optional[dict[str, float]] = None
    players: dict[int, dict[str, Any]] = field(default_factory=dict)
    blackholes: dict[int, dict[str, float]] = field(default_factory=dict)
    players_meta: list[dict[str, Any]] = field(default_factory=list)
    start_layout: Optional[dict[str, Any]] = None

    def __post_init__(self) -> None:
        is_multiplayer = len(self.players_order) > 1
        if self.start_layout is None:
            self.start_layout = generate_maze_logic(
                seed=self.seed,
                difficulty=self.difficulty,
                stage=self.stage,
                is_multiplayer=is_multiplayer,
            )

        door = self.start_layout.get("door") if isinstance(self.start_layout, dict) else None
        self.exit_pos = cell_to_world(door) if isinstance(door, dict) else None

        for user_id in list(self.players_order):
            self.ensure_player(user_id)

        self._apply_initial_positions_from_layout()

    @staticmethod
    def _cell_key(cell: dict[str, int]) -> str:
        try:
            return f"{int(cell['x'])},{int(cell['y'])}"
        except (KeyError, TypeError, ValueError):
            return ""

    @staticmethod
    def _iter_open_cells(grid: list[list[int]]) -> list[dict[str, int]]:
        open_cells: list[dict[str, int]] = []
        for y, row in enumerate(grid):
            if not isinstance(row, list):
                continue
            for x, value in enumerate(row):
                if value == 0:
                    open_cells.append({"x": x, "y": y})
        return open_cells

    def _apply_initial_positions_from_layout(self) -> None:
        if not isinstance(self.start_layout, dict):
            return

        p1 = self.start_layout.get("p1")
        p2 = self.start_layout.get("p2")
        bh1 = self.start_layout.get("bh1")
        bh2 = self.start_layout.get("bh2")
        if not isinstance(p1, dict):
            return

        sorted_players = sorted(int(user_id) for user_id in self.players_order)
        if not sorted_players:
            return

        spawn_by_player: dict[int, dict[str, int]] = {sorted_players[0]: p1}
        blackhole_by_player: dict[int, dict[str, int]] = {}
        if isinstance(bh1, dict):
            blackhole_by_player[sorted_players[0]] = bh1

        if len(sorted_players) > 1 and isinstance(p2, dict):
            spawn_by_player[sorted_players[1]] = p2
        if len(sorted_players) > 1 and isinstance(bh2, dict):
            blackhole_by_player[sorted_players[1]] = bh2

        grid = self.start_layout.get("grid")
        if len(sorted_players) > 2 and isinstance(grid, list):
            open_cells = self._iter_open_cells(grid)
            occupied: set[str] = set()
            door = self.start_layout.get("door")
            if isinstance(door, dict):
                door_key = self._cell_key(door)
                if door_key:
                    occupied.add(door_key)
            for cell in spawn_by_player.values():
                if isinstance(cell, dict):
                    cell_key = self._cell_key(cell)
                    if cell_key:
                        occupied.add(cell_key)
            for cell in blackhole_by_player.values():
                if isinstance(cell, dict):
                    cell_key = self._cell_key(cell)
                    if cell_key:
                        occupied.add(cell_key)

            try:
                rng_seed = int(self.seed)
            except (TypeError, ValueError):
                rng_seed = 0
            rng = random.Random(rng_seed)

            def get_dist(c1, c2):
                if not isinstance(c1, dict) or not isinstance(c2, dict):
                    return 0
                return abs(c1.get('x', 0) - c2.get('x', 0)) + abs(c1.get('y', 0) - c2.get('y', 0))

            missing_spawn_players = [player_id for player_id in sorted_players if player_id not in spawn_by_player]
            if missing_spawn_players:
                spawn_candidates = [
                    cell for cell in open_cells 
                    if self._cell_key(cell) not in occupied and get_dist(cell, door) >= 5
                ]
                rng.shuffle(spawn_candidates)
                for player_id in missing_spawn_players:
                    chosen = spawn_candidates.pop() if spawn_candidates else p1
                    if isinstance(chosen, dict):
                        spawn_by_player[player_id] = chosen
                        chosen_key = self._cell_key(chosen)
                        if chosen_key:
                            occupied.add(chosen_key)

            missing_blackhole_players = [player_id for player_id in sorted_players if player_id not in blackhole_by_player]
            if missing_blackhole_players:
                blackhole_candidates = [cell for cell in open_cells if self._cell_key(cell) not in occupied]
                rng.shuffle(blackhole_candidates)
                for player_id in missing_blackhole_players:
                    chosen = (
                        blackhole_candidates.pop()
                        if blackhole_candidates
                        else spawn_by_player.get(player_id) or bh1 or p1
                    )
                    if isinstance(chosen, dict):
                        blackhole_by_player[player_id] = chosen
                        chosen_key = self._cell_key(chosen)
                        if chosen_key:
                            occupied.add(chosen_key)

        self.blackholes.clear()
        for user_id in list(self.players_order):
            player = self.ensure_player(user_id)
            spawn_cell = spawn_by_player.get(user_id) or p1
            if isinstance(spawn_cell, dict):
                spawn_world = cell_to_world(spawn_cell)
                player["x"] = spawn_world["x"]
                player["y"] = spawn_world["y"]

            blackhole_cell = blackhole_by_player.get(user_id) or spawn_by_player.get(user_id) or bh1 or p1
            if isinstance(blackhole_cell, dict):
                self.blackholes[user_id] = cell_to_world(blackhole_cell)

    def get_start_state_payload(self) -> dict[str, Any]:
        spawn_by_player: dict[int, dict[str, int]] = {}
        blackholes_by_player: dict[int, dict[str, int]] = {}

        tile_size = DEFAULT_TILE_SIZE

        for user_id, player in self.players.items():
            if not isinstance(player, dict):
                continue
            if "x" not in player or "y" not in player:
                continue
            try:
                cell_x = int(float(player["x"]) / tile_size)
                cell_y = int(float(player["y"]) / tile_size)
            except (TypeError, ValueError):
                continue
            spawn_by_player[int(user_id)] = {"x": cell_x, "y": cell_y}

        for user_id, blackhole in self.blackholes.items():
            if not isinstance(blackhole, dict):
                continue
            if "x" not in blackhole or "y" not in blackhole:
                continue
            try:
                cell_x = int(float(blackhole["x"]) / tile_size)
                cell_y = int(float(blackhole["y"]) / tile_size)
            except (TypeError, ValueError):
                continue
            blackholes_by_player[int(user_id)] = {"x": cell_x, "y": cell_y}

        return build_start_state_payload(
            layout=self.start_layout or {},
            seed=self.seed,
            difficulty=self.difficulty,
            stage=self.stage,
            is_multiplayer=len(self.players_order) > 1,
            spawn_by_player=spawn_by_player,
            blackholes_by_player=blackholes_by_player,
        )

    def ensure_player(self, user_id: int) -> dict[str, Any]:
        if user_id not in self.players:
            self.players[user_id] = {
                "x": 0.0,
                "y": 0.0,
                "evaluation_points": 0,
                "level": 1,
                "time_ms": 0,
            }
            if user_id not in self.players_order:
                self.players_order.append(user_id)
        return self.players[user_id]

    def update_player(self, user_id: int, payload: dict[str, Any]) -> None:
        player = self.ensure_player(user_id)
        for key in ("x", "y", "evaluation_points", "level", "time_ms"):
            if key in payload and payload[key] is not None:
                player[key] = payload[key]
        if "score" in payload and payload["score"] is not None and "evaluation_points" not in payload:
            player["evaluation_points"] = payload["score"]
        if "status" in payload and payload["status"] == "absorbed":
            player["status"] = "absorbed"
        if "blackhole" in payload and isinstance(payload["blackhole"], dict):
            self.blackholes[user_id] = payload["blackhole"]

    def remove_player(self, user_id: int) -> None:
        self.players.pop(user_id, None)
        if user_id in self.players_order:
            self.players_order.remove(user_id)

    def build_snapshot(self) -> dict:
        return {
            "room_id": self.room_id,
            "tick": self.tick,
            "players": self.players,
            "players_order": self.players_order,
            "players_meta": self.players_meta,
            "seed": self.seed,
            "blackholes": self.blackholes,
            "server_time": int(time.time() * 1000),
            "game_ended": self.game_ended,
            "winner_id": self.winner_id,
            "exit_pos": self.exit_pos,
        }


active_games: dict[str, GameState] = {}
