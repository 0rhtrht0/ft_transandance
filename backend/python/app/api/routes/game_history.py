from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session, selectinload

from app.core.errors import standard_error_responses
from app.core.exceptions import GameNotFound
from app.dependencies import get_current_user, get_db
from app.models.game_history import GameHistory
from app.models.game_players import GamePlayers
from app.models.user import User
from app.schemas.game import GameHistoryResponse

router = APIRouter(tags=["game-history"])


def _serialize_game(game: GameHistory) -> GameHistoryResponse:
    return GameHistoryResponse(
        game_id=game.id,
        winner=game.winner.username if game.winner else None,
        duration=game.duration,
        created_at=game.created_at,
        players=[gp.user.username for gp in game.players if gp.user],
    )


@router.get(
    "/games/history",
    response_model=list[GameHistoryResponse],
    summary="Recuperer mon historique de parties",
    description="Liste les parties jouees par l'utilisateur authentifie.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_my_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    games = (
        db.query(GameHistory)
        .join(GamePlayers, GamePlayers.game_id == GameHistory.id)
        .filter(GamePlayers.user_id == current_user.id)
        .options(
            selectinload(GameHistory.players).selectinload(GamePlayers.user),
            selectinload(GameHistory.winner),
        )
        .all()
    )
    return [_serialize_game(game) for game in games]


@router.get(
    "/games/history/{game_id}",
    response_model=GameHistoryResponse,
    summary="Recuperer le detail d'une partie",
    description="Retourne les details d'une partie via son identifiant.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_game_detail(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    game = (
        db.query(GameHistory)
        .filter(GameHistory.id == game_id)
        .options(
            selectinload(GameHistory.players).selectinload(GamePlayers.user),
            selectinload(GameHistory.winner),
        )
        .first()
    )
    if not game:
        raise GameNotFound()

    is_player_in_game = any(player.user_id == current_user.id for player in game.players)
    if not is_player_in_game:
        raise GameNotFound()

    return _serialize_game(game)
