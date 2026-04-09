import asyncio
import secrets
import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Room:
    id: str
    host_id: int
    players: list[int] = field(default_factory=list)
    max_players: int = 2
    status: str = "waiting"
    ready_players: set[int] = field(default_factory=set)
    seed: int = 0
    difficulty: str = "moyen"
    stage: int = 1
    winner_id: Optional[int] = None
    quick_key: Optional[str] = None


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.quick_rooms: dict[str, str] = {}
        self.lock = asyncio.Lock()

    def _refresh_room_status(self, room: Room) -> None:
        if room.status == "in_progress":
            return
        if len(room.players) < 2:
            room.status = "waiting"
            return
        everyone_ready = all(player_id in room.ready_players for player_id in room.players)
        if everyone_ready:
            room.status = "ready"
            return
        room.status = "full" if len(room.players) >= room.max_players else "waiting"

    def _create_seed(self) -> int:
        return secrets.randbelow(2_147_483_647) + 1

    def _build_quick_key(self, difficulty: str, stage: int) -> str:
        normalized_difficulty = str(difficulty or "moyen").strip().lower() or "moyen"
        return normalized_difficulty

    def _release_quick_room(self, room: Room) -> None:
        if not room.quick_key:
            return
        if self.quick_rooms.get(room.quick_key) == room.id:
            self.quick_rooms.pop(room.quick_key, None)

    async def create_room(self, host_id: int, max_players: int = 2, quick_key: Optional[str] = None) -> Room:
        async with self.lock:
            room_id = f"r_{uuid.uuid4().hex[:8]}"
            room = Room(
                id=room_id,
                host_id=host_id,
                players=[host_id],
                max_players=max_players,
                seed=self._create_seed(),
                quick_key=quick_key,
            )
            self.rooms[room_id] = room
            if quick_key:
                self.quick_rooms[quick_key] = room_id
            return room

    async def get_or_create_quick_room(
        self,
        user_id: int,
        difficulty: str,
        stage: int,
        max_players: int = 2,
    ) -> tuple[Room, str]:
        async with self.lock:
            quick_key = self._build_quick_key(difficulty, stage)
            room_id = self.quick_rooms.get(quick_key)
            room = self.rooms.get(room_id) if room_id else None

            if (
                room is None
                or room.status == "in_progress"
                or len(room.players) >= room.max_players
            ):
                self.quick_rooms.pop(quick_key, None)
                room_id = f"r_{uuid.uuid4().hex[:8]}"
                room = Room(
                    id=room_id,
                    host_id=user_id,
                    players=[user_id],
                    max_players=max_players,
                    seed=self._create_seed(),
                    quick_key=quick_key,
                    difficulty=str(difficulty or "moyen"),
                    stage=max(1, int(stage) if isinstance(stage, int) or str(stage).isdigit() else 1),
                )
                self.rooms[room_id] = room
                self.quick_rooms[quick_key] = room_id
                self._refresh_room_status(room)
                return room, "created"

            if user_id not in room.players:
                room.players.append(user_id)
                room.ready_players.discard(user_id)
                self._refresh_room_status(room)
                action = "joined"
            else:
                action = "existing"

            if len(room.players) >= room.max_players:
                self.quick_rooms.pop(quick_key, None)
            else:
                self.quick_rooms[quick_key] = room.id

            return room, action

    async def join_room(self, room_id: str, user_id: int) -> Room:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("Room not found")
            if room.status == "in_progress":
                raise ValueError("Room has already started")
            if user_id in room.players:
                return room
            if len(room.players) >= room.max_players:
                raise ValueError("Room is full")
            room.players.append(user_id)
            room.ready_players.discard(user_id)
            self._refresh_room_status(room)
            if room.quick_key and len(room.players) >= room.max_players:
                self.quick_rooms.pop(room.quick_key, None)
            return room

    async def leave_room(self, room_id: str, user_id: int) -> Room | None:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("Room not found")
            if user_id not in room.players:
                raise ValueError("Player is not in the room")

            room.players.remove(user_id)
            room.ready_players.discard(user_id)
            quick_key = room.quick_key
            if not room.players:
                del self.rooms[room_id]
                if quick_key and self.quick_rooms.get(quick_key) == room_id:
                    self.quick_rooms.pop(quick_key, None)
                return None

            if room.host_id == user_id:
                room.host_id = room.players[0]
            self._refresh_room_status(room)
            if quick_key:
                if room.status == "in_progress" or len(room.players) >= room.max_players:
                    self.quick_rooms.pop(quick_key, None)
                else:
                    self.quick_rooms[quick_key] = room.id
            return room

    async def set_player_ready(self, room_id: str, user_id: int, ready: bool) -> Room:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("Room not found")
            if room.status == "in_progress":
                raise ValueError("Room has already started")
            if user_id not in room.players:
                raise ValueError("Player is not in the room")
            if ready:
                room.ready_players.add(user_id)
            else:
                room.ready_players.discard(user_id)
            self._refresh_room_status(room)
            return room

    async def get_room(self, room_id: str) -> Room:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("Room not found")
            return room

    async def close_room(self, room_id: str, requested_by: int) -> Room:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("Room not found")
            if room.host_id != requested_by:
                raise ValueError("Only host can close the room")
            self._release_quick_room(room)
            del self.rooms[room_id]
            return room

    async def start_room(self, room_id: str, requested_by: int) -> Room:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("Room not found")
            if room.host_id != requested_by:
                raise ValueError("Only host can start the room")
            if room.status == "in_progress":
                return room
            if len(room.players) < 2:
                raise ValueError("At least 2 players are required")
            everyone_ready = all(player_id in room.ready_players for player_id in room.players)
            if not everyone_ready:
                raise ValueError("All players must be ready")
            room.status = "in_progress"
            self._release_quick_room(room)
            return room

    async def set_winner(self, room_id: str, winner_id: int):
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                return None
            room.winner_id = winner_id
            return room


room_manager = RoomManager()
