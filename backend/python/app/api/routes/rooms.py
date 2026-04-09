from fastapi import APIRouter

from app.api.routes.rooms_actions import (
    close_room,
    create_room,
    join_room,
    leave_room,
    quick_join_room,
    router as actions_router,
    set_room_ready,
    start_room,
)
from app.api.routes.rooms_queries import (
    get_room,
    get_room_start_state,
    router as queries_router,
)

router = APIRouter(tags=["rooms"])

router.include_router(actions_router)
router.include_router(queries_router)

__all__ = [
    "close_room",
    "create_room",
    "get_room",
    "get_room_start_state",
    "join_room",
    "leave_room",
    "quick_join_room",
    "set_room_ready",
    "start_room",
    "router",
]
