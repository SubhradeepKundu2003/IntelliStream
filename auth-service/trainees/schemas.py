from pydantic import BaseModel, field_validator

from models import BatchStatus


class BatchCreate(BaseModel):
    name: str
    year: int
    quarter: int

    @field_validator("quarter")
    @classmethod
    def validate_quarter(cls, v: int) -> int:
        if v not in (1, 2, 3, 4):
            raise ValueError("quarter must be 1-4")
        return v


class BatchUpdate(BaseModel):
    name: str | None = None
    status: BatchStatus | None = None


class BatchResponse(BaseModel):
    id: int
    name: str
    year: int
    quarter: int
    total_trainees: int
    status: BatchStatus
    is_active: bool
    model_config = {"from_attributes": True}


class TraineeCreate(BaseModel):
    employee_id: str
    name: str
    email: str | None = None


class TraineeUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    is_active: bool | None = None


class TraineeResponse(BaseModel):
    id: int
    employee_id: str
    name: str
    email: str | None
    batch_id: int
    is_active: bool
    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]
