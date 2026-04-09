from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.dependencies import get_current_user, get_db
from app.models.game_result import GameResult
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_transaction import WalletTransaction
from app.schemas.game import GameResultResponse, GameResultSubmitRequest
from app.services.activity_notification_service import notify_game_result_recorded
from app.services.wallet_service import apply_game_result_to_wallet, compute_evaluation_points_delta

router = APIRouter(tags=["game-results"])


@router.post(
    "/results",
    response_model=GameResultResponse,
    summary="Enregistrer un resultat de partie",
    description="Sauvegarde un resultat de partie pour l'utilisateur connecte.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def submit_result(
    payload: GameResultSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    previous_achievements = set(existing_wallet.unlocked_achievements or []) if existing_wallet else set()
    computed_evaluation_points = compute_evaluation_points_delta(
        result=payload.result,
        is_multiplayer=bool(payload.is_multiplayer),
    )
    result = GameResult(
        user_id=current_user.id,
        evaluation_points=computed_evaluation_points,
        result=payload.result,
        is_multiplayer=payload.is_multiplayer,
        pace_value=payload.pace_value,
        pace_label=payload.pace_label
        or (str(payload.pace_value) if payload.pace_value is not None else None),
        time_ms=payload.time_ms,
        level=payload.level,
        difficulty=payload.difficulty,
        stage=payload.stage if payload.stage is not None else payload.level,
    )
    db.add(result)
    db.flush()

    wallet, transaction, unlocked_achievements = apply_game_result_to_wallet(
        db=db,
        user_id=current_user.id,
        game_result=result,
    )

    db.commit()
    db.refresh(result)
    db.refresh(wallet)
    db.refresh(transaction)
    new_achievements = [
        code for code in unlocked_achievements
        if code not in previous_achievements
    ]
    await notify_game_result_recorded(
        db=db,
        user_id=current_user.id,
        result=result.result,
        is_multiplayer=bool(result.is_multiplayer),
        stage=result.stage if result.stage is not None else result.level,
        difficulty=result.difficulty,
        evaluation_points=result.evaluation_points,
        wallet_balance=int(wallet.total_evaluation_points or 0),
        unlocked_achievements=new_achievements,
    )
    return GameResultResponse(
        id=result.id,
        evaluation_points=result.evaluation_points,
        result=result.result,
        is_multiplayer=bool(result.is_multiplayer),
        pace_value=result.pace_value,
        pace_label=result.pace_label,
        time_ms=result.time_ms,
        level=result.level,
        difficulty=result.difficulty,
        stage=result.stage if result.stage is not None else result.level,
        wallet_balance=int(wallet.total_evaluation_points or 0),
        wallet_transaction_id=transaction.id,
        unlocked_achievements=unlocked_achievements,
        created_at=result.created_at,
    )


@router.get(
    "/results",
    response_model=list[GameResultResponse],
    summary="Recuperer mon historique de parties",
    description="Retourne l'historique detaille des parties du joueur connecte.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_my_results(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(GameResult)
        .filter(GameResult.user_id == current_user.id)
        .order_by(GameResult.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        GameResultResponse(
            id=row.id,
            evaluation_points=row.evaluation_points,
            result=row.result,
            is_multiplayer=bool(row.is_multiplayer),
            pace_value=row.pace_value,
            pace_label=row.pace_label,
            time_ms=row.time_ms,
            level=row.level,
            difficulty=row.difficulty,
            stage=row.stage if row.stage is not None else row.level,
            wallet_balance=(
                db.query(WalletTransaction.balance_after)
                .filter(WalletTransaction.game_result_id == row.id)
                .order_by(WalletTransaction.id.desc())
                .scalar()
            ),
            wallet_transaction_id=(
                db.query(WalletTransaction.id)
                .filter(WalletTransaction.game_result_id == row.id)
                .order_by(WalletTransaction.id.desc())
                .scalar()
            ),
            unlocked_achievements=[],
            created_at=row.created_at,
        )
        for row in rows
    ]
