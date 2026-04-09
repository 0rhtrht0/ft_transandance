from typing import Any

from fastapi import status

from app.schemas.common import ErrorResponse

ERROR_SPECS: dict[int, dict[str, str]] = {
    status.HTTP_400_BAD_REQUEST: {
        "description": "Requete invalide",
        "example": "Invalid request payload",
    },
    status.HTTP_401_UNAUTHORIZED: {
        "description": "Authentification requise",
        "example": "Could not validate credentials",
    },
    status.HTTP_403_FORBIDDEN: {
        "description": "Acces interdit",
        "example": "Admin privileges required",
    },
    status.HTTP_404_NOT_FOUND: {
        "description": "Ressource introuvable",
        "example": "Resource not found",
    },
    status.HTTP_429_TOO_MANY_REQUESTS: {
        "description": "Trop de requetes",
        "example": "Too many failed login attempts. Try again later.",
    },
    status.HTTP_500_INTERNAL_SERVER_ERROR: {
        "description": "Erreur interne du serveur",
        "example": "Internal server error",
    },
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "description": "Service indisponible",
        "example": "Service unavailable",
    },
}


def standard_error_responses(*status_codes: int) -> dict[int, dict[str, Any]]:
    responses: dict[int, dict[str, Any]] = {}
    for code in status_codes:
        if code not in ERROR_SPECS:
            raise ValueError(f"Unsupported status code in documentation helper: {code}")
        spec = ERROR_SPECS[code]
        responses[code] = {
            "model": ErrorResponse,
            "description": spec["description"],
            "content": {"application/json": {"example": {"detail": spec["example"]}}},
        }
    return responses
