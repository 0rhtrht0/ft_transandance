from fastapi import APIRouter

from app.api.routes.progression_actions import (
    complete_stage,
    reset_progression,
    router as actions_router,
    start_stage,
)
from app.api.routes.progression_reads import (
    get_my_progression,
    get_progression_by_difficulty,
    router as reads_router,
)

router = APIRouter(prefix="/api/progression", tags=["progression"])

router.include_router(reads_router)
router.include_router(actions_router)

__all__ = [
    "complete_stage",
    "get_my_progression",
    "get_progression_by_difficulty",
    "reset_progression",
    "router",
    "start_stage",
]
