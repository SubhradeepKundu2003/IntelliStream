from typing import List, Optional
from pydantic import BaseModel


class BatchResponse(BaseModel):
    id: int
    batch_name: str
    subjects: List[str]
    trainee_count: int
    synced_at: str
    model_config = {"from_attributes": True}


class DpiRecordResponse(BaseModel):
    id: int
    trainee_id: str
    batch_name: str
    trainee_name: str
    dpi: float
    synced_at: str
    model_config = {"from_attributes": True}


class SubjectScoreResponse(BaseModel):
    id: int
    external_id: str
    batch_name: str
    trainee_id: str
    trainee_name: str
    subject_name: str
    subject_id: Optional[str]
    exam_name: Optional[str]
    score: float
    synced_at: str
    model_config = {"from_attributes": True}


class SyncStatusResponse(BaseModel):
    source: str
    last_sync_at: Optional[str]
    last_sync_status: Optional[str]
    records_synced: Optional[int]
    model_config = {"from_attributes": True}


class SyncTriggerResponse(BaseModel):
    message: str
    batches_synced: int
    dpi_records_synced: int
    scores_synced: int
    synced_at: str
