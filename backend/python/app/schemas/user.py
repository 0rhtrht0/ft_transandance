from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.usernames import USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH


class UserCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=USERNAME_MIN_LENGTH,
        max_length=USERNAME_MAX_LENGTH,
        description="Pseudo unique de l'utilisateur",
        examples=["neo42"],
    )
    email: EmailStr = Field(
        ...,
        description="Adresse email unique",
        examples=["neo42@example.com"],
    )
    password: str = Field(
        ...,
        min_length=8,
        description="Mot de passe en clair (sera hashe cote serveur)",
        examples=["S3cureP@ssw0rd"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "neo42",
                "email": "neo42@example.com",
                "password": "S3cureP@ssw0rd",
            }
        }
    )


class UserResponse(BaseModel):
    id: int = Field(..., description="Identifiant utilisateur", examples=[1])
    username: str = Field(
        ..., description="Pseudo unique de l'utilisateur", examples=["neo42"]
    )
    email: EmailStr = Field(
        ..., description="Adresse email de l'utilisateur", examples=["neo42@example.com"]
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {"id": 1, "username": "neo42", "email": "neo42@example.com"}
        },
    )


class UserUpdate(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=USERNAME_MIN_LENGTH,
        max_length=USERNAME_MAX_LENGTH,
        description="Nouveau pseudo (optionnel)",
        examples=["neo43"],
    )
    email: EmailStr | None = Field(
        default=None,
        description="Nouvel email (optionnel)",
        examples=["neo43@example.com"],
    )
    password: str | None = Field(
        default=None,
        min_length=8,
        description="Nouveau mot de passe (optionnel)",
        examples=["N3wS3cureP@ss"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "neo43",
                "email": "neo43@example.com",
                "password": "N3wS3cureP@ss",
            }
        }
    )


class UserAuthResponse(BaseModel):
    user: UserResponse
    access_token: str = Field(
        ...,
        description="JWT d'acces",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
    )
    token_type: Literal["bearer"] = Field(
        ...,
        description="Type de token OAuth2",
        examples=["bearer"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user": {"id": 1, "username": "neo42", "email": "neo42@example.com"},
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    )
