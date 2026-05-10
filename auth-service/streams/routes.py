import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above, require_sme_or_above
from database import get_db
from sync.models import SyncedBatch
from .models import BatchStream, StreamSubjectWeight
from .schemas import (
    BatchStreamResponse,
    StreamCreate,
    StreamRename,
    SubjectWeightResponse,
    WeightsSet,
)

router = APIRouter(prefix="/batches", tags=["streams"])


def _get_batch_subjects(batch_name: str, db: Session) -> list[str]:
    batch = db.query(SyncedBatch).filter(SyncedBatch.batch_name == batch_name).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch '{batch_name}' not found in synced data",
        )
    return json.loads(batch.subjects_json)


def _stream_response(stream: BatchStream, db: Session) -> BatchStreamResponse:
    weights = (
        db.query(StreamSubjectWeight)
        .filter(StreamSubjectWeight.stream_id == stream.id)
        .all()
    )
    return BatchStreamResponse(
        id=stream.id,
        batch_name=stream.batch_name,
        name=stream.name,
        is_active=stream.is_active,
        weights=[SubjectWeightResponse(subject_name=w.subject_name, weight_pct=w.weight_pct) for w in weights],
    )


@router.get("/{batch_name}/streams", response_model=list[BatchStreamResponse])
def list_streams(batch_name: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    _get_batch_subjects(batch_name, db)
    streams = (
        db.query(BatchStream)
        .filter(BatchStream.batch_name == batch_name, BatchStream.is_active == True)
        .all()
    )
    return [_stream_response(s, db) for s in streams]


@router.post("/{batch_name}/streams", response_model=BatchStreamResponse, status_code=status.HTTP_201_CREATED)
def create_stream(batch_name: str, body: StreamCreate, db: Session = Depends(get_db), _=Depends(require_manager_or_above)):
    _get_batch_subjects(batch_name, db)
    existing = (
        db.query(BatchStream)
        .filter(BatchStream.batch_name == batch_name, BatchStream.name == body.name, BatchStream.is_active == True)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Stream '{body.name}' already exists in batch '{batch_name}'")
    stream = BatchStream(batch_name=batch_name, name=body.name)
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return _stream_response(stream, db)


@router.put("/{batch_name}/streams/{stream_id}", response_model=BatchStreamResponse)
def rename_stream(batch_name: str, stream_id: int, body: StreamRename, db: Session = Depends(get_db), _=Depends(require_manager_or_above)):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    conflict = (
        db.query(BatchStream)
        .filter(BatchStream.batch_name == batch_name, BatchStream.name == body.name, BatchStream.id != stream_id, BatchStream.is_active == True)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Stream '{body.name}' already exists in batch '{batch_name}'")
    stream.name = body.name
    db.commit()
    db.refresh(stream)
    return _stream_response(stream, db)


@router.delete("/{batch_name}/streams/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stream(batch_name: str, stream_id: int, db: Session = Depends(get_db), _=Depends(require_manager_or_above)):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    stream.is_active = False
    db.commit()


@router.post("/{batch_name}/streams/{stream_id}/weights", response_model=BatchStreamResponse)
def set_weights(batch_name: str, stream_id: int, body: WeightsSet, db: Session = Depends(get_db), _=Depends(require_sme_or_above)):
    batch_subjects = _get_batch_subjects(batch_name, db)
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")

    incoming_subjects = {w.subject_name for w in body.weights}

    invalid = incoming_subjects - set(batch_subjects)
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Subjects not in batch '{batch_name}': {sorted(invalid)}",
        )

    missing = set(batch_subjects) - incoming_subjects
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing weights for batch subjects: {sorted(missing)}",
        )

    db.query(StreamSubjectWeight).filter(StreamSubjectWeight.stream_id == stream_id).delete()
    for w in body.weights:
        db.add(StreamSubjectWeight(stream_id=stream_id, subject_name=w.subject_name, weight_pct=w.weight_pct))
    db.commit()
    return _stream_response(stream, db)
