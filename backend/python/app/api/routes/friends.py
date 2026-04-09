from fastapi import APIRouter
from app.api.routes.friends_list import (
    friends_summary,
    list_friends,
    remove_friend,
    router as list_router,
)
from app.api.routes.friends_request_actions import (
    accept_friend,
    request_friend,
    router as request_actions_router,
)
from app.api.routes.friends_requests import (
    cancel_request,
    list_requests,
    reject_request,
    router as requests_router,
)

router = APIRouter(prefix="/api/friends", tags=["friends"])

router.include_router(request_actions_router)
router.include_router(list_router)
router.include_router(requests_router)

__all__ = [
    "accept_friend",
    "cancel_request",
    "friends_summary",
    "list_friends",
    "list_requests",
    "reject_request",
    "remove_friend",
    "request_friend",
    "router",
]
