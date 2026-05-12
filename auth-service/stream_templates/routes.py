from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above, require_sme_or_above
from database import get_db
from models import Stream, StreamSubject

from .schemas import (
    StreamCreate,
    StreamDetailResponse,
    StreamResponse,
    StreamUpdate,
    SubjectWeightCreate,
    SubjectWeightResponse,
)

router = APIRouter(prefix="/streams", tags=["streams"])


@router.get("", response_model=list[StreamResponse])
def list_streams(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Stream)
    if not include_inactive:
        q = q.filter(Stream.is_active == True)
    return q.all()


@router.get("/{stream_id}", response_model=StreamDetailResponse)
def get_stream(
    stream_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    subjects = db.query(StreamSubject).filter(StreamSubject.stream_id == stream_id).all()
    return StreamDetailResponse(
        id=stream.id,
        name=stream.name,
        description=stream.description,
        is_mandatory=stream.is_mandatory,
        intake_pct=stream.intake_pct,
        is_active=stream.is_active,
        subjects=[SubjectWeightResponse.model_validate(s) for s in subjects],
    )


@router.post("", response_model=StreamResponse, status_code=status.HTTP_201_CREATED)
def create_stream(
    body: StreamCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    if db.query(Stream).filter(Stream.name == body.name).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stream '{body.name}' already exists",
        )
    stream = Stream(
        name=body.name,
        description=body.description,
        is_mandatory=body.is_mandatory,
        intake_pct=body.intake_pct,
    )
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return stream


@router.put("/{stream_id}", response_model=StreamResponse)
def update_stream(
    stream_id: int,
    body: StreamUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(stream, field, value)
    db.commit()
    db.refresh(stream)
    return stream


@router.delete("/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stream(
    stream_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    if stream.is_mandatory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a mandatory stream",
        )
    stream.is_active = False
    db.commit()


@router.get("/{stream_id}/subjects", response_model=list[SubjectWeightResponse])
def list_subjects(
    stream_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if not db.query(Stream).filter(Stream.id == stream_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    return db.query(StreamSubject).filter(StreamSubject.stream_id == stream_id).all()


@router.post("/{stream_id}/subjects", response_model=list[SubjectWeightResponse])
def set_subjects(
    stream_id: int,
    body: list[SubjectWeightCreate],
    db: Session = Depends(get_db),
    _=Depends(require_sme_or_above),
):
    if not db.query(Stream).filter(Stream.id == stream_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    total = sum(s.weight_pct for s in body)
    if abs(total - 100.0) > 0.1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Subject weights must sum to 100",
        )
    db.query(StreamSubject).filter(StreamSubject.stream_id == stream_id).delete()
    db.add_all([
        StreamSubject(stream_id=stream_id, subject_name=s.subject_name, weight_pct=s.weight_pct)
        for s in body
    ])
    db.commit()
    return db.query(StreamSubject).filter(StreamSubject.stream_id == stream_id).all()
