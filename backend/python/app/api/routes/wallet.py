from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.errors import standard_error_responses
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.wallet_transaction import WalletTransaction
from app.schemas.wallet import WalletResponse, WalletTransactionResponse
from app.services.wallet_service import get_or_create_wallet

router = APIRouter(tags=["wallet"])


@router.get(
    "/wallet",
    response_model=WalletResponse,
    summary="Recuperer mon wallet",
    description="Retourne le solde courant des points d'evaluation et les succes debloques.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_my_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = get_or_create_wallet(db, current_user.id)
    db.commit()
    db.refresh(wallet)
    transactions_count = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == current_user.id)
        .count()
    )
    return WalletResponse(
        user_id=current_user.id,
        total_evaluation_points=int(wallet.total_evaluation_points or 0),
        unlocked_achievements=list(wallet.unlocked_achievements or []),
        transactions_count=int(transactions_count or 0),
        created_at=wallet.created_at,
        updated_at=wallet.updated_at,
    )


@router.get(
    "/wallet/transactions",
    response_model=list[WalletTransactionResponse],
    summary="Recuperer l'historique du wallet",
    description="Retourne les transactions du wallet de l'utilisateur connecte.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_my_wallet_transactions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == current_user.id)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        WalletTransactionResponse(
            id=row.id,
            evaluation_points_delta=row.evaluation_points_delta,
            balance_before=row.balance_before,
            balance_after=row.balance_after,
            transaction_type=row.transaction_type,
            description=row.description,
            context=row.context or {},
            created_at=row.created_at,
        )
        for row in rows
    ]
