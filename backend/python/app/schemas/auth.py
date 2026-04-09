from pydantic import BaseModel, EmailStr, Field


class GoogleAuthRequest(BaseModel):
    credential: str = Field(
        ...,
        description="ID token Google (JWT) renvoye par Google Identity Services",
        examples=["eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."],
    )


class GoogleClientConfigResponse(BaseModel):
    enabled: bool = Field(
        ...,
        description="Indique si la connexion Google est active cote serveur",
        examples=[True],
    )
    client_id: str = Field(
        ...,
        description="Client ID OAuth Google public a utiliser cote frontend",
        examples=["1234567890-abc123def.apps.googleusercontent.com"],
    )


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(
        ...,
        description="Email du compte a recuperer",
        examples=["player@example.com"],
    )


class ForgotPasswordResponse(BaseModel):
    detail: str = Field(
        ...,
        description="Message de confirmation generique",
        examples=["If an account exists, a reset token has been generated."],
    )
    reset_token: str | None = Field(
        default=None,
        description="Token de reset renvoye uniquement en mode developpement",
        examples=["k6M2xR..."],
    )


class ResetPasswordRequest(BaseModel):
    token: str = Field(
        ...,
        min_length=16,
        description="Token de reinitialisation du mot de passe",
    )
    new_password: str = Field(
        ...,
        min_length=8,
        description="Nouveau mot de passe",
        examples=["NewPassword123!"],
    )
