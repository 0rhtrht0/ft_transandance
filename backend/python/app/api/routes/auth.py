import asyncio

from fastapi import APIRouter

from app.core.config import settings

from app.api.routes.auth_google import login_google, router as google_router
from app.api.routes.auth_login import login, router as login_router
from app.api.routes.auth_me import logout, read_auth_me, router as me_router, update_auth_me
from app.api.routes.auth_password_reset import (
    forgot_password,
    reset_password as _reset_password,
    router as password_reset_router,
)
from app.api.routes.auth_rate_limit import reset_login_rate_limit_state
from app.api.routes.auth_signup import router as signup_router, signup

router = APIRouter(prefix="/auth", tags=["auth"])

router.include_router(signup_router)
router.include_router(login_router)
router.include_router(google_router)
router.include_router(password_reset_router)
router.include_router(me_router)

def reset_password(*args, **kwargs):
    result = _reset_password(*args, **kwargs)
    if asyncio.iscoroutine(result):
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(result)
        return result
    return result

__all__ = [
    "login",
    "login_google",
    "logout",
    "forgot_password",
    "read_auth_me",
    "reset_password",
    "reset_login_rate_limit_state",
    "router",
    "settings",
    "signup",
    "update_auth_me",
]
