from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

class GameHistory(Base):
    __tablename__ = "game_history"

    id = Column(Integer, primary_key=True, index=True)
    winner_id = Column(Integer, ForeignKey("users.id"))
    duration = Column(Integer)  # durée en secondes
    seed = Column(String, nullable=True)
    difficulty = Column(String, nullable=True)
    stage = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    winner = relationship("User", backref="won_games")
    players = relationship(
        "GamePlayers", back_populates="game", cascade="all, delete-orphan"
    )
