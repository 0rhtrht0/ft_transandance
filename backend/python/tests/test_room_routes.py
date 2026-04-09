from pathlib import Path
import asyncio
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes import rooms as rooms_routes
from app.api.routes import rooms_actions as rooms_actions_routes
from app.api.routes import rooms_queries as rooms_queries_routes
from app.core.game_state import active_games
from app.realtime.contracts import (
    EVENT_ROOM_CLOSED,
    EVENT_ROOM_MATCH_START,
    EVENT_ROOM_PLAYER_JOINED,
    EVENT_ROOM_PLAYER_LEFT,
    EVENT_ROOM_READY_STATE,
    EVENT_ROOM_STATE_UPDATED,
)
from app.core.room_manager import room_manager


@pytest.fixture(autouse=True)
def clear_rooms():
    room_manager.rooms.clear()
    room_manager.quick_rooms.clear()
    active_games.clear()
    yield
    room_manager.rooms.clear()
    room_manager.quick_rooms.clear()
    active_games.clear()


def test_join_room_emits_player_joined_event(monkeypatch):
    room_events = []
    personal_events = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        personal_events.append((user_id, message))
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        created = await rooms_routes.create_room(current_user=SimpleNamespace(id=1))
        room_events.clear()
        personal_events.clear()
        await rooms_routes.join_room(
            created["room_id"],
            current_user=SimpleNamespace(id=2),
        )

    asyncio.run(_test())

    assert len(room_events) == 2
    assert [event[1]["type"] for event in room_events] == [
        "player_joined",
        "room_state",
    ]
    assert [event[1]["event"] for event in room_events] == [
        EVENT_ROOM_PLAYER_JOINED,
        EVENT_ROOM_STATE_UPDATED,
    ]
    joined_room_id, joined_message = room_events[0]
    assert joined_message["joined_user_id"] == 2
    assert joined_room_id is not None
    assert [entry["id"] for entry in joined_message["players_meta"]] == [1, 2]
    assert [entry["avatar"] for entry in joined_message["players_meta"]] == [None, None]
    room_state_room_id, room_state_message = room_events[1]
    assert room_state_message["status"] == "full"
    assert room_state_message["all_ready"] is False
    assert room_state_room_id == joined_room_id
    assert personal_events == []


def test_set_room_ready_emits_ready_state_without_auto_start(monkeypatch):
    room_events = []
    personal_events = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        personal_events.append((user_id, message))
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        created = await rooms_routes.create_room(current_user=SimpleNamespace(id=1))
        await rooms_routes.join_room(
            created["room_id"],
            current_user=SimpleNamespace(id=2),
        )

        room_events.clear()
        await rooms_actions_routes.set_room_ready(
            created["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=1),
        )
        assert [event[1]["type"] for event in room_events] == ["room_ready_state", "room_state"]
        assert room_events[0][1]["event"] == EVENT_ROOM_READY_STATE
        assert room_events[1][1]["event"] == EVENT_ROOM_STATE_UPDATED

        room_events.clear()
        await rooms_actions_routes.set_room_ready(
            created["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=2),
        )

    asyncio.run(_test())

    assert len(room_events) == 2
    assert [event[1]["type"] for event in room_events] == [
        "room_ready_state",
        "room_state",
    ]
    assert [event[1]["event"] for event in room_events] == [
        EVENT_ROOM_READY_STATE,
        EVENT_ROOM_STATE_UPDATED,
    ]
    assert personal_events == []


def test_start_room_requires_host_and_emits_match_start(monkeypatch):
    room_events = []
    personal_events = []
    started_loops = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        personal_events.append((user_id, message))
        return True

    async def fake_run_game_loop(room_id):
        started_loops.append(room_id)
        return None

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)
    monkeypatch.setattr(rooms_actions_routes, "run_game_loop", fake_run_game_loop)

    async def _test():
        created = await rooms_routes.create_room(current_user=SimpleNamespace(id=1))
        await rooms_routes.join_room(
            created["room_id"],
            current_user=SimpleNamespace(id=2),
        )
        await rooms_actions_routes.set_room_ready(
            created["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=1),
        )
        await rooms_actions_routes.set_room_ready(
            created["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=2),
        )

        with pytest.raises(HTTPException) as exc:
            await rooms_actions_routes.start_room(
                created["room_id"],
                current_user=SimpleNamespace(id=2),
            )
        assert exc.value.status_code == 403

        room_events.clear()
        result = await rooms_actions_routes.start_room(
            created["room_id"],
            current_user=SimpleNamespace(id=1),
        )

        assert result["status"] == "started"
        assert result["event"] == EVENT_ROOM_MATCH_START
        assert result["type"] == "match_start"
        assert result["players"] == [1, 2]

    asyncio.run(_test())

    assert started_loops == []
    assert len(room_events) == 1
    match_start_message = room_events[0][1]
    assert match_start_message["type"] == "match_start"
    assert match_start_message["event"] == EVENT_ROOM_MATCH_START
    assert match_start_message["players"] == [1, 2]
    assert [entry["id"] for entry in match_start_message["players_meta"]] == [1, 2]
    assert isinstance(match_start_message["seed"], int)
    assert match_start_message["tick_rate"] > 0
    assert "start_state" in match_start_message
    assert match_start_message["start_state"] == match_start_message["startState"]
    assert match_start_message["start_state"]["is_multiplayer"] is True
    assert match_start_message["start_state"]["door"] is not None
    assert match_start_message["start_state"]["door_world"] is not None
    assert personal_events[0][0] == 1


def test_leave_room_emits_player_left_event(monkeypatch):
    room_events = []
    personal_events = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        personal_events.append((user_id, message))
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        created = await rooms_routes.create_room(current_user=SimpleNamespace(id=1))
        await rooms_routes.join_room(
            created["room_id"],
            current_user=SimpleNamespace(id=2),
        )
        room_events.clear()
        personal_events.clear()
        await rooms_routes.leave_room(
            created["room_id"],
            current_user=SimpleNamespace(id=2),
        )

    asyncio.run(_test())

    assert len(room_events) == 2
    assert [event[1]["type"] for event in room_events] == ["player_left", "room_state"]
    assert [event[1]["event"] for event in room_events] == [
        EVENT_ROOM_PLAYER_LEFT,
        EVENT_ROOM_STATE_UPDATED,
    ]
    left_room_id, left_message = room_events[0]
    assert left_message["left_user_id"] == 2
    room_state_room_id, room_state_message = room_events[1]
    assert room_state_room_id == left_room_id
    assert room_state_message["players"] == [1]
    assert room_state_message["ready_players"] == []
    assert personal_events == []


def test_close_room_requires_host_and_emits_room_closed(monkeypatch):
    room_events = []
    personal_events = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        personal_events.append((user_id, message))
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        created = await rooms_routes.create_room(current_user=SimpleNamespace(id=1))
        await rooms_routes.join_room(
            created["room_id"],
            current_user=SimpleNamespace(id=2),
        )
        room_events.clear()
        personal_events.clear()

        with pytest.raises(HTTPException) as exc:
            await rooms_routes.close_room(
                created["room_id"],
                current_user=SimpleNamespace(id=2),
            )
        assert exc.value.status_code == 403

        result = await rooms_routes.close_room(
            created["room_id"],
            current_user=SimpleNamespace(id=1),
        )
        assert result["status"] == "room closed"

    asyncio.run(_test())

    assert len(room_events) == 1
    _, message = room_events[0]
    assert message["type"] == "room_closed"
    assert message["event"] == EVENT_ROOM_CLOSED
    assert message["closed_by"] == 1
    assert personal_events == []


def test_create_room_emits_room_state_to_host(monkeypatch):
    room_events = []
    personal_events = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        personal_events.append((user_id, message))
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        await rooms_routes.create_room(current_user=SimpleNamespace(id=42))

    asyncio.run(_test())

    assert room_events == []
    assert len(personal_events) == 1
    user_id, message = personal_events[0]
    assert message["type"] == "room_state"
    assert message["event"] == EVENT_ROOM_STATE_UPDATED
    assert message["host_id"] == 42
    assert message["all_ready"] is False
    assert user_id == 42


def test_quick_join_promotes_first_player_as_host(monkeypatch):
    room_events = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        first = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=3,
            current_user=SimpleNamespace(id=101),
        )
        second = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=3,
            current_user=SimpleNamespace(id=202),
        )

        assert first["room_id"] == second["room_id"]
        assert first["host_id"] == 101
        assert second["host_id"] == 101
        assert second["players"] == [101, 202]
        assert second["max_players"] == 4

    asyncio.run(_test())

    # second player join emits player_joined + room_state.
    assert [event[1]["type"] for event in room_events][-2:] == ["player_joined", "room_state"]


def test_quick_join_does_not_create_new_room_while_player_count_is_below_four(monkeypatch):
    async def fake_publish_room(room_id, message):
        return 1

    async def fake_send_to_user(user_id, message):
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        first = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=2,
            current_user=SimpleNamespace(id=1),
        )
        second = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=2,
            current_user=SimpleNamespace(id=2),
        )
        third = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=2,
            current_user=SimpleNamespace(id=3),
        )
        fourth = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=2,
            current_user=SimpleNamespace(id=4),
        )
        fifth = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=2,
            current_user=SimpleNamespace(id=5),
        )

        assert first["room_id"] == second["room_id"] == third["room_id"] == fourth["room_id"]
        assert fourth["players"] == [1, 2, 3, 4]
        assert fourth["max_players"] == 4
        assert fourth["status"] == "full"
        assert fifth["room_id"] != first["room_id"]
        assert fifth["players"] == [5]

    asyncio.run(_test())


def test_quick_join_reuses_same_room_even_with_different_stage(monkeypatch):
    async def fake_publish_room(room_id, message):
        return 1

    async def fake_send_to_user(user_id, message):
        return True

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)

    async def _test():
        first = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=2,
            current_user=SimpleNamespace(id=301),
        )
        second = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=9,
            current_user=SimpleNamespace(id=302),
        )

        assert first["room_id"] == second["room_id"]
        # Keep room stage stable from room creation.
        assert first["stage"] == 2
        assert second["stage"] == 2
        assert second["players"] == [301, 302]

    asyncio.run(_test())


def test_quick_join_host_can_start_with_two_ready_players(monkeypatch):
    room_events = []
    started_loops = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        return True

    async def fake_run_game_loop(room_id):
        started_loops.append(room_id)
        return None

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)
    monkeypatch.setattr(rooms_actions_routes, "run_game_loop", fake_run_game_loop)

    async def _test():
        first = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=4,
            current_user=SimpleNamespace(id=11),
        )
        second = await rooms_actions_routes.quick_join_room(
            difficulty="moyen",
            stage=4,
            current_user=SimpleNamespace(id=22),
        )

        assert first["room_id"] == second["room_id"]
        assert second["max_players"] == 4
        assert second["all_ready"] is False

        await rooms_actions_routes.set_room_ready(
            first["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=11),
        )
        ready_payload = await rooms_actions_routes.set_room_ready(
            first["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=22),
        )
        assert ready_payload["all_ready"] is True

        started = await rooms_actions_routes.start_room(
            first["room_id"],
            current_user=SimpleNamespace(id=11),
        )
        assert started["status"] == "started"
        assert started["players"] == [11, 22]

    asyncio.run(_test())

    match_start_events = [message for _, message in room_events if message.get("type") == "match_start"]
    assert len(match_start_events) == 1
    assert match_start_events[0]["players"] == [11, 22]
    assert started_loops == []


def test_quick_join_reuses_room_until_four_players_then_host_starts(monkeypatch):
    room_events = []
    started_loops = []

    async def fake_publish_room(room_id, message):
        room_events.append((room_id, message))
        return 1

    async def fake_send_to_user(user_id, message):
        return True

    async def fake_run_game_loop(room_id):
        started_loops.append(room_id)
        return None

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)
    monkeypatch.setattr(rooms_actions_routes, "run_game_loop", fake_run_game_loop)

    player_ids = [101, 202, 303, 404]

    async def _test():
        payloads = []
        for player_id in player_ids:
            payloads.append(
                await rooms_actions_routes.quick_join_room(
                    difficulty="moyen",
                    stage=3,
                    current_user=SimpleNamespace(id=player_id),
                )
            )

        room_id = payloads[0]["room_id"]
        assert all(payload["room_id"] == room_id for payload in payloads)
        assert payloads[-1]["host_id"] == player_ids[0]
        assert payloads[-1]["players"] == player_ids
        assert payloads[-1]["max_players"] == 4
        assert payloads[-1]["status"] == "full"

        for player_id in player_ids:
            await rooms_actions_routes.set_room_ready(
                room_id,
                ready=True,
                current_user=SimpleNamespace(id=player_id),
            )

        with pytest.raises(HTTPException) as exc:
            await rooms_actions_routes.start_room(
                room_id,
                current_user=SimpleNamespace(id=player_ids[1]),
            )
        assert exc.value.status_code == 403

        result = await rooms_actions_routes.start_room(
            room_id,
            current_user=SimpleNamespace(id=player_ids[0]),
        )
        assert result["status"] == "started"
        assert result["players"] == player_ids
        assert result["max_players"] == 4

    asyncio.run(_test())

    joined_events = [message for _, message in room_events if message.get("type") == "player_joined"]
    ready_events = [message for _, message in room_events if message.get("type") == "room_ready_state"]
    room_state_events = [message for _, message in room_events if message.get("type") == "room_state"]
    match_start_events = [message for _, message in room_events if message.get("type") == "match_start"]

    assert len(joined_events) == 3
    assert len(ready_events) == 4
    assert len(room_state_events) == 8
    assert len(match_start_events) == 1
    assert match_start_events[0]["event"] == EVENT_ROOM_MATCH_START
    assert match_start_events[0]["players"] == player_ids
    assert [entry["id"] for entry in match_start_events[0]["players_meta"]] == player_ids
    assert started_loops == []


def test_get_room_start_state_returns_validated_payload(monkeypatch):
    async def fake_publish_room(room_id, message):
        return 1

    async def fake_send_to_user(user_id, message):
        return True

    async def fake_run_game_loop(room_id):
        return None

    monkeypatch.setattr(rooms_actions_routes, "publish_room", fake_publish_room)
    monkeypatch.setattr(rooms_actions_routes, "send_to_user", fake_send_to_user)
    monkeypatch.setattr(rooms_actions_routes, "run_game_loop", fake_run_game_loop)

    async def _test():
        created = await rooms_routes.create_room(current_user=SimpleNamespace(id=10))
        await rooms_routes.join_room(
            created["room_id"],
            current_user=SimpleNamespace(id=11),
        )

        preview = await rooms_queries_routes.get_room_start_state(created["room_id"])
        assert preview["validated"] is True
        assert preview["source"] == "generated_preview"
        assert preview["start_state"]["is_multiplayer"] is True
        assert preview["start_state"]["door"] is not None
        assert preview["start_state"]["door_world"] is not None

        await rooms_actions_routes.set_room_ready(
            created["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=10),
        )
        await rooms_actions_routes.set_room_ready(
            created["room_id"],
            ready=True,
            current_user=SimpleNamespace(id=11),
        )
        await rooms_actions_routes.start_room(
            created["room_id"],
            current_user=SimpleNamespace(id=10),
        )

        active = await rooms_queries_routes.get_room_start_state(created["room_id"])
        assert active["validated"] is True
        assert active["source"] == "active_game"
        assert active["start_state"]["is_multiplayer"] is True
        assert active["start_state"]["door"] is not None
        assert active["start_state"]["door_world"] is not None

    asyncio.run(_test())
