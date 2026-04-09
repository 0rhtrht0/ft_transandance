from pydantic import BaseModel, ConfigDict, Field


class ProfileResponse(BaseModel):
    id: int = Field(..., description="Identifiant du profil", examples=[1])
    user_id: int = Field(..., description="Identifiant utilisateur lie", examples=[7])
    bio: str | None = Field(
        default=None,
        description="Biographie de l'utilisateur",
        examples=["Joueur Pong competitif"],
    )
    avatar: str | None = Field(
        default=None,
        description="Chemin ou URL de l'avatar",
        examples=["uploaded_avatars/user_7_avatar.png"],
    )
    is_online: bool = Field(
        ...,
        description="Etat de connexion actuel",
        examples=[True],
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "user_id": 7,
                "bio": "Joueur Pong competitif",
                "avatar": "uploaded_avatars/user_7_avatar.png",
                "is_online": True,
            }
        },
    )


class ProfileProgressionEntry(BaseModel):
    difficulty: str = Field(..., description="Difficulty identifier", examples=["moyen"])
    current_stage: int = Field(..., description="Highest unlocked stage", examples=[4])


class ProfileStatsResponse(BaseModel):
    evaluation_points: int = Field(
        ...,
        description="Total current wallet balance",
        examples=[7],
    )
    wallet_transactions: int = Field(
        ...,
        description="Number of wallet transactions recorded",
        examples=[12],
    )
    wins: int = Field(..., description="Number of victories", examples=[8])
    losses: int = Field(..., description="Number of defeats", examples=[3])
    friends_count: int = Field(..., description="Number of accepted friends", examples=[5])
    unlocked_achievements: list[str] = Field(
        default_factory=list,
        description="Achievement codes unlocked by the wallet",
        examples=[["first_escape", "steady_orbit"]],
    )


class ProfileDetailResponse(ProfileResponse):
    username: str = Field(..., description="Public username", examples=["neo42"])
    is_me: bool = Field(..., description="Whether this profile belongs to the viewer", examples=[False])
    stats: ProfileStatsResponse
    progression: list[ProfileProgressionEntry] = Field(
        default_factory=list,
        description="Unlocked progression for each difficulty",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 1,
                "user_id": 7,
                "username": "neo42",
                "bio": "Maze runner looking for rematches.",
                "avatar": "uploaded_avatars/user_7_avatar.png",
                "is_online": True,
                "is_me": False,
                "stats": {
                    "evaluation_points": 7,
                    "wallet_transactions": 12,
                    "wins": 8,
                    "losses": 3,
                    "friends_count": 5,
                    "unlocked_achievements": ["first_escape", "steady_orbit"],
                },
                "progression": [
                    {"difficulty": "facile", "current_stage": 4},
                    {"difficulty": "moyen", "current_stage": 3},
                    {"difficulty": "difficile", "current_stage": 2},
                ],
            }
        }
    )


class PublicProfileCreate(BaseModel):
    user_id: int = Field(..., description="Target user id", examples=[7])
    bio: str | None = Field(
        default=None,
        max_length=500,
        description="Public biography",
        examples=["Maze runner looking for ranked matches."],
    )
    avatar: str | None = Field(
        default=None,
        description="Avatar URL or uploaded path",
        examples=["uploaded_avatars/user_7_avatar.png"],
    )
    is_online: bool = Field(
        default=False,
        description="Whether the profile should be flagged online",
        examples=[False],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": 7,
                "bio": "Maze runner looking for ranked matches.",
                "avatar": "uploaded_avatars/user_7_avatar.png",
                "is_online": False,
            }
        }
    )


class PublicProfileReplace(BaseModel):
    bio: str | None = Field(
        default=None,
        max_length=500,
        description="Public biography",
        examples=["Available for daily ranked matches."],
    )
    avatar: str | None = Field(
        default=None,
        description="Avatar URL or uploaded path",
        examples=["uploaded_avatars/user_7_avatar.png"],
    )
    is_online: bool = Field(
        default=False,
        description="Whether the profile should be flagged online",
        examples=[True],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "bio": "Available for daily ranked matches.",
                "avatar": "uploaded_avatars/user_7_avatar.png",
                "is_online": True,
            }
        }
    )


class ProfileUpdate(BaseModel):
    bio: str | None = Field(
        default=None,
        max_length=500,
        description="Nouvelle biographie",
        examples=["Joueur orienté tournoi 1v1"],
    )
    avatar: str | None = Field(
        default=None,
        description="URL ou chemin de l'avatar",
        examples=["https://example.com/avatars/neo.png"],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"bio": "Joueur orienté tournoi 1v1"}}
    )


class AvatarUploadResponse(BaseModel):
    avatar: str = Field(
        ...,
        description="Chemin de l'avatar sauvegarde",
        examples=["uploaded_avatars/user_7_avatar.png"],
    )
    detail: str = Field(
        ...,
        description="Message de confirmation",
        examples=["Avatar uploaded"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "avatar": "uploaded_avatars/user_7_avatar.png",
                "detail": "Avatar uploaded",
            }
        }
    )
