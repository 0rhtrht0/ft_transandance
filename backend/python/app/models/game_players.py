from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base

class GamePlayers(Base):
    __tablename__ = "game_players"

    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey("game_history.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    game = relationship("GameHistory", back_populates="players")
    user = relationship("User", backref="games_played")
