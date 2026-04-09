from pathlib import Path
import asyncio
import sys

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.room_manager import RoomManager


def test_create_and_join_room():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=2)

        assert room.host_id == 1
        assert room.players == [1]
        assert room.status == "waiting"
        assert room.ready_players == set()

        room = await manager.join_room(room.id, user_id=2)
        assert room.players == [1, 2]
        assert room.status == "full"
        assert room.ready_players == set()

    asyncio.run(_test())


def test_room_ready_state_requires_both_players():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=2)
        room = await manager.join_room(room.id, user_id=2)

        room = await manager.set_player_ready(room.id, user_id=1, ready=True)
        assert room.status == "full"
        assert room.ready_players == {1}

        room = await manager.set_player_ready(room.id, user_id=2, ready=True)
        assert room.status == "ready"
        assert room.ready_players == {1, 2}

        room = await manager.set_player_ready(room.id, user_id=2, ready=False)
        assert room.status == "full"
        assert room.ready_players == {1}

    asyncio.run(_test())


def test_join_room_full_raises():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=2)
        await manager.join_room(room.id, user_id=2)

        with pytest.raises(ValueError, match="Room is full"):
            await manager.join_room(room.id, user_id=3)

    asyncio.run(_test())


def test_leave_room_promotes_host_and_deletes_empty_room():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=2)
        await manager.join_room(room.id, user_id=2)
        await manager.set_player_ready(room.id, user_id=1, ready=True)

        updated_room = await manager.leave_room(room.id, user_id=1)
        assert updated_room is not None
        assert updated_room.host_id == 2
        assert updated_room.players == [2]
        assert updated_room.status == "waiting"
        assert updated_room.ready_players == set()

        deleted_room = await manager.leave_room(room.id, user_id=2)
        assert deleted_room is None

        with pytest.raises(ValueError, match="Room not found"):
            await manager.get_room(room.id)

    asyncio.run(_test())


def test_close_room_requires_host():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=2)
        await manager.join_room(room.id, user_id=2)

        with pytest.raises(ValueError, match="Only host can close the room"):
            await manager.close_room(room.id, requested_by=2)

        closed_room = await manager.close_room(room.id, requested_by=1)
        assert closed_room.id == room.id

        with pytest.raises(ValueError, match="Room not found"):
            await manager.get_room(room.id)

    asyncio.run(_test())


def test_start_room_requires_host_and_all_ready():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=2)
        await manager.join_room(room.id, user_id=2)

        with pytest.raises(ValueError, match="Only host can start the room"):
            await manager.start_room(room.id, requested_by=2)

        with pytest.raises(ValueError, match="All players must be ready"):
            await manager.start_room(room.id, requested_by=1)

        await manager.set_player_ready(room.id, user_id=1, ready=True)
        await manager.set_player_ready(room.id, user_id=2, ready=True)

        started = await manager.start_room(room.id, requested_by=1)
        assert started.status == "in_progress"

        with pytest.raises(ValueError, match="Room has already started"):
            await manager.set_player_ready(room.id, user_id=2, ready=False)

    asyncio.run(_test())


def test_start_room_allows_ready_players_before_capacity_is_full():
    async def _test():
        manager = RoomManager()
        room = await manager.create_room(host_id=1, max_players=4)
        await manager.join_room(room.id, user_id=2)

        with pytest.raises(ValueError, match="All players must be ready"):
            await manager.start_room(room.id, requested_by=1)

        await manager.set_player_ready(room.id, user_id=1, ready=True)
        await manager.set_player_ready(room.id, user_id=2, ready=True)

        started = await manager.start_room(room.id, requested_by=1)
        assert started.status == "in_progress"

    asyncio.run(_test())
