from fastapi import APIRouter

from app.api.routes.profile_read import (
    get_public_profile,
    get_my_profile,
    get_online_profiles,
    list_profiles,
    router as read_router,
)
from app.api.routes.profile_write import (
    delete_my_profile,
    router as write_router,
    update_my_profile,
    upload_avatar,
)

router = APIRouter(prefix="/users", tags=["profile"])

router.include_router(read_router)
router.include_router(write_router)

__all__ = [
    "delete_my_profile",
    "get_public_profile",
    "get_my_profile",
    "get_online_profiles",
    "list_profiles",
    "router",
    "update_my_profile",
    "upload_avatar",
]
