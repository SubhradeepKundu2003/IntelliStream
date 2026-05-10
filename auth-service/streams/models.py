from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, UniqueConstraint
from database import Base


class BatchStream(Base):
    __tablename__ = "batch_streams"
    __table_args__ = (UniqueConstraint("batch_name", "name", name="uq_batch_stream_name"),)

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)


class StreamSubjectWeight(Base):
    __tablename__ = "stream_subject_weights"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=False, index=True)
    subject_name = Column(String, nullable=False)
    weight_pct = Column(Float, nullable=False)
