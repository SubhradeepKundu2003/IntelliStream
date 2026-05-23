from typing import Optional
from pydantic import BaseModel


class RowResult(BaseModel):
    row: int
    trainee_id: str
    status: str  # "ok" | "error"
    detail: Optional[str] = None


class ScoresUploadResult(BaseModel):
    rows_processed: int
    rows_succeeded: int
    rows_failed: int
    row_results: list[RowResult]
    sync_triggered: bool


class StreamReferenceResponse(BaseModel):
    trainee_id: str
    batch_name: str
    stream_name: str
    updated_at: str

    class Config:
        from_attributes = True
