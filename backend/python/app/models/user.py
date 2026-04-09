from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Integer, default=0)
    password_reset_token_hash = Column(String, nullable=True, index=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    profile = relationship("Profile", back_populates="user", uselist=False)
    wallet = relationship("Wallet", back_populates="user", uselist=False, cascade="all, delete-orphan")
    wallet_transactions = relationship(
        "WalletTransaction",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    game_results = relationship("GameResult", back_populates="user", cascade="all, delete-orphan")
    stage_progress = relationship("StageProgress", back_populates="user", cascade="all, delete-orphan")


from app.models import game_result as _game_result  # noqa: F401,E402
from app.models import stage_progress as _stage_progress  # noqa: F401,E402
from app.models import wallet as _wallet  # noqa: F401,E402
from app.models import wallet_transaction as _wallet_transaction  # noqa: F401,E402
