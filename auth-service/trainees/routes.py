from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above
from database import get_db
from models import Trainee

from .schemas import TraineeResponse, TraineeUpdate

trainee_router = APIRouter(prefix="/trainees", tags=["trainees"])


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
