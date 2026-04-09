from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.game_result import GameResult
from app.models.wallet import Wallet
from app.models.wallet_transaction import WalletTransaction


ACHIEVEMENT_RULES = (
    ("first_escape", "First Escape", lambda balance, wins, multiplayer_wins: balance >= 1),
    ("steady_orbit", "Steady Orbit", lambda balance, wins, multiplayer_wins: balance >= 5),
    (
        "event_horizon_master",
        "Event Horizon Master",
        lambda balance, wins, multiplayer_wins: balance >= 10,
    ),
    (
        "multiplayer_contender",
        "Multiplayer Contender",
        lambda balance, wins, multiplayer_wins: multiplayer_wins >= 3,
    ),
    ("void_wanderer", "Void Wanderer", lambda balance, wins, multiplayer_wins: wins >= 5),
    ("stellar_collector", "Stellar Collector", lambda balance, wins, multiplayer_wins: balance >= 25),
    ("galactic_champion", "Galactic Champion", lambda balance, wins, multiplayer_wins: multiplayer_wins >= 10),
    ("blackhole_survivor", "Blackhole Survivor", lambda balance, wins, multiplayer_wins: wins >= 20),
    ("cosmic_legend", "Cosmic Legend", lambda balance, wins, multiplayer_wins: balance >= 50),
)


def get_or_create_wallet(db: Session, user_id: int) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if wallet is None:
        wallet = Wallet(user_id=user_id, total_evaluation_points=0, unlocked_achievements=[])
        db.add(wallet)
        db.flush()
    if not isinstance(wallet.unlocked_achievements, list):
        wallet.unlocked_achievements = []
    return wallet


def compute_evaluation_points_delta(result: str, is_multiplayer: bool) -> int:
    normalized_result = (result or "").strip().lower()
    if normalized_result == "victory":
        return 1
    if normalized_result == "defeat" and is_multiplayer:
        return -1
    return 0


def _count_total_wins(db: Session, user_id: int) -> int:
    return (
        db.query(GameResult)
        .filter(GameResult.user_id == user_id, GameResult.result == "victory")
        .count()
    )


def _count_multiplayer_wins(db: Session, user_id: int) -> int:
    return (
        db.query(GameResult)
        .filter(
            GameResult.user_id == user_id,
            GameResult.result == "victory",
            GameResult.is_multiplayer.is_(True),
        )
        .count()
    )


def trigger_achievement_check(db: Session, wallet: Wallet) -> list[str]:
    total_wins = _count_total_wins(db, wallet.user_id)
    multiplayer_wins = _count_multiplayer_wins(db, wallet.user_id)

    unlocked = []
    for achievement_code, _, predicate in ACHIEVEMENT_RULES:
        if predicate(wallet.total_evaluation_points, total_wins, multiplayer_wins):
            unlocked.append(achievement_code)

    wallet.unlocked_achievements = unlocked
    return unlocked


def build_achievement_catalog() -> list[dict[str, str]]:
    return [
        {"code": code, "label": label}
        for code, label, _ in ACHIEVEMENT_RULES
    ]


def apply_game_result_to_wallet(
    db: Session,
    user_id: int,
    game_result: GameResult,
) -> tuple[Wallet, WalletTransaction, list[str]]:
    wallet = get_or_create_wallet(db, user_id)
    balance_before = int(wallet.total_evaluation_points or 0)
    delta = compute_evaluation_points_delta(
        result=game_result.result,
        is_multiplayer=bool(game_result.is_multiplayer),
    )
    balance_after = balance_before + delta

    wallet.total_evaluation_points = balance_after

    transaction_type = "multiplayer_result" if game_result.is_multiplayer else "solo_escape"
    if delta == 0:
        transaction_type = "solo_attempt"

    transaction = WalletTransaction(
        wallet_id=wallet.id,
        user_id=user_id,
        game_result_id=game_result.id,
        evaluation_points_delta=delta,
        balance_before=balance_before,
        balance_after=balance_after,
        transaction_type=transaction_type,
        description=_build_transaction_description(delta, bool(game_result.is_multiplayer)),
        context=_build_transaction_context(game_result, delta),
    )
    db.add(transaction)

    unlocked_achievements = trigger_achievement_check(db, wallet)
    db.flush()
    return wallet, transaction, unlocked_achievements


def apply_manual_wallet_adjustment(
    db: Session,
    user_id: int,
    delta: int,
    description: str | None = None,
    context: dict[str, Any] | None = None,
) -> tuple[Wallet, WalletTransaction, list[str]]:
    wallet = get_or_create_wallet(db, user_id)
    balance_before = int(wallet.total_evaluation_points or 0)
    balance_after = balance_before + int(delta)
    wallet.total_evaluation_points = balance_after

    transaction = WalletTransaction(
        wallet_id=wallet.id,
        user_id=user_id,
        game_result_id=None,
        evaluation_points_delta=int(delta),
        balance_before=balance_before,
        balance_after=balance_after,
        transaction_type="manual_adjustment",
        description=description or "Manual wallet adjustment",
        context=context or {},
    )
    db.add(transaction)

    unlocked_achievements = trigger_achievement_check(db, wallet)
    db.flush()
    return wallet, transaction, unlocked_achievements


def _build_transaction_description(delta: int, is_multiplayer: bool) -> str:
    if is_multiplayer and delta > 0:
        return "Multiplayer victory"
    if is_multiplayer and delta < 0:
        return "Multiplayer defeat"
    if delta > 0:
        return "Solo escape"
    return "Solo attempt"


def _build_transaction_context(game_result: GameResult, delta: int) -> dict[str, Any]:
    return {
        "difficulty": game_result.difficulty,
        "stage": game_result.stage if game_result.stage is not None else game_result.level,
        "result": game_result.result,
        "is_multiplayer": bool(game_result.is_multiplayer),
        "evaluation_points": int(delta),
        "time_ms": int(game_result.time_ms or 0),
    }
