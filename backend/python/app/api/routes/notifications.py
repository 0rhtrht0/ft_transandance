from fastapi import APIRouter

from .notifications_read import router as read_router
from .notifications_write import router as write_router

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
router.include_router(read_router)
router.include_router(write_router)

__all__ = ["router"]
