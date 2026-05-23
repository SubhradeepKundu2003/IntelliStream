import json
import logging
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from config import settings
from streams.models import BatchStream, StreamSubjectWeight
from sync.models import SyncedDpiRecord, SyncedSubjectScore

from .models import AllocationConfig, TraineeAllocation

logger = logging.getLogger(__name__)


def get_or_create_config(batch_name: str, db: Session) -> AllocationConfig:
    cfg = db.query(AllocationConfig).filter_by(batch_name=batch_name).first()
    if not cfg:
        cfg = AllocationConfig(
            batch_name=batch_name,
            score_weight=settings.SCORE_WEIGHT,
            dpi_weight=settings.DPI_WEIGHT,
        )
        db.add(cfg)
        db.flush()
    return cfg


def _avg_subject_scores(batch_name: str, db: Session) -> dict[str, dict[str, float]]:
    """Average subject scores per trainee across all exams."""
    acc: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for s in db.query(SyncedSubjectScore).filter_by(batch_name=batch_name).all():
        acc[s.trainee_id][s.subject_name.lower()].append(s.score)
    return {
        tid: {subj: sum(vals) / len(vals) for subj, vals in subjs.items()}
        for tid, subjs in acc.items()
    }


def _compute_stream_score(
    subj_scores: dict[str, float],
    dpi_norm: float,
    weights: list,
    score_weight: float,
    dpi_weight: float,
) -> tuple[float, float]:
    """Return (composite 0–100, weighted_subject_score 0–100)."""
    if weights:
        total_w = sum(w.weight_pct for w in weights)
        weighted_subj = (
            sum(subj_scores.get(w.subject_name.lower(), 0.0) * (w.weight_pct / total_w) for w in weights)
            if total_w > 0 else 0.0
        )
    else:
        weighted_subj = 0.0

    composite = (weighted_subj / 100.0) * score_weight + dpi_norm * dpi_weight
    return round(composite * 100, 2), round(weighted_subj, 2)


def run_allocation(batch_name: str, triggered_by: str, db: Session, mode: str = "priority") -> dict:
    cfg = get_or_create_config(batch_name, db)

    # ── 1. Preserve existing manual overrides ──────────────────────────
    existing_manual: dict[str, dict] = {}
    for alloc in db.query(TraineeAllocation).filter_by(batch_name=batch_name).all():
        if alloc.manual_stream_id is not None:
            existing_manual[alloc.employee_id] = {
                "stream_id": alloc.manual_stream_id,
                "reason": alloc.manual_override_reason,
                "by": alloc.overridden_by_email,
                "at": alloc.overridden_at,
            }

    db.query(TraineeAllocation).filter_by(batch_name=batch_name).delete()

    # ── 2. Load data ────────────────────────────────────────────────────
    dpi_records = db.query(SyncedDpiRecord).filter_by(batch_name=batch_name).all()
    dpi_map: dict[str, float] = {r.trainee_id: r.dpi for r in dpi_records}
    trainee_names: dict[str, str] = {r.trainee_id: r.trainee_name for r in dpi_records}
    avg_scores = _avg_subject_scores(batch_name, db)

    streams = (
        db.query(BatchStream)
        .filter_by(batch_name=batch_name, is_active=True)
        .order_by(BatchStream.priority)
        .all()
    )
    stream_weights: dict[int, list] = {
        s.id: db.query(StreamSubjectWeight).filter_by(stream_id=s.id).all()
        for s in streams
    }

    all_tids = set(dpi_map.keys()) | set(avg_scores.keys())

    # ── 3. Score every trainee × every stream ──────────────────────────
    trainee_data: dict[str, dict] = {}
    for tid in all_tids:
        dpi = dpi_map.get(tid, 0.0)
        dpi_norm = min(dpi, 5.0) / 5.0
        subj_scores = avg_scores.get(tid, {})

        stream_scores: dict[int, dict] = {}
        for stream in streams:
            composite, subject_score = _compute_stream_score(
                subj_scores, dpi_norm, stream_weights.get(stream.id, []),
                cfg.score_weight, cfg.dpi_weight,
            )
            stream_scores[stream.id] = {"composite": composite, "subject_score": subject_score}

        trainee_data[tid] = {
            "trainee_name": trainee_names.get(tid, tid),
            "dpi": dpi,
            "subject_scores": subj_scores,
            "stream_scores": stream_scores,
        }

    # ── 4. Allocation ─────────────────────────────────────────────────────
    total = len(trainee_data)
    suggestions: dict[str, int] = {}  # employee_id → stream_id
    unallocated_pool = set(trainee_data.keys())

    if mode == "fit_score":
        # Assign each trainee to the stream where they score highest
        for tid, data in trainee_data.items():
            if not data["stream_scores"]:
                continue
            best_sid = max(data["stream_scores"].keys(), key=lambda sid: data["stream_scores"][sid]["composite"])
            suggestions[tid] = best_sid
        unallocated_pool = set(trainee_data.keys()) - set(suggestions.keys())
    else:
        # Greedy fill by stream priority (default)
        for stream in streams:
            cap = max(1, round(stream.trainee_pct / 100 * total)) if stream.trainee_pct > 0 else 0
            if cap == 0:
                continue

            candidates = sorted(
                [(tid, trainee_data[tid]["stream_scores"].get(stream.id, {}).get("composite", 0.0))
                 for tid in unallocated_pool],
                key=lambda x: x[1],
                reverse=True,
            )
            for tid, _ in candidates[:cap]:
                suggestions[tid] = stream.id
                unallocated_pool.discard(tid)

    # ── 5. Write allocations ────────────────────────────────────────────
    for tid, data in trainee_data.items():
        suggested_sid = suggestions.get(tid)
        manual_info = existing_manual.get(tid)

        composite = subject_score = None
        if suggested_sid and suggested_sid in data["stream_scores"]:
            composite = data["stream_scores"][suggested_sid]["composite"]
            subject_score = data["stream_scores"][suggested_sid]["subject_score"]

        alloc = TraineeAllocation(
            batch_name=batch_name,
            employee_id=tid,
            trainee_name=data["trainee_name"],
            dpi_score=data["dpi"],
            subject_score=subject_score,
            composite_score=composite,
            suggested_stream_id=suggested_sid,
            manual_stream_id=manual_info["stream_id"] if manual_info else None,
            manual_override_reason=manual_info["reason"] if manual_info else None,
            overridden_by_email=manual_info["by"] if manual_info else None,
            overridden_at=manual_info["at"] if manual_info else None,
            score_breakdown_json=json.dumps(data["subject_scores"]),
            all_stream_scores_json=json.dumps(
                {str(k): v for k, v in data["stream_scores"].items()}
            ),
        )
        db.add(alloc)

    cfg.last_run_at = datetime.now(timezone.utc)
    cfg.run_by_email = triggered_by
    db.commit()

    logger.info("[allocation] %s — mode=%s total=%d allocated=%d", batch_name, mode, total, len(suggestions))
    return {
        "batch_name": batch_name,
        "total": total,
        "allocated": len(suggestions),
        "unallocated": len(unallocated_pool),
        "run_by_email": triggered_by,
        "run_at": cfg.last_run_at,
        "mode": mode,
    }
