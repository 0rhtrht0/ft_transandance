from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from sqlalchemy import Boolean

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    bio = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    is_online = Column(Boolean, default=False)
    user = relationship("User", back_populates="profile")
