import logging

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .errors_messages import _normalize_error_detail, _validation_error_message

logger = logging.getLogger(__name__)


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"detail": _normalize_error_detail(exc.detail)},
    )


async def request_validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": _validation_error_message(exc)},
    )


async def unhandled_exception_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled exception during %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )


__all__ = [
    "http_exception_handler",
    "request_validation_exception_handler",
    "unhandled_exception_middleware",
    "StarletteHTTPException",
]
