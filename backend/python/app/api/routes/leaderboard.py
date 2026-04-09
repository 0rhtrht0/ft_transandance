from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.core.exceptions import UserNotFound
from app.dependencies import get_db
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.game import (
    EvaluationPointsSubmitRequest,
    LeaderboardEntryResponse,
    UserEvaluationPointsResponse,
)
from app.services.wallet_service import apply_manual_wallet_adjustment, get_or_create_wallet

router = APIRouter(tags=["leaderboard"])


@router.get(
    "/leaderboard",
    response_model=list[LeaderboardEntryResponse],
    summary="Recuperer le leaderboard",
    description="Retourne le classement global des wallets trie par points d'evaluation.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_leaderboard(
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
            description="Nombre maximal de joueurs retournes par page",
            examples=[100],
        ),
    ] = 100,
    offset: Annotated[
        int,
        Query(
            ge=0,
            description="Nombre de lignes a ignorer (pagination)",
            examples=[0],
        ),
    ] = 0,
    db: Session = Depends(get_db)
):
    query = (
        db.query(
            User.username.label("username"),
            Wallet.total_evaluation_points.label("evaluation_points"),
        )
        .outerjoin(Wallet, Wallet.user_id == User.id)
        .order_by(
            func.coalesce(Wallet.total_evaluation_points, 0).desc(),
            User.username.asc(),
        )
    )
    rows = query.offset(offset).limit(limit).all()
    return [
        LeaderboardEntryResponse(
            username=row.username,
            evaluation_points=int(row.evaluation_points or 0),
        )
        for row in rows
    ]


@router.get(
    "/leaderboard/{user_id}",
    response_model=UserEvaluationPointsResponse,
    summary="Recuperer les points d'evaluation d'un utilisateur",
    description="Retourne le solde actuel du wallet d'un joueur.",
    responses=standard_error_responses(
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_user_evaluation_points(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UserNotFound()

    wallet = get_or_create_wallet(db, user_id)
    db.commit()
    db.refresh(wallet)
    return UserEvaluationPointsResponse(
        user_id=user_id,
        evaluation_points=int(wallet.total_evaluation_points or 0),
    )


@router.post(
    "/evaluation-points/submit",
    response_model=UserEvaluationPointsResponse,
    summary="Ajuster manuellement un wallet",
    description="Applique un ajustement manuel aux points d'evaluation d'un joueur.",
    responses=standard_error_responses(
        status.HTTP_404_NOT_FOUND,
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def submit_evaluation_points(
    payload: EvaluationPointsSubmitRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        raise UserNotFound()

    wallet, _, _ = apply_manual_wallet_adjustment(
        db=db,
        user_id=user.id,
        delta=payload.evaluation_points,
        description="Manual evaluation points submission",
        context={"source": "leaderboard.submit"},
    )
    db.commit()
    db.refresh(wallet)
    return UserEvaluationPointsResponse(
        user_id=user.id,
        evaluation_points=int(wallet.total_evaluation_points or 0),
    )
