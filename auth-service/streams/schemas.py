from pydantic import BaseModel, field_validator, model_validator
from typing import List


class SubjectWeightResponse(BaseModel):
    subject_name: str
    weight_pct: float
    model_config = {"from_attributes": True}


class BatchStreamResponse(BaseModel):
    id: int
    batch_name: str
    name: str
    is_active: bool
    weights: List[SubjectWeightResponse] = []
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
