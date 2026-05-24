import enum
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator, model_validator


class SubjectWeightResponse(BaseModel):
    subject_name: str
    weight_pct: float
    model_config = {"from_attributes": True}


class ProposalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class WeightProposalResponse(BaseModel):
    id: int
    stream_id: int
    proposed_by_email: str
    status: ProposalStatus
    proposed_weights: List[SubjectWeightResponse]
    created_at: datetime
    reviewed_by_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    model_config = {"from_attributes": True}


class ProposalReview(BaseModel):
    rejection_reason: Optional[str] = None


class BatchStreamResponse(BaseModel):
    id: int
    batch_name: str
    name: str
    is_active: bool
    priority: int = 0
    trainee_pct: float = 0.0
    weights: List[SubjectWeightResponse] = []
    has_pending_proposal: bool = False
    model_config = {"from_attributes": True}


class StreamCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Stream name cannot be blank")
        return v.strip()


class StreamRename(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Stream name cannot be blank")
        return v.strip()


class SubjectWeightInput(BaseModel):
    subject_name: str
    weight_pct: float


class WeightsSet(BaseModel):
    weights: List[SubjectWeightInput]

    @model_validator(mode="after")
    def weights_sum_to_100(self) -> "WeightsSet":
        total = sum(w.weight_pct for w in self.weights)
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"Subject weights must sum to 100.0, got {total:.2f}")
        return self


class StreamPrioritySet(BaseModel):
    priority: int

    @field_validator("priority")
    @classmethod
    def priority_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Priority must be 0 (unranked) or a positive integer")
        return v


class StreamTraineePctSet(BaseModel):
    trainee_pct: float

    @field_validator("trainee_pct")
    @classmethod
    def pct_in_range(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("Trainee percentage must be between 0 and 100")
        return round(v, 2)


class StreamReorderRequest(BaseModel):
    stream_ids: List[int]


class SMEAssignRequest(BaseModel):
    user_id: int


class SMEAssignmentResponse(BaseModel):
    id: int
    stream_id: int
    stream_name: str
    batch_name: str
    user_id: int
    user_email: str
    assigned_by_email: str
    assigned_at: datetime
    is_active: bool
    model_config = {"from_attributes": True}
