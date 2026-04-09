from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GameResult(Base):
    __tablename__ = "game_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    evaluation_points = Column(Integer, default=0, nullable=False)
    result = Column(String, nullable=False)  # victory | defeat
    is_multiplayer = Column(Boolean, default=False, nullable=False)
    pace_value = Column(Integer, nullable=True)
    pace_label = Column(String, nullable=True)
    time_ms = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)
    difficulty = Column(String(length=20), nullable=True)
    stage = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="game_results")
    wallet_transactions = relationship("WalletTransaction", back_populates="game_result")
