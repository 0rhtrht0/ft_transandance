from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ErrorResponse(BaseModel):
    detail: str = Field(
        ...,
        description="Message d'erreur normalise",
        examples=["Profile not found"],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"detail": "Profile not found"}}
    )


class MessageResponse(BaseModel):
    detail: str = Field(
        ...,
        description="Message de confirmation",
        examples=["Operation completed"],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"detail": "Operation completed"}}
    )


class RootResponse(BaseModel):
    message: str = Field(
        ...,
        description="Message de disponibilite du backend",
        examples=["Blackhole backend is running!"],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"message": "Blackhole backend is running!"}}
    )


class TokenResponse(BaseModel):
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
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    )
