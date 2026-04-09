from fastapi import WebSocket


class ConnectionManager:

    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}
        self.rooms: dict[str, list[int]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):

        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):

        websocket = self.active_connections.get(user_id)
        if websocket:
            await websocket.send_json(message)

    async def broadcast_room(self, room_id: str, message: dict):

        users = self.rooms.get(room_id, [])
        for user_id in users:
            websocket = self.active_connections.get(user_id)
            if websocket:
                await websocket.send_json(message)

    def add_user_to_room(self, room_id: str, user_id: int):
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(user_id)

    def remove_user_from_room(self, room_id: str, user_id: int):
        if room_id in self.rooms:
            if user_id in self.rooms[room_id]:
                self.rooms[room_id].remove(user_id)