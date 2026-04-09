from collections import defaultdict
from fastapi import WebSocket

_active_connections: dict[int, WebSocket] = {}
_room_members: dict[str, set[int]] = defaultdict(set)
_conversation_members: dict[int, set[int]] = defaultdict(set)


async def connect_user(user_id: int, websocket: WebSocket) -> None:
    """Register or replace a user's active websocket connection."""
    await websocket.accept()

    previous = _active_connections.get(user_id)
    _active_connections[user_id] = websocket

    if previous and previous is not websocket:
        try:
            await previous.close()
        except Exception:
            pass


def disconnect_user(user_id: int) -> None:
    """Remove a user from active connections and all subscriptions."""
    _active_connections.pop(user_id, None)

    empty_rooms: list[str] = []
    for room_id, members in _room_members.items():
        members.discard(user_id)
        if not members:
            empty_rooms.append(room_id)
    for room_id in empty_rooms:
        _room_members.pop(room_id, None)

    empty_conversations: list[int] = []
    for conversation_id, members in _conversation_members.items():
        members.discard(user_id)
        if not members:
            empty_conversations.append(conversation_id)
    for conversation_id in empty_conversations:
        _conversation_members.pop(conversation_id, None)


def join_room(user_id: int, room_id: str) -> bool:
    """Subscribe a user to a room channel."""
    members = _room_members[room_id]
    before = len(members)
    members.add(user_id)
    return len(members) > before


def leave_room(user_id: int, room_id: str) -> bool:
    """Unsubscribe a user from a room channel."""
    members = _room_members.get(room_id)
    if not members or user_id not in members:
        return False
    members.discard(user_id)
    if not members:
        _room_members.pop(room_id, None)
    return True


def join_conversation(user_id: int, conversation_id: int) -> bool:
    """Subscribe a user to a conversation channel."""
    members = _conversation_members[conversation_id]
    before = len(members)
    members.add(user_id)
    return len(members) > before


def leave_conversation(user_id: int, conversation_id: int) -> bool:
    """Unsubscribe a user from a conversation channel."""
    members = _conversation_members.get(conversation_id)
    if not members or user_id not in members:
        return False
    members.discard(user_id)
    if not members:
        _conversation_members.pop(conversation_id, None)
    return True


async def send_to_user(user_id: int, payload: dict) -> bool:
    """Best-effort send to one user. Returns True if delivered."""
    ws = _active_connections.get(user_id)

    if ws is None:
        return False

    try:
        await ws.send_json(payload)
        return True
    except Exception:
        disconnect_user(user_id)
        return False


async def publish_room(room_id: str, payload: dict) -> int:
    """Broadcast payload to all users subscribed to a room."""
    user_ids = list(_room_members.get(room_id, set()))
    delivered = 0

    for uid in user_ids:
        if await send_to_user(uid, payload):
            delivered += 1
    return delivered


async def publish_conversation(conversation_id: int, payload: dict) -> int:
    """Broadcast payload to all users subscribed to a conversation."""
    user_ids = list(_conversation_members.get(conversation_id, set()))
    delivered = 0

    for uid in user_ids:
        if await send_to_user(uid, payload):
            delivered += 1
    return delivered


__all__ = [
    "connect_user",
    "disconnect_user",
    "join_room",
    "leave_room",
    "join_conversation",
    "leave_conversation",
    "send_to_user",
    "publish_room",
    "publish_conversation",
]