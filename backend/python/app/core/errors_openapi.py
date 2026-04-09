from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi import HTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import ErrorResponse

from .errors_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
    unhandled_exception_middleware,
)
from .errors_specs import ERROR_SPECS


def configure_error_handling(app: FastAPI) -> None:
    app.middleware("http")(unhandled_exception_middleware)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(
        RequestValidationError, request_validation_exception_handler
    )

    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema

        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )

        for path_item in openapi_schema.get("paths", {}).values():
            for operation in path_item.values():
                if not isinstance(operation, dict):
                    continue
                responses = operation.get("responses", {})
                validation_response = responses.pop("422", None)
                if validation_response is None:
                    continue

                responses.setdefault(
                    "400",
                    {
                        "description": ERROR_SPECS[status.HTTP_400_BAD_REQUEST][
                            "description"
                        ],
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                                "example": {
                                    "detail": ERROR_SPECS[status.HTTP_400_BAD_REQUEST][
                                        "example"
                                    ]
                                },
                            }
                        },
                    },
                )

        app.openapi_schema = openapi_schema
        return app.openapi_schema

    app.openapi = custom_openapi


__all__ = ["configure_error_handling", "ErrorResponse"]
