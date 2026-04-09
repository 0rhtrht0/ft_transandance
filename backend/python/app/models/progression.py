from sqlalchemy import Column, Integer, String
from app.core.database import Base

class Progression(Base):
    __tablename__ = "player_progress"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    difficulty = Column(String)
    stage = Column(Integer)
