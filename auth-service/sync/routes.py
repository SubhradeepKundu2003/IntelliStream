import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above
from database import get_db
from .models import SyncedBatch, SyncedDpiRecord, SyncedSubjectScore, SyncStatus
from .schemas import (
    BatchResponse,
    DpiRecordResponse,
    SubjectScoreResponse,
    SyncStatusResponse,
    SyncTriggerResponse,
)
from .service import run_sync

router = APIRouter(prefix="/sync", tags=["sync"])


def _batch_resp(b: SyncedBatch) -> BatchResponse:
    return BatchResponse(
        id=b.id,
        batch_name=b.batch_name,
        subjects=json.loads(b.subjects_json),
        synced_at=b.synced_at,
    )


@router.get("/batches", response_model=list[BatchResponse])
def list_batches(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [_batch_resp(b) for b in db.query(SyncedBatch).all()]


@router.get("/batches/{batch_name}", response_model=BatchResponse)
def get_batch(batch_name: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    b = db.query(SyncedBatch).filter(SyncedBatch.batch_name == batch_name).first()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return _batch_resp(b)


@router.get("/dpi", response_model=list[DpiRecordResponse])
def list_dpi(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(SyncedDpiRecord).all()


@router.get("/dpi/{trainee_id}", response_model=DpiRecordResponse)
def get_dpi(trainee_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    d = db.query(SyncedDpiRecord).filter(SyncedDpiRecord.trainee_id == trainee_id).first()
    if not d:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DPI record not found")
    return d


@router.get("/scores", response_model=list[SubjectScoreResponse])
def list_scores(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(SyncedSubjectScore).all()


@router.get("/scores/trainee/{trainee_id}", response_model=list[SubjectScoreResponse])
def get_scores_by_trainee(trainee_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(SyncedSubjectScore).filter(SyncedSubjectScore.trainee_id == trainee_id).all()


@router.get("/status", response_model=SyncStatusResponse)
def get_sync_status(db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(SyncStatus).filter(SyncStatus.source == "springboot").first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No sync has run yet")
    return s


@router.post("/trigger", response_model=SyncTriggerResponse)
async def trigger_sync(_=Depends(require_manager_or_above)):
    result = await run_sync()
    return SyncTriggerResponse(message="Sync completed successfully", **result)
