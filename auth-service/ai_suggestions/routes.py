import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.dependencies import require_manager_or_above
from database import get_db
from models import User
from sync.models import SyncedBatch
from streams.models import BatchStream, StreamSubjectWeight
from business_requirements.models import BusinessRequirement, BRStream
from .models import StreamSuggestion, SuggestionStatus
from .schemas import GenerateSuggestionsRequest, StreamSuggestionResponse, SuggestedWeight
from .ollama_client import generate_stream_suggestions

router = APIRouter(prefix="/batches", tags=["ai-suggestions"])


def _suggestion_response(s: StreamSuggestion) -> StreamSuggestionResponse:
    weights = [SuggestedWeight(**w) for w in json.loads(s.weights_json)]
    return StreamSuggestionResponse(
        id=s.id,
        batch_name=s.batch_name,
        generation_id=s.generation_id,
        name=s.name,
        priority=s.priority,
        reasoning=s.reasoning,
        weights=weights,
        status=s.status,
        generated_by_email=s.generated_by_email,
        created_at=s.created_at,
        reviewed_by_email=s.reviewed_by_email,
        reviewed_at=s.reviewed_at,
    )


def _get_batch_or_404(batch_name: str, db: Session) -> SyncedBatch:
    batch = db.query(SyncedBatch).filter(SyncedBatch.batch_name == batch_name).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch '{batch_name}' not found")
    return batch


@router.post(
    "/{batch_name}/ai-suggestions/generate",
    response_model=list[StreamSuggestionResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_suggestions(
    batch_name: str,
    body: GenerateSuggestionsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_or_above),
):
    batch = _get_batch_or_404(batch_name, db)
    subjects = json.loads(batch.subjects_json)

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

    existing_streams = [
        s.name
        for s in db.query(BatchStream)
        .filter(BatchStream.batch_name == batch_name, BatchStream.is_active == True)
        .all()
    ]

    try:
        suggestions = await generate_stream_suggestions(
            batch_name=batch_name,
            subjects=subjects,
            business_requirements=br_data,
            existing_streams=existing_streams,
            extra_context=body.business_context,
        )
    except Exception as exc:
        detail = str(exc) or repr(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI suggestion failed — {detail}",
        )

    gen_id = str(uuid.uuid4())
    rows: list[StreamSuggestion] = []
    for s in suggestions:
        row = StreamSuggestion(
            batch_name=batch_name,
            generation_id=gen_id,
            name=s["name"],
            priority=s["priority"],
            reasoning=s["reasoning"],
            weights_json=json.dumps(s["weights"]),
            generated_by_email=user.email,
        )
        db.add(row)
        rows.append(row)

    db.commit()
    for row in rows:
        db.refresh(row)

    return [_suggestion_response(r) for r in rows]


@router.get("/{batch_name}/ai-suggestions", response_model=list[StreamSuggestionResponse])
def list_suggestions(
    batch_name: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_or_above),
):
    rows = (
        db.query(StreamSuggestion)
        .filter(StreamSuggestion.batch_name == batch_name)
        .order_by(StreamSuggestion.created_at.desc())
        .all()
    )
    return [_suggestion_response(r) for r in rows]


@router.post("/{batch_name}/ai-suggestions/{suggestion_id}/accept", response_model=StreamSuggestionResponse)
def accept_suggestion(
    batch_name: str,
    suggestion_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_or_above),
):
    suggestion = db.query(StreamSuggestion).filter(
        StreamSuggestion.id == suggestion_id,
        StreamSuggestion.batch_name == batch_name,
    ).first()
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    if suggestion.status != SuggestionStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Suggestion is already {suggestion.status.value}",
        )

    existing = db.query(BatchStream).filter(
        BatchStream.batch_name == batch_name,
        BatchStream.name == suggestion.name,
        BatchStream.is_active == True,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stream '{suggestion.name}' already exists in batch '{batch_name}'",
        )

    # Use suggested priority but fall back to 0 if it conflicts
    priority = suggestion.priority
    if priority != 0:
        conflict = db.query(BatchStream).filter(
            BatchStream.batch_name == batch_name,
            BatchStream.priority == priority,
            BatchStream.is_active == True,
        ).first()
        if conflict:
            priority = 0

    stream = BatchStream(batch_name=batch_name, name=suggestion.name, priority=priority)
    db.add(stream)
    db.flush()

    batch = db.query(SyncedBatch).filter(SyncedBatch.batch_name == batch_name).first()
    if batch:
        batch_subjects = set(json.loads(batch.subjects_json))
        for w in json.loads(suggestion.weights_json):
            if w["subject_name"] in batch_subjects:
                db.add(StreamSubjectWeight(
                    stream_id=stream.id,
                    subject_name=w["subject_name"],
                    weight_pct=w["weight_pct"],
                ))

    suggestion.status = SuggestionStatus.accepted
    suggestion.reviewed_by_email = user.email
    suggestion.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(suggestion)
    return _suggestion_response(suggestion)


@router.post("/{batch_name}/ai-suggestions/{suggestion_id}/ignore", response_model=StreamSuggestionResponse)
def ignore_suggestion(
    batch_name: str,
    suggestion_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_or_above),
):
    suggestion = db.query(StreamSuggestion).filter(
        StreamSuggestion.id == suggestion_id,
        StreamSuggestion.batch_name == batch_name,
    ).first()
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    if suggestion.status != SuggestionStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Suggestion is already {suggestion.status.value}",
        )

    suggestion.status = SuggestionStatus.ignored
    suggestion.reviewed_by_email = user.email
    suggestion.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(suggestion)
    return _suggestion_response(suggestion)
