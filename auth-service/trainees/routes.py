import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above
from database import get_db
from models import Batch, Trainee

from .schemas import (
    BatchCreate,
    BatchResponse,
    BatchUpdate,
    ImportResult,
    TraineeResponse,
    TraineeUpdate,
)

router = APIRouter(prefix="/batches", tags=["batches"])
trainee_router = APIRouter(prefix="/trainees", tags=["trainees"])


@router.get("", response_model=list[BatchResponse])
def list_batches(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Batch).filter(Batch.is_active == True).all()


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    body: BatchCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    existing = db.query(Batch).filter(
        Batch.name == body.name,
        Batch.year == body.year,
        Batch.quarter == body.quarter,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Batch with same name, year and quarter already exists",
        )
    batch = Batch(name=body.name, year=body.year, quarter=body.quarter)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.patch("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    body: BatchUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.is_active == True).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(batch, field, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}/trainees", response_model=list[TraineeResponse])
def list_trainees(
    batch_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if not db.query(Batch).filter(Batch.id == batch_id, Batch.is_active == True).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return db.query(Trainee).filter(Trainee.batch_id == batch_id, Trainee.is_active == True).all()


@router.post("/{batch_id}/trainees/import", response_model=ImportResult)
async def import_trainees(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    if not db.query(Batch).filter(Batch.id == batch_id, Batch.is_active == True).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    content = await file.read()
    reader = csv.reader(io.StringIO(content.decode("utf-8")))

    existing_ids = {
        t.employee_id
        for t in db.query(Trainee).filter(Trainee.batch_id == batch_id).all()
    }

    imported = 0
    skipped = 0
    errors: list[str] = []

    for i, row in enumerate(reader):
        if i == 0:
            continue
        if len(row) < 2:
            skipped += 1
            errors.append(f"Row {i + 1}: too few columns")
            continue

        employee_id = row[0].strip()
        name = row[1].strip()
        email = row[2].strip() if len(row) > 2 and row[2].strip() else None

        if employee_id in existing_ids:
            skipped += 1
            errors.append(f"Row {i + 1}: employee_id '{employee_id}' already exists in this batch")
            continue

        db.add(Trainee(employee_id=employee_id, name=name, email=email, batch_id=batch_id))
        existing_ids.add(employee_id)
        imported += 1

    db.commit()

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    batch.total_trainees = (
        db.query(Trainee).filter(Trainee.batch_id == batch_id, Trainee.is_active == True).count()
    )
    db.commit()

    return ImportResult(imported=imported, skipped=skipped, errors=errors)


@trainee_router.get("/{trainee_id}", response_model=TraineeResponse)
def get_trainee(
    trainee_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainee not found")
    return trainee


@trainee_router.patch("/{trainee_id}", response_model=TraineeResponse)
def update_trainee(
    trainee_id: int,
    body: TraineeUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainee not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(trainee, field, value)
    db.commit()
    db.refresh(trainee)
    return trainee
