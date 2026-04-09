from __future__ import annotations

from sqlalchemy.orm import Session

from app.api.routes.progression_helpers import MAX_STAGES
from app.models.stage_progress import StageProgress


def _get_or_create_progress(db: Session, user_id: int, difficulty: str) -> StageProgress:
    progress = (
        db.query(StageProgress)
        .filter(
            StageProgress.user_id == user_id,
            StageProgress.difficulty == difficulty,
        )
        .first()
    )

    if progress is None:
        progress = StageProgress(user_id=user_id, difficulty=difficulty, current_stage=1)
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress


def get_player_stage(db: Session, user_id: int, difficulty: str) -> int:
    progress = _get_or_create_progress(db, user_id, difficulty)
    return progress.current_stage


def can_play_stage(db: Session, user_id: int, difficulty: str, stage: int) -> bool:
    current_stage = get_player_stage(db, user_id, difficulty)
    return stage <= current_stage


def complete_stage(db: Session, user_id: int, difficulty: str, stage: int) -> StageProgress:
    progress = _get_or_create_progress(db, user_id, difficulty)
    if stage == progress.current_stage and progress.current_stage < MAX_STAGES:
        progress.current_stage += 1
        db.commit()
        db.refresh(progress)
    return progress
