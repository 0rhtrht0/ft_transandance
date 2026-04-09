import asyncio
from typing import Dict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.rooms: dict[str, set[int]] = {}
        self.user_rooms: dict[int, str] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        previous_websocket = self.active_connections.get(user_id)
        self.active_connections[user_id] = websocket
        if previous_websocket and previous_websocket is not websocket:
            try:
                await previous_websocket.close()
            except Exception:
                pass

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        room_id = self.user_rooms.pop(user_id, None)
        if room_id:
            room = self.rooms.get(room_id)
            if room:
                room.discard(user_id)
                if not room:
                    self.rooms.pop(room_id, None)

    async def send_personal_message(self, message: dict, user_id: int) -> bool:
        websocket = self.active_connections.get(user_id)
        if websocket is None:
            return False
        try:
            await websocket.send_json(message)
            return True
        except Exception:
            self.disconnect(user_id)
            return False

    async def send_to_user(self, user_id: int, message: dict) -> bool:
        return await self.send_personal_message(message, user_id)

    async def send_room_message(
        self,
        message: dict,
        user_ids: list[int],
        exclude_user_id: int | None = None,
    ) -> None:
        recipients = [
            user_id for user_id in user_ids
            if exclude_user_id is None or user_id != exclude_user_id
        ]
        if not recipients:
            return
        await asyncio.gather(
            *(self.send_personal_message(message, user_id) for user_id in recipients)
        )

    async def broadcast_room(self, room_id: str, message: dict) -> None:
        users = list(self.rooms.get(room_id, set()))
        if not users:
            return
        await self.send_room_message(message, users)

    async def broadcast(self, message: dict):
        stale_users: list[int] = []
        for user_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_json(message)
            except Exception:
                stale_users.append(user_id)

        for user_id in stale_users:
            self.disconnect(user_id)

    def add_user_to_room(self, room_id: str, user_id: int) -> None:
        self.rooms.setdefault(room_id, set()).add(user_id)
        self.user_rooms[user_id] = room_id

    def remove_user_from_room(self, room_id: str, user_id: int) -> None:
        room = self.rooms.get(room_id)
        if not room:
            return
        room.discard(user_id)
        if not room:
            self.rooms.pop(room_id, None)
        if self.user_rooms.get(user_id) == room_id:
            self.user_rooms.pop(user_id, None)

    def get_user_room(self, user_id: int) -> str | None:
        return self.user_rooms.get(user_id)

manager = ConnectionManager()
