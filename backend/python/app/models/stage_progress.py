from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StageProgress(Base):

    __tablename__ = "stage_progress"

    id = Column(Integer, primary_key=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    difficulty = Column(String(20), nullable=False, index=True)
    current_stage = Column(Integer, nullable=False, default=1)
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('user_id', 'difficulty', name='uq_user_difficulty'),
    )
    
    user = relationship("User", back_populates="stage_progress")
    
    def __repr__(self):
        return f"<StageProgress user_id={self.user_id} difficulty={self.difficulty} stage={self.current_stage}>"
