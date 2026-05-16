import enum
from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.sql import func
from database import Base


class SuggestionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    ignored = "ignored"


class StreamSuggestion(Base):
    __tablename__ = "stream_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    generation_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    priority = Column(Integer, nullable=False, default=0)
    reasoning = Column(Text, nullable=False)
    weights_json = Column(Text, nullable=False)
    status = Column(Enum(SuggestionStatus), default=SuggestionStatus.pending, nullable=False)
    generated_by_email = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_by_email = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
