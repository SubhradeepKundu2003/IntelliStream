import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class ProposalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BatchStream(Base):
    __tablename__ = "batch_streams"
    __table_args__ = (UniqueConstraint("batch_name", "name", name="uq_batch_stream_name"),)

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    # Lower value = higher allocation priority; 0 = unranked (allocated last)
    priority = Column(Integer, nullable=False, default=0, server_default="0")


class StreamSubjectWeight(Base):
    __tablename__ = "stream_subject_weights"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=False, index=True)
    subject_name = Column(String, nullable=False)
    weight_pct = Column(Float, nullable=False)


class StreamWeightProposal(Base):
    __tablename__ = "stream_weight_proposals"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=False, index=True)
    proposed_by_email = Column(String, nullable=False)
    status = Column(Enum(ProposalStatus), default=ProposalStatus.pending, nullable=False, index=True)
    proposed_weights_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_by_email = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(String, nullable=True)


class BatchStreamSME(Base):
    __tablename__ = "batch_stream_smes"
    __table_args__ = (UniqueConstraint("stream_id", "user_id", name="uq_stream_sme"),)

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_email = Column(String, nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True)
