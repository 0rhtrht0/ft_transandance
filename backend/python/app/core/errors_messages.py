from typing import Any

from fastapi.exceptions import RequestValidationError


def _normalize_error_detail(detail: Any) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        for key in ("detail", "message", "msg"):
            value = detail.get(key)
            if isinstance(value, str):
                return value
    if isinstance(detail, list) and detail:
        first = detail[0]
        if isinstance(first, dict):
            loc = ".".join(str(item) for item in first.get("loc", []))
            msg = first.get("msg", "Invalid request")
            return f"{loc}: {msg}" if loc else msg
        return str(first)
    return "Unexpected error"


def _validation_error_message(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid request payload"

    first = errors[0]
    loc = ".".join(str(item) for item in first.get("loc", []))
    msg = first.get("msg", "Invalid request payload")
    return f"{loc}: {msg}" if loc else msg
