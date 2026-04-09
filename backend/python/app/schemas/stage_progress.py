from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class StageProgressResponse(BaseModel):
    """Réponse API pour la progression d'un utilisateur"""
    id: int
    user_id: int
    difficulty: str  # "facile", "moyen", "difficile"
    current_stage: int = Field(..., ge=1, le=100, description="Épreuve débloquée (1-100)")
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CompleteStageRequest(BaseModel):
    """Requête pour compléter une épreuve"""
    difficulty: str = Field(..., description="facile, moyen, or difficile")
    stage: int = Field(..., ge=1, le=100, description="Épreuve à compléter (1-100)")
    evaluation_points: int = Field(default=0, description="Points d'evaluation obtenus")
    time_ms: int = Field(default=0, ge=0, description="Temps en millisecondes")


class StartStageRequest(BaseModel):
    """Requête pour démarrer une épreuve"""
    difficulty: str = Field(..., description="facile, moyen, or difficile")
    stage: int = Field(..., ge=1, le=100, description="Épreuve à jouer (1-100)")


class StageProgressListResponse(BaseModel):
    """Réponse API avec les 3 progressions"""
    facile: StageProgressResponse
    moyen: StageProgressResponse
    difficile: StageProgressResponse


class PaceConfigEntry(BaseModel):
    label: str
    pace: int = Field(..., ge=1)
    from_seconds: int = Field(..., ge=0)
    vision_cm: float = Field(..., gt=0)
    hole_cm: float = Field(..., gt=0)


class StageTuningResponse(BaseModel):
    difficulty: str
    stage: int = Field(..., ge=1, le=100)
    max_stage: int = Field(..., ge=1)
    tile_size: int = Field(..., ge=1)
    time_limit_seconds: int = Field(..., ge=1)
    bonus_trigger_pace: int = Field(..., ge=1)
    pace_table: list[PaceConfigEntry]
