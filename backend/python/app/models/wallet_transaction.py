from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    game_result_id = Column(Integer, ForeignKey("game_results.id"), nullable=True, index=True)
    evaluation_points_delta = Column(Integer, nullable=False, default=0)
    balance_before = Column(Integer, nullable=False, default=0)
    balance_after = Column(Integer, nullable=False, default=0)
    transaction_type = Column(String(length=50), nullable=False)
    description = Column(String(length=255), nullable=True)
    context = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    wallet = relationship("Wallet", back_populates="transactions")
    user = relationship("User", back_populates="wallet_transactions")
    game_result = relationship("GameResult", back_populates="wallet_transactions")
