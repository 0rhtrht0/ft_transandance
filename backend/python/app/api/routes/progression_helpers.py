from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.stage_progress import StageProgress

VALID_DIFFICULTIES = ["facile", "moyen", "difficile"]
MAX_STAGES = 100


def validate_difficulty(difficulty: str) -> str:
    if difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Difficulté invalide. Doit être: {', '.join(VALID_DIFFICULTIES)}",
        )
    return difficulty


def validate_stage(stage: int) -> int:
    if not (1 <= stage <= MAX_STAGES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Épreuve doit être entre 1 et {MAX_STAGES}",
        )
    return stage


def get_or_create_progress(db: Session, user_id: int, difficulty: str) -> StageProgress:
    progress = db.query(StageProgress).filter(
        and_(
            StageProgress.user_id == user_id,
            StageProgress.difficulty == difficulty,
        )
    ).first()

    if not progress:
        progress = StageProgress(
            user_id=user_id,
            difficulty=difficulty,
            current_stage=1,
        )
        db.add(progress)
        db.commit()
        db.refresh(progress)

    return progress


def can_play_stage(db: Session, user_id: int, difficulty: str, stage: int) -> bool:
    progress = get_or_create_progress(db, user_id, difficulty)
    return stage <= progress.current_stage

