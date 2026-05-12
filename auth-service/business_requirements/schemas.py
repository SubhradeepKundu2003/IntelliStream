from typing import Literal
from pydantic import BaseModel


class BRStreamCreate(BaseModel):
    name: str
    is_mandatory: bool = False
    capacity_type: Literal["percentage", "count"]
    capacity_value: float
    roles_needed: list[str] = []
    subjects_needed: list[str] = []


class BRStreamResponse(BaseModel):
    id: int
    br_id: int
    name: str
    is_mandatory: bool
    capacity_type: str
    capacity_value: float
    roles_needed: list[str]
    subjects_needed: list[str]
    is_active: bool
    model_config = {"from_attributes": True}


class BRCreate(BaseModel):
    batch_name: str
    title: str
    streams: list[BRStreamCreate] = []


class BRUpdate(BaseModel):
    title: str | None = None
    streams: list[BRStreamCreate] | None = None


class BRResponse(BaseModel):
    id: int
    batch_name: str
    title: str
    created_at: str
    is_active: bool
    streams: list[BRStreamResponse] = []
    model_config = {"from_attributes": True}


class BRSummary(BaseModel):
    id: int
    batch_name: str
    title: str
    created_at: str
    is_active: bool
    stream_count: int


class ExcelImportResult(BaseModel):
    streams: list[BRStreamCreate]
    errors: list[str]
