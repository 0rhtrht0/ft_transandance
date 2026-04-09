from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.security import get_current_user
from app.dependencies import get_db
from app.models.user import User
from app.schemas.stage_progress import CompleteStageRequest, StageProgressResponse
from app.services.difficulty_tuning import build_stage_tuning

from .progression_helpers import (
    MAX_STAGES,
    VALID_DIFFICULTIES,
    can_play_stage,
    get_or_create_progress,
    validate_difficulty,
    validate_stage,
)

router = APIRouter()


@router.post(
    "/start_stage",
    response_model=dict,
    summary="Démarrer une épreuve",
    description="Vérifie que l'épreuve est débloquée et démarre le jeu",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def start_stage(
    difficulty: str,
    stage: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    difficulty = validate_difficulty(difficulty)
    stage = validate_stage(stage)

    if not can_play_stage(db, current_user.id, difficulty, stage):
        progress = get_or_create_progress(db, current_user.id, difficulty)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Épreuve {stage} est verrouillée. Tu peux jouer jusqu'à l'épreuve {progress.current_stage}",
        )

    tuning = build_stage_tuning(difficulty, stage)
    return {
        "status": "ok",
        "difficulty": difficulty,
        "stage": stage,
        "message": f"Épreuve {stage} ({difficulty}) prête à démarrer",
        "config": tuning,
    }


@router.post(
    "/complete",
    response_model=StageProgressResponse,
    summary="Compléter une épreuve",
    description="Valide une épreuve et débloque la suivante",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def complete_stage(
    data: CompleteStageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    difficulty = validate_difficulty(data.difficulty)
    stage = validate_stage(data.stage)

    progress = get_or_create_progress(db, current_user.id, difficulty)

    if stage != progress.current_stage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tu dois d'abord compléter l'épreuve {progress.current_stage}",
        )

    if progress.current_stage < MAX_STAGES:
        progress.current_stage += 1

    db.commit()
    db.refresh(progress)

    return progress


@router.post(
    "/reset",
    response_model=dict[str, StageProgressResponse],
    summary="Réinitialiser toute ma progression",
    description="⚠️ Réinitialise les 3 difficultés à l'épreuve 1",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def reset_progression(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    progressions = {}

    for difficulty in VALID_DIFFICULTIES:
        progress = get_or_create_progress(db, current_user.id, difficulty)
        progress.current_stage = 1
        progressions[difficulty] = StageProgressResponse.model_validate(progress)

    db.commit()
    return progressions
