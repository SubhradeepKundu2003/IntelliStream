import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above, require_sme_or_above
from database import get_db
from models import Role, User
from notifications.models import NotificationType
from notifications.service import create_notification
from sync.models import SyncedBatch
from .models import BatchStream, BatchStreamSME, ProposalStatus, StreamSubjectWeight, StreamWeightProposal
from .schemas import (
    BatchStreamResponse,
    ProposalReview,
    SMEAssignRequest,
    SMEAssignmentResponse,
    StreamCreate,
    StreamPrioritySet,
    StreamRename,
    SubjectWeightResponse,
    WeightProposalResponse,
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


def _get_pending_proposal(stream_id: int, db: Session) -> StreamWeightProposal | None:
    return (
        db.query(StreamWeightProposal)
        .filter(StreamWeightProposal.stream_id == stream_id, StreamWeightProposal.status == ProposalStatus.pending)
        .first()
    )


def _stream_response(stream: BatchStream, db: Session) -> BatchStreamResponse:
    weights = (
        db.query(StreamSubjectWeight)
        .filter(StreamSubjectWeight.stream_id == stream.id)
        .all()
    )
    has_pending = _get_pending_proposal(stream.id, db) is not None
    return BatchStreamResponse(
        id=stream.id,
        batch_name=stream.batch_name,
        name=stream.name,
        is_active=stream.is_active,
        priority=stream.priority,
        weights=[SubjectWeightResponse(subject_name=w.subject_name, weight_pct=w.weight_pct) for w in weights],
        has_pending_proposal=has_pending,
    )


def _sme_assignment_response(assignment: BatchStreamSME, stream: BatchStream, user_email: str) -> SMEAssignmentResponse:
    return SMEAssignmentResponse(
        id=assignment.id,
        stream_id=assignment.stream_id,
        stream_name=stream.name,
        batch_name=stream.batch_name,
        user_id=assignment.user_id,
        user_email=user_email,
        assigned_by_email=assignment.assigned_by_email,
        assigned_at=assignment.assigned_at,
        is_active=assignment.is_active,
    )


def _proposal_response(proposal: StreamWeightProposal) -> WeightProposalResponse:
    proposed_weights = [SubjectWeightResponse(**w) for w in json.loads(proposal.proposed_weights_json)]
    return WeightProposalResponse(
        id=proposal.id,
        stream_id=proposal.stream_id,
        proposed_by_email=proposal.proposed_by_email,
        status=proposal.status,
        proposed_weights=proposed_weights,
        created_at=proposal.created_at,
        reviewed_by_email=proposal.reviewed_by_email,
        reviewed_at=proposal.reviewed_at,
        rejection_reason=proposal.rejection_reason,
    )


def _validate_weights_against_batch(batch_name: str, body: WeightsSet, batch_subjects: list[str]) -> None:
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


@router.get("/{batch_name}/streams", response_model=list[BatchStreamResponse])
def list_streams(batch_name: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    _get_batch_subjects(batch_name, db)
    streams = (
        db.query(BatchStream)
        .filter(BatchStream.batch_name == batch_name, BatchStream.is_active == True)
        .order_by(
            # Unranked (priority=0) streams go last; ranked streams ordered 1, 2, 3...
            (BatchStream.priority == 0).desc(),
            BatchStream.priority.asc(),
        )
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
    assignments = db.query(BatchStreamSME).filter(BatchStreamSME.stream_id == stream_id, BatchStreamSME.is_active == True).all()
    for a in assignments:
        sme_user = db.query(User).filter(User.id == a.user_id).first()
        if sme_user:
            create_notification(
                db, sme_user.email, NotificationType.stream_deleted,
                "Stream Deleted",
                f"Stream '{stream.name}' in batch '{batch_name}' has been deleted.",
            )
    stream.is_active = False
    db.commit()


@router.patch("/{batch_name}/streams/{stream_id}/priority", response_model=BatchStreamResponse)
def set_stream_priority(
    batch_name: str,
    stream_id: int,
    body: StreamPrioritySet,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    if body.priority != 0:
        conflict = (
            db.query(BatchStream)
            .filter(
                BatchStream.batch_name == batch_name,
                BatchStream.priority == body.priority,
                BatchStream.id != stream_id,
                BatchStream.is_active == True,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Priority {body.priority} is already assigned to stream '{conflict.name}' in this batch",
            )
    stream.priority = body.priority
    db.commit()
    db.refresh(stream)
    return _stream_response(stream, db)


@router.post("/{batch_name}/streams/{stream_id}/weights", response_model=BatchStreamResponse)
def set_weights(
    batch_name: str,
    stream_id: int,
    body: WeightsSet,
    db: Session = Depends(get_db),
    user: User = Depends(require_sme_or_above),
):
    batch_subjects = _get_batch_subjects(batch_name, db)
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")

    if _get_pending_proposal(stream_id, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A weight change proposal is already pending approval for this stream. No changes allowed until it is reviewed.",
        )

    if user.role == Role.sme:
        assigned = (
            db.query(BatchStreamSME)
            .filter(BatchStreamSME.stream_id == stream_id, BatchStreamSME.user_id == user.id, BatchStreamSME.is_active == True)
            .first()
        )
        if not assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned as SME for this stream.",
            )

    _validate_weights_against_batch(batch_name, body, batch_subjects)

    if user.role == Role.sme:
        weights_json = json.dumps([{"subject_name": w.subject_name, "weight_pct": w.weight_pct} for w in body.weights])
        proposal = StreamWeightProposal(
            stream_id=stream_id,
            proposed_by_email=user.email,
            status=ProposalStatus.pending,
            proposed_weights_json=weights_json,
        )
        db.add(proposal)
        managers = db.query(User).filter(User.role.in_([Role.manager, Role.admin]), User.is_active == True).all()
        for mgr in managers:
            create_notification(
                db, mgr.email, NotificationType.proposal_submitted,
                "Weight Proposal Pending Review",
                f"{user.email} submitted a weight proposal for stream '{stream.name}' in batch '{batch_name}'.",
            )
        db.commit()
    else:
        db.query(StreamSubjectWeight).filter(StreamSubjectWeight.stream_id == stream_id).delete()
        for w in body.weights:
            db.add(StreamSubjectWeight(stream_id=stream_id, subject_name=w.subject_name, weight_pct=w.weight_pct))
        db.commit()

    return _stream_response(stream, db)


@router.get("/{batch_name}/streams/{stream_id}/proposals", response_model=list[WeightProposalResponse])
def list_proposals(
    batch_name: str,
    stream_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    proposals = (
        db.query(StreamWeightProposal)
        .filter(StreamWeightProposal.stream_id == stream_id)
        .order_by(StreamWeightProposal.created_at.desc())
        .all()
    )
    return [_proposal_response(p) for p in proposals]


@router.post("/{batch_name}/streams/{stream_id}/proposals/{proposal_id}/approve", response_model=WeightProposalResponse)
def approve_proposal(
    batch_name: str,
    stream_id: int,
    proposal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    proposal = db.query(StreamWeightProposal).filter(
        StreamWeightProposal.id == proposal_id, StreamWeightProposal.stream_id == stream_id
    ).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if proposal.status != ProposalStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Proposal is already {proposal.status.value}")

    weights = json.loads(proposal.proposed_weights_json)
    db.query(StreamSubjectWeight).filter(StreamSubjectWeight.stream_id == stream_id).delete()
    for w in weights:
        db.add(StreamSubjectWeight(stream_id=stream_id, subject_name=w["subject_name"], weight_pct=w["weight_pct"]))

    proposal.status = ProposalStatus.approved
    proposal.reviewed_by_email = user.email
    proposal.reviewed_at = datetime.now(timezone.utc)
    create_notification(
        db, proposal.proposed_by_email, NotificationType.proposal_approved,
        "Weight Proposal Approved",
        f"Your weight proposal for stream '{stream.name}' in batch '{batch_name}' was approved by {user.email}.",
    )
    db.commit()
    db.refresh(proposal)
    return _proposal_response(proposal)


@router.post("/{batch_name}/streams/{stream_id}/proposals/{proposal_id}/reject", response_model=WeightProposalResponse)
def reject_proposal(
    batch_name: str,
    stream_id: int,
    proposal_id: int,
    body: ProposalReview,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    proposal = db.query(StreamWeightProposal).filter(
        StreamWeightProposal.id == proposal_id, StreamWeightProposal.stream_id == stream_id
    ).first()
    if not proposal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")
    if proposal.status != ProposalStatus.pending:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Proposal is already {proposal.status.value}")

    proposal.status = ProposalStatus.rejected
    proposal.reviewed_by_email = user.email
    proposal.reviewed_at = datetime.now(timezone.utc)
    proposal.rejection_reason = body.rejection_reason
    reason_part = f" Reason: {body.rejection_reason}" if body.rejection_reason else ""
    create_notification(
        db, proposal.proposed_by_email, NotificationType.proposal_rejected,
        "Weight Proposal Rejected",
        f"Your weight proposal for stream '{stream.name}' in batch '{batch_name}' was rejected by {user.email}.{reason_part}",
    )
    db.commit()
    db.refresh(proposal)
    return _proposal_response(proposal)


@router.get("/{batch_name}/streams/{stream_id}/smes", response_model=list[SMEAssignmentResponse])
def list_stream_smes(
    batch_name: str,
    stream_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    assignments = db.query(BatchStreamSME).filter(BatchStreamSME.stream_id == stream_id, BatchStreamSME.is_active == True).all()
    result = []
    for a in assignments:
        sme_user = db.query(User).filter(User.id == a.user_id).first()
        if sme_user:
            result.append(_sme_assignment_response(a, stream, sme_user.email))
    return result


@router.post("/{batch_name}/streams/{stream_id}/smes", response_model=SMEAssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_sme(
    batch_name: str,
    stream_id: int,
    body: SMEAssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")

    sme_user = db.query(User).filter(User.id == body.user_id, User.is_active == True).first()
    if not sme_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if sme_user.role != Role.sme:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"User '{sme_user.email}' does not have the SME role")

    existing = db.query(BatchStreamSME).filter(BatchStreamSME.stream_id == stream_id, BatchStreamSME.user_id == body.user_id).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"User '{sme_user.email}' is already assigned as SME for this stream")
        existing.is_active = True
        existing.assigned_by_email = user.email
        create_notification(
            db, sme_user.email, NotificationType.sme_assigned,
            "You've Been Assigned as SME",
            f"You have been assigned as SME for stream '{stream.name}' in batch '{batch_name}' by {user.email}.",
        )
        db.commit()
        db.refresh(existing)
        return _sme_assignment_response(existing, stream, sme_user.email)

    assignment = BatchStreamSME(stream_id=stream_id, user_id=body.user_id, assigned_by_email=user.email)
    db.add(assignment)
    create_notification(
        db, sme_user.email, NotificationType.sme_assigned,
        "You've Been Assigned as SME",
        f"You have been assigned as SME for stream '{stream.name}' in batch '{batch_name}' by {user.email}.",
    )
    db.commit()
    db.refresh(assignment)
    return _sme_assignment_response(assignment, stream, sme_user.email)


@router.delete("/{batch_name}/streams/{stream_id}/smes/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_sme(
    batch_name: str,
    stream_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_above),
):
    stream = db.query(BatchStream).filter(BatchStream.id == stream_id, BatchStream.batch_name == batch_name, BatchStream.is_active == True).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stream not found")
    assignment = db.query(BatchStreamSME).filter(BatchStreamSME.stream_id == stream_id, BatchStreamSME.user_id == user_id, BatchStreamSME.is_active == True).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SME assignment not found")
    sme_user = db.query(User).filter(User.id == user_id).first()
    if sme_user:
        create_notification(
            db, sme_user.email, NotificationType.sme_removed,
            "SME Assignment Removed",
            f"You have been removed as SME from stream '{stream.name}' in batch '{batch_name}'.",
        )
    assignment.is_active = False
    db.commit()


@router.get("/{batch_name}/my-sme-assignments", response_model=list[int])
def my_sme_assignments(
    batch_name: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    streams = db.query(BatchStream).filter(BatchStream.batch_name == batch_name, BatchStream.is_active == True).all()
    stream_ids = [s.id for s in streams]
    if not stream_ids:
        return []
    assignments = db.query(BatchStreamSME).filter(
        BatchStreamSME.stream_id.in_(stream_ids),
        BatchStreamSME.user_id == user.id,
        BatchStreamSME.is_active == True,
    ).all()
    return [a.stream_id for a in assignments]


@router.get("/{batch_name}/smes", response_model=list[SMEAssignmentResponse])
def list_batch_smes(
    batch_name: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_above),
):
    _get_batch_subjects(batch_name, db)
    streams = db.query(BatchStream).filter(BatchStream.batch_name == batch_name, BatchStream.is_active == True).all()
    stream_map = {s.id: s for s in streams}
    if not stream_map:
        return []
    assignments = db.query(BatchStreamSME).filter(
        BatchStreamSME.stream_id.in_(list(stream_map.keys())), BatchStreamSME.is_active == True
    ).all()
    result = []
    for a in assignments:
        sme_user = db.query(User).filter(User.id == a.user_id).first()
        if sme_user:
            result.append(_sme_assignment_response(a, stream_map[a.stream_id], sme_user.email))
    return result
