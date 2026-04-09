from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    total_evaluation_points = Column(Integer, default=0, nullable=False)
    unlocked_achievements = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="wallet")
    transactions = relationship(
        "WalletTransaction",
        back_populates="wallet",
        cascade="all, delete-orphan",
    )
