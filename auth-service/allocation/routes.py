import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_manager_or_above
from business_requirements.models import BRStream, BusinessRequirement
from database import get_db
from streams.models import BatchStream

from .ai_recommender import generate_allocation_recommendations
from .models import AllocationAIRecommendation, AllocationConfig, TraineeAllocation
from .schemas import (
    AllocationAIRecommendationResponse,
    AllocationConfigResponse,
    AllocationConfigUpdate,
    AllocationRunResult,
    ManualOverrideRequest,
    StreamScoreDetail,
    TraineeAllocationResponse,
)
from .service import get_or_create_config, run_allocation

router = APIRouter(prefix="/allocation", tags=["allocation"])


def _stream_name(stream_id: int | None, db: Session) -> str | None:
    if stream_id is None:
        return None
    s = db.query(BatchStream).filter_by(id=stream_id).first()
    return s.name if s else None


def _build_response(alloc: TraineeAllocation, db: Session) -> TraineeAllocationResponse:
    breakdown: dict[str, float] = {}
    try:
        breakdown = json.loads(alloc.score_breakdown_json or "{}")
    except (ValueError, TypeError):
        pass

    stream_scores_raw: dict[str, dict] = {}
    try:
        stream_scores_raw = json.loads(alloc.all_stream_scores_json or "{}")
    except (ValueError, TypeError):
        pass

    all_stream_scores: list[StreamScoreDetail] = []
    for sid_str, vals in stream_scores_raw.items():
        try:
            sid = int(sid_str)
        except ValueError:
            continue
        name = _stream_name(sid, db) or sid_str
        all_stream_scores.append(
            StreamScoreDetail(
                stream_id=sid,
                stream_name=name,
                composite=vals.get("composite", 0.0),
                subject_score=vals.get("subject_score", 0.0),
            )
        )
    all_stream_scores.sort(key=lambda x: x.composite, reverse=True)

    effective_id = alloc.manual_stream_id if alloc.manual_stream_id is not None else alloc.suggested_stream_id

    return TraineeAllocationResponse(
        id=alloc.id,
        batch_name=alloc.batch_name,
        employee_id=alloc.employee_id,
        trainee_name=alloc.trainee_name,
        dpi_score=alloc.dpi_score,
        subject_score=alloc.subject_score,
        composite_score=alloc.composite_score,
        suggested_stream_id=alloc.suggested_stream_id,
        suggested_stream_name=_stream_name(alloc.suggested_stream_id, db),
        manual_stream_id=alloc.manual_stream_id,
        manual_stream_name=_stream_name(alloc.manual_stream_id, db),
        effective_stream_id=effective_id,
        effective_stream_name=_stream_name(effective_id, db),
        manual_override_reason=alloc.manual_override_reason,
        overridden_by_email=alloc.overridden_by_email,
        overridden_at=alloc.overridden_at,
        score_breakdown=breakdown,
        all_stream_scores=all_stream_scores,
    )


# ── Config ──────────────────────────────────────────────────────────────────

@router.get("/{batch_name}/config", response_model=AllocationConfigResponse)
def get_config(
    batch_name: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return get_or_create_config(batch_name, db)


@router.put("/{batch_name}/config", response_model=AllocationConfigResponse)
def update_config(
    batch_name: str,
    body: AllocationConfigUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    cfg = get_or_create_config(batch_name, db)
    cfg.score_weight = body.score_weight
    cfg.dpi_weight = body.dpi_weight
    db.commit()
    db.refresh(cfg)
    return cfg


# ── Run ─────────────────────────────────────────────────────────────────────

@router.post("/{batch_name}/run", response_model=AllocationRunResult)
def trigger_allocation(
    batch_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    result = run_allocation(batch_name, current_user.email, db)
    return result


# ── Results ─────────────────────────────────────────────────────────────────

@router.get("/{batch_name}", response_model=list[TraineeAllocationResponse])
def get_allocations(
    batch_name: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    rows = (
        db.query(TraineeAllocation)
        .filter_by(batch_name=batch_name)
        .order_by(TraineeAllocation.trainee_name)
        .all()
    )
    return [_build_response(r, db) for r in rows]


# ── Manual override ──────────────────────────────────────────────────────────

@router.patch("/{batch_name}/{employee_id}/override", response_model=TraineeAllocationResponse)
def set_override(
    batch_name: str,
    employee_id: str,
    body: ManualOverrideRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    alloc = db.query(TraineeAllocation).filter_by(
        batch_name=batch_name, employee_id=employee_id
    ).first()
    if not alloc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainee allocation not found")

    stream = db.query(BatchStream).filter_by(id=body.stream_id, batch_name=batch_name).first()
    if not stream:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stream not found in this batch")

    alloc.manual_stream_id = body.stream_id
    alloc.manual_override_reason = body.reason
    alloc.overridden_by_email = current_user.email
    alloc.overridden_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alloc)
    return _build_response(alloc, db)


@router.delete("/{batch_name}/{employee_id}/override", response_model=TraineeAllocationResponse)
def clear_override(
    batch_name: str,
    employee_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_manager_or_above),
):
    alloc = db.query(TraineeAllocation).filter_by(
        batch_name=batch_name, employee_id=employee_id
    ).first()
    if not alloc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainee allocation not found")

    alloc.manual_stream_id = None
    alloc.manual_override_reason = None
    alloc.overridden_by_email = None
    alloc.overridden_at = None
    db.commit()
    db.refresh(alloc)
    return _build_response(alloc, db)


# ── AI Recommendations ───────────────────────────────────────────────────────

@router.post(
    "/{batch_name}/ai-recommendations/generate",
    response_model=list[AllocationAIRecommendationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_ai_recommendations(
    batch_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_above),
):
    allocs = (
        db.query(TraineeAllocation)
        .filter_by(batch_name=batch_name)
        .order_by(TraineeAllocation.trainee_name)
        .all()
    )
    if not allocs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No allocations found for this batch. Run allocation first.",
        )

    streams = (
        db.query(BatchStream)
        .filter_by(batch_name=batch_name, is_active=True)
        .all()
    )
    stream_names = [s.name for s in streams]
    stream_name_to_id = {s.name: s.id for s in streams}

    brs = (
        db.query(BusinessRequirement)
        .filter(BusinessRequirement.batch_name == batch_name, BusinessRequirement.is_active == True)
        .all()
    )
    br_data = []
    for br in brs:
        br_streams = (
            db.query(BRStream)
            .filter(BRStream.br_id == br.id, BRStream.is_active == True)
            .all()
        )
        br_data.append({
            "title": br.title,
            "location": br.location,
            "streams": [
                {
                    "name": s.name,
                    "is_mandatory": s.is_mandatory,
                    "roles_needed": s.roles_needed,
                    "subjects_needed": s.subjects_needed,
                }
                for s in br_streams
            ],
        })

    trainee_inputs = []
    for alloc in allocs:
        score_breakdown = {}
        try:
            score_breakdown = json.loads(alloc.score_breakdown_json or "{}")
        except (ValueError, TypeError):
            pass

        stream_fit = []
        try:
            raw = json.loads(alloc.all_stream_scores_json or "{}")
            for sid_str, vals in raw.items():
                try:
                    sid = int(sid_str)
                except ValueError:
                    continue
                name = _stream_name(sid, db) or sid_str
                stream_fit.append({"stream": name, "composite": round(vals.get("composite", 0.0), 2)})
            stream_fit.sort(key=lambda x: x["composite"], reverse=True)
        except (ValueError, TypeError):
            pass

        trainee_inputs.append({
            "employee_id": alloc.employee_id,
            "name": alloc.trainee_name,
            "dpi_score": alloc.dpi_score,
            "algorithm_suggested_stream": _stream_name(alloc.suggested_stream_id, db),
            "subject_scores": score_breakdown,
            "stream_fit_scores": stream_fit,
        })

    try:
        recommendations = await generate_allocation_recommendations(
            batch_name=batch_name,
            trainees=trainee_inputs,
            streams=stream_names,
            business_requirements=br_data,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI recommendation failed — {exc}",
        )

    # Replace existing recommendations for this batch
    db.query(AllocationAIRecommendation).filter_by(batch_name=batch_name).delete()

    gen_id = str(uuid.uuid4())
    rec_by_eid = {r["employee_id"]: r for r in recommendations}

    rows: list[AllocationAIRecommendation] = []
    for alloc in allocs:
        rec = rec_by_eid.get(alloc.employee_id)
        if not rec:
            continue
        row = AllocationAIRecommendation(
            batch_name=batch_name,
            employee_id=alloc.employee_id,
            generation_id=gen_id,
            agrees_with_algorithm=rec["agrees"],
            recommended_stream_name=rec.get("recommended_stream"),
            confidence=rec["confidence"],
            reasoning=rec["reasoning"],
            generated_by_email=current_user.email,
        )
        db.add(row)
        rows.append(row)

    db.commit()
    for row in rows:
        db.refresh(row)

    return rows


@router.get("/{batch_name}/ai-recommendations", response_model=list[AllocationAIRecommendationResponse])
def get_ai_recommendations(
    batch_name: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(AllocationAIRecommendation)
        .filter_by(batch_name=batch_name)
        .order_by(AllocationAIRecommendation.employee_id)
        .all()
    )
