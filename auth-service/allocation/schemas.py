from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class AllocationConfigResponse(BaseModel):
    batch_name: str
    score_weight: float
    dpi_weight: float
    last_run_at: datetime | None
    run_by_email: str | None
    is_frozen: bool
    frozen_at: datetime | None
    frozen_by_email: str | None
    model_config = {"from_attributes": True}


class AllocationConfigUpdate(BaseModel):
    score_weight: float
    dpi_weight: float

    @field_validator("score_weight", "dpi_weight")
    @classmethod
    def between_zero_one(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("weight must be between 0 and 1")
        return round(v, 4)

    @field_validator("dpi_weight")
    @classmethod
    def weights_sum_to_one(cls, dpi: float, info) -> float:
        score = info.data.get("score_weight")
        if score is not None and abs(score + dpi - 1.0) > 0.001:
            raise ValueError("score_weight + dpi_weight must equal 1.0")
        return dpi


class StreamScoreDetail(BaseModel):
    stream_id: int
    stream_name: str
    composite: float
    subject_score: float


class TraineeAllocationResponse(BaseModel):
    id: int
    batch_name: str
    employee_id: str
    trainee_name: str
    dpi_score: float | None
    subject_score: float | None
    composite_score: float | None
    suggested_stream_id: int | None
    suggested_stream_name: str | None
    manual_stream_id: int | None
    manual_stream_name: str | None
    effective_stream_id: int | None
    effective_stream_name: str | None
    manual_override_reason: str | None
    overridden_by_email: str | None
    overridden_at: datetime | None
    is_frozen: bool
    frozen_at: datetime | None
    frozen_by_email: str | None
    score_breakdown: dict[str, float]          # subject → avg score
    all_stream_scores: list[StreamScoreDetail]  # sorted by composite desc
    model_config = {"from_attributes": True}


class ManualOverrideRequest(BaseModel):
    stream_id: int
    reason: str


class AllocationRunRequest(BaseModel):
    mode: str = "priority"  # "priority" or "fit_score"

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        if v not in ("priority", "fit_score"):
            raise ValueError("mode must be 'priority' or 'fit_score'")
        return v


class AllocationRunResult(BaseModel):
    batch_name: str
    total: int
    allocated: int
    unallocated: int
    run_by_email: str
    run_at: datetime
    mode: str = "priority"


class AllocationAIRecommendationResponse(BaseModel):
    id: int
    batch_name: str
    employee_id: str
    generation_id: str
    agrees_with_algorithm: bool
    recommended_stream_name: str | None
    confidence: str
    reasoning: str
    generated_by_email: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class SMEAssociateRequestCreate(BaseModel):
    stream_id: int
    requested_employee_ids: list[str]

    @field_validator("requested_employee_ids")
    @classmethod
    def validate_employee_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("At least one employee ID is required")
        deduped = list(dict.fromkeys(v))
        if len(deduped) > 5:
            raise ValueError("Cannot request more than 5 associates")
        return deduped


class SMEAssociateRequestResponse(BaseModel):
    id: int
    batch_name: str
    stream_id: int
    stream_name: Optional[str]
    sme_email: str
    requested_employee_ids: list[str]
    status: str
    approved_employee_ids: Optional[list[str]]
    reviewed_by_email: Optional[str]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class SMEAssociateRequestReview(BaseModel):
    approved_employee_ids: list[str]
    review_notes: Optional[str] = None
