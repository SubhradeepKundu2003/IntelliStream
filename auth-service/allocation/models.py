import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func

from database import Base


class RequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    partially_approved = "partially_approved"
    rejected = "rejected"
    cancelled = "cancelled"


class AllocationConfig(Base):
    __tablename__ = "allocation_configs"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, unique=True, nullable=False, index=True)
    # Both weights must sum to 1.0; stored as fractions (e.g. 0.60, 0.40)
    score_weight = Column(Float, nullable=False, default=0.60)
    dpi_weight = Column(Float, nullable=False, default=0.40)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    run_by_email = Column(String, nullable=True)
    # Batch-level freeze — blocks re-runs, config edits, and overrides
    is_frozen = Column(Boolean, nullable=False, default=False)
    frozen_at = Column(DateTime(timezone=True), nullable=True)
    frozen_by_email = Column(String, nullable=True)


class TraineeAllocation(Base):
    __tablename__ = "trainee_allocations"
    __table_args__ = (UniqueConstraint("batch_name", "employee_id", name="uq_alloc_batch_employee"),)

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    employee_id = Column(String, nullable=False, index=True)
    trainee_name = Column(String, nullable=False)

    # Raw scores
    dpi_score = Column(Float, nullable=True)          # 0–5 as received
    subject_score = Column(Float, nullable=True)      # weighted subject avg 0–100 for suggested stream
    composite_score = Column(Float, nullable=True)    # final 0–100 for suggested stream

    # Algorithm suggestion
    suggested_stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=True)

    # Manual override (preserved across re-runs)
    manual_stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=True)
    manual_override_reason = Column(String, nullable=True)
    overridden_by_email = Column(String, nullable=True)
    overridden_at = Column(DateTime(timezone=True), nullable=True)

    # Per-subject raw avg scores: {"java": 75.2, "python": 88.0, ...}
    score_breakdown_json = Column(Text, nullable=True)
    # Per-stream composite scores for transparency: {"<stream_id>": {"composite": X, "subject_score": Y}}
    all_stream_scores_json = Column(Text, nullable=True)

    # Trainee-level freeze — blocks overrides for this specific trainee
    is_frozen = Column(Boolean, nullable=False, default=False)
    frozen_at = Column(DateTime(timezone=True), nullable=True)
    frozen_by_email = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AllocationAIRecommendation(Base):
    __tablename__ = "allocation_ai_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    employee_id = Column(String, nullable=False, index=True)
    generation_id = Column(String, nullable=False, index=True)

    agrees_with_algorithm = Column(Boolean, nullable=False, default=True)
    # Denormalized stream name — null when agrees_with_algorithm=True
    recommended_stream_name = Column(String, nullable=True)
    confidence = Column(String, nullable=False, default="medium")  # high / medium / low
    reasoning = Column(Text, nullable=False)

    generated_by_email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SMEAssociateRequest(Base):
    __tablename__ = "sme_associate_requests"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    stream_id = Column(Integer, ForeignKey("batch_streams.id"), nullable=False, index=True)
    sme_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sme_email = Column(String, nullable=False)
    # JSON array of employee_ids (max 5): ["EMP001", "EMP002", ...]
    requested_employee_ids = Column(Text, nullable=False)
    status = Column(SAEnum(RequestStatus), default=RequestStatus.pending, nullable=False, index=True)
    # JSON array of approved employee_ids (subset of requested)
    approved_employee_ids = Column(Text, nullable=True)
    reviewed_by_email = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
