from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.security import get_current_user
from app.dependencies import get_db
from app.models.user import User
from app.schemas.stage_progress import StageProgressResponse, StageTuningResponse
from app.services.difficulty_tuning import build_stage_tuning

from .progression_helpers import (
    VALID_DIFFICULTIES,
    get_or_create_progress,
    validate_difficulty,
    validate_stage,
)

router = APIRouter()


@router.get(
    "/me",
    response_model=dict[str, StageProgressResponse],
    summary="Récupérer ma progression complète",
    description="Retourne la progression pour les 3 difficultés (facile, moyen, difficile)",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_my_progression(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    progressions = {}

    for difficulty in VALID_DIFFICULTIES:
        progress = get_or_create_progress(db, current_user.id, difficulty)
        progressions[difficulty] = StageProgressResponse.model_validate(progress)

    return progressions


@router.get(
    "/{difficulty}",
    response_model=StageProgressResponse,
    summary="Récupérer la progression d'une difficulté",
    description="Retourne la progression pour une seule difficulté",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_progression_by_difficulty(
    difficulty: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    difficulty = validate_difficulty(difficulty)
    progress = get_or_create_progress(db, current_user.id, difficulty)
    return progress


@router.get(
    "/config/stage",
    response_model=StageTuningResponse,
    summary="Récupérer la configuration de difficulté d'une épreuve",
    description=(
        "Retourne les paramètres gameplay calculés pour une difficulté et une épreuve "
        "(taille de tuile, limite de temps, table de pace, etc.)."
    ),
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_stage_tuning(
    difficulty: str,
    stage: int,
    current_user: User = Depends(get_current_user),
):
    del current_user
    normalized_difficulty = validate_difficulty(difficulty)
    normalized_stage = validate_stage(stage)
    return build_stage_tuning(normalized_difficulty, normalized_stage)
