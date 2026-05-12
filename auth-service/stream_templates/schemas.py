from pydantic import BaseModel, field_validator


class SubjectWeightCreate(BaseModel):
    subject_name: str
    weight_pct: float


class SubjectWeightResponse(BaseModel):
    id: int
    stream_id: int
    subject_name: str
    weight_pct: float
    model_config = {"from_attributes": True}


class StreamCreate(BaseModel):
    name: str
    description: str | None = None
    is_mandatory: bool = False
    intake_pct: float

    @field_validator("intake_pct")
    @classmethod
    def validate_intake_pct(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("intake_pct must be between 0 and 100")
        return v


class StreamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_mandatory: bool | None = None
    intake_pct: float | None = None
    is_active: bool | None = None

    @field_validator("intake_pct")
    @classmethod
    def validate_intake_pct(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("intake_pct must be between 0 and 100")
        return v


class StreamResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_mandatory: bool
    intake_pct: float
    is_active: bool
    model_config = {"from_attributes": True}


class StreamDetailResponse(StreamResponse):
    subjects: list[SubjectWeightResponse] = []
