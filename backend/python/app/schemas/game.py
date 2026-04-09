from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LeaderboardEntryResponse(BaseModel):
    username: str = Field(..., description="Pseudo du joueur", examples=["neo42"])
    evaluation_points: int = Field(
        ...,
        description="Total cumule de points d'evaluation",
        examples=[12],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"username": "neo42", "evaluation_points": 12}}
    )


class UserEvaluationPointsResponse(BaseModel):
    user_id: int = Field(..., description="Identifiant utilisateur", examples=[7])
    evaluation_points: int = Field(
        ...,
        description="Total actuel de points d'evaluation",
        examples=[5],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"user_id": 7, "evaluation_points": 5}}
    )


class EvaluationPointsSubmitRequest(BaseModel):
    username: str = Field(..., description="Pseudo du joueur", examples=["neo42"])
    evaluation_points: int = Field(
        ...,
        description="Ajustement manuel des points d'evaluation",
        examples=[1],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"username": "neo42", "evaluation_points": 1}}
    )


class GameHistoryResponse(BaseModel):
    game_id: int = Field(..., description="Identifiant de partie", examples=[42])
    winner: str | None = Field(
        default=None,
        description="Pseudo du gagnant",
        examples=["neo42"],
    )
    duration: int = Field(..., description="Duree de la partie en secondes", examples=[360])
    created_at: datetime = Field(..., description="Date de creation de la partie")
    players: list[str] = Field(
        default_factory=list,
        description="Liste des pseudos des participants",
        examples=[["neo42", "trinity"]],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "game_id": 42,
                "winner": "neo42",
                "duration": 360,
                "created_at": "2026-03-07T13:30:00Z",
                "players": ["neo42", "trinity"],
            }
        }
    )


class GameResultSubmitRequest(BaseModel):
    evaluation_points: int | None = Field(
        default=None,
        ge=-1,
        le=1,
        description="Apercu client des points d'evaluation (recalcules par le backend)",
        examples=[1],
    )
    result: Literal["victory", "defeat"] = Field(
        ..., description="Issue de la partie", examples=["victory"]
    )
    is_multiplayer: bool = Field(
        default=False,
        description="Indique si la partie a ete jouee en multijoueur",
        examples=[False],
    )
    pace_value: int | None = Field(
        default=None, description="Pace atteint au moment de fin", examples=[18]
    )
    pace_label: str | None = Field(
        default=None, description="Libelle du pace", examples=["18"]
    )
    time_ms: int = Field(
        ...,
        ge=0,
        description="Temps ecoule en millisecondes",
        examples=[42000],
    )
    level: int = Field(
        default=1, ge=1, description="Niveau atteint", examples=[2]
    )
    difficulty: Literal["facile", "moyen", "difficile"] | None = Field(
        default=None,
        description="Difficulte de la partie",
        examples=["moyen"],
    )
    stage: int | None = Field(
        default=None,
        ge=1,
        description="Stage de la partie (fallback sur level si absent)",
        examples=[2],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "evaluation_points": 1,
                "result": "victory",
                "is_multiplayer": False,
                "pace_value": 18,
                "pace_label": "18",
                "time_ms": 42000,
                "level": 2,
                "difficulty": "moyen",
                "stage": 2,
            }
        }
    )


class GameResultResponse(BaseModel):
    id: int = Field(..., description="Identifiant resultat", examples=[101])
    evaluation_points: int = Field(
        ...,
        description="Variation de points d'evaluation pour cette partie",
        examples=[1],
    )
    result: str = Field(..., description="Issue", examples=["victory"])
    is_multiplayer: bool = Field(..., description="Partie multijoueur ou non", examples=[False])
    pace_value: int | None = Field(default=None, description="Pace atteint")
    pace_label: str | None = Field(default=None, description="Libelle du pace")
    time_ms: int = Field(..., description="Temps ecoule en millisecondes")
    level: int = Field(..., description="Niveau atteint")
    difficulty: str | None = Field(default=None, description="Difficulte de la partie")
    stage: int | None = Field(default=None, description="Stage atteint")
    wallet_balance: int | None = Field(
        default=None,
        description="Solde du wallet apres traitement du resultat",
    )
    wallet_transaction_id: int | None = Field(
        default=None,
        description="Transaction creee pour ce resultat",
    )
    unlocked_achievements: list[str] = Field(
        default_factory=list,
        description="Succes actuellement debloques dans le wallet",
    )
    created_at: datetime = Field(..., description="Date de creation")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 101,
                "evaluation_points": 1,
                "result": "victory",
                "is_multiplayer": False,
                "pace_value": 18,
                "pace_label": "18",
                "time_ms": 42000,
                "level": 2,
                "difficulty": "moyen",
                "stage": 2,
                "wallet_balance": 5,
                "wallet_transaction_id": 88,
                "unlocked_achievements": ["first_escape"],
                "created_at": "2026-03-07T13:30:00Z",
            }
        }
    )


class MatchmakingJoinResponse(BaseModel):
    status: str | None = Field(
        default=None,
        description="Etat de la demande de matchmaking",
        examples=["waiting for another player"],
    )
    match: list[int] | None = Field(
        default=None,
        description="Pairing des joueurs lorsqu'un match est trouve",
        examples=[[12, 34]],
    )
    seed: str | None = Field(
        default=None,
        description="Seed de la partie lorsqu'un match est trouve",
        examples=["AB12CD34"],
    )
    difficulty: str | None = Field(
        default=None,
        description="Difficulte du matchmaking",
        examples=["moyen"],
    )
    stage: int | None = Field(
        default=None,
        description="Stage de la partie",
        examples=[1],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"status": "waiting for another player"}}
    )


class MatchmakingLeaveResponse(BaseModel):
    status: str = Field(
        ...,
        description="Resultat de la sortie de file",
        examples=["removed from queue"],
    )

    model_config = ConfigDict(
        json_schema_extra={"example": {"status": "removed from queue"}}
    )
