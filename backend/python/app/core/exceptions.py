from typing import Mapping

from fastapi import HTTPException


class APIException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        headers: Mapping[str, str] | None = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class PlayerNotFound(APIException):
    def __init__(self):
        super().__init__(404, "Player not found")


class GameNotFound(APIException):
    def __init__(self):
        super().__init__(404, "Game not found")


class AlreadyInQueue(APIException):
    def __init__(self):
        super().__init__(400, "Player already in matchmaking queue")


class EmptyLeaderboard(APIException):
    def __init__(self):
        super().__init__(404, "Leaderboard is empty")


class UserNotFound(APIException):
    def __init__(self):
        super().__init__(404, "User not found")


class ProfileNotFound(APIException):
    def __init__(self):
        super().__init__(404, "Profile not found")


class UsernameOrEmailAlreadyExists(APIException):
    def __init__(self):
        super().__init__(400, "Username or email already exists")


class UsernameAlreadyTaken(APIException):
    def __init__(self):
        super().__init__(400, "Username already taken")


class EmailAlreadyTaken(APIException):
    def __init__(self):
        super().__init__(400, "Email already taken")


class InvalidImageUpload(APIException):
    def __init__(self):
        super().__init__(400, "Only image uploads are allowed")


class InvalidFilename(APIException):
    def __init__(self):
        super().__init__(400, "Invalid filename")


class AdminPrivilegesRequired(APIException):
    def __init__(self):
        super().__init__(403, "Admin privileges required")


class InvalidCredentials(APIException):
    def __init__(self):
        super().__init__(
            401,
            "Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


class IncorrectUsernameOrPassword(APIException):
    def __init__(self):
        super().__init__(
            401,
            "Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
