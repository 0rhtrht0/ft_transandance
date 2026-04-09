from pydantic import BaseModel, ConfigDict, Field


class FriendRequestCreate(BaseModel):
    user_id: int = Field(
        ...,
        description="Identifiant de l'utilisateur a ajouter",
        examples=[12],
    )

    model_config = ConfigDict(json_schema_extra={"example": {"user_id": 12}})


class FriendshipResponse(BaseModel):
    id: int = Field(..., description="Identifiant de la relation", examples=[42])
    requester_id: int = Field(..., description="Utilisateur qui a envoye la demande")
    addressee_id: int = Field(..., description="Utilisateur cible de la demande")
    status: str = Field(..., description="Etat de la relation", examples=["pending"])

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 42,
                "requester_id": 1,
                "addressee_id": 12,
                "status": "pending",
            }
        },
    )
