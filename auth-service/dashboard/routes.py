from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from database import get_db
from allocation.models import AllocationConfig, RequestStatus, SMEAssociateRequest, TraineeAllocation
from streams.models import BatchStream
from sync.models import SyncedBatch, SyncStatus

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    batch_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    # ── Synced batches (optionally filtered) ───────────────────────────
    batch_q = db.query(SyncedBatch)
    if batch_name:
        batch_q = batch_q.filter(SyncedBatch.batch_name == batch_name)
    synced_batches = batch_q.all()
    total_trainees = sum(b.trainee_count for b in synced_batches)
    active_batches = len(db.query(SyncedBatch).all())  # always global for context

    # ── Allocation records (filtered when batch selected) ───────────────
    alloc_q = db.query(TraineeAllocation)
    if batch_name:
        alloc_q = alloc_q.filter(TraineeAllocation.batch_name == batch_name)
    all_allocations = alloc_q.all()

    total_alloc = len(all_allocations)
    allocated = sum(
        1 for a in all_allocations
        if a.suggested_stream_id is not None or a.manual_stream_id is not None
    )
    frozen = sum(1 for a in all_allocations if a.is_frozen)
    override_count = sum(1 for a in all_allocations if a.manual_stream_id is not None)
    allocation_rate = (allocated / total_alloc) if total_alloc > 0 else 0.0
    freeze_rate = (frozen / total_alloc) if total_alloc > 0 else 0.0

    # ── Score averages (batch-level insight) ───────────────────────────
    scores_with_data = [a for a in all_allocations if a.composite_score is not None]
    avg_composite = (
        sum(a.composite_score for a in scores_with_data) / len(scores_with_data)
        if scores_with_data else None
    )
    dpi_with_data = [a for a in all_allocations if a.dpi_score is not None]
    avg_dpi = (
        sum(a.dpi_score for a in dpi_with_data) / len(dpi_with_data)
        if dpi_with_data else None
    )

    # ── Pending SME requests (filtered) ────────────────────────────────
    sme_q = db.query(SMEAssociateRequest).filter(
        SMEAssociateRequest.status == RequestStatus.pending
    )
    if batch_name:
        sme_q = sme_q.filter(SMEAssociateRequest.batch_name == batch_name)
    pending_sme = sme_q.count()

    # ── Stream name cache ───────────────────────────────────────────────
    _stream_cache: dict[int, str] = {}

    def get_stream_name(stream_id: int) -> str:
        if stream_id not in _stream_cache:
            s = db.query(BatchStream).filter_by(id=stream_id).first()
            _stream_cache[stream_id] = s.name if s else f"Stream {stream_id}"
        return _stream_cache[stream_id]

    # ── Stream distribution ─────────────────────────────────────────────
    stream_counts: dict[str, int] = defaultdict(int)
    for alloc in all_allocations:
        eff_id = alloc.manual_stream_id if alloc.manual_stream_id else alloc.suggested_stream_id
        if eff_id:
            stream_counts[get_stream_name(eff_id)] += 1

    stream_distribution = [
        {"stream_name": name, "count": count}
        for name, count in sorted(stream_counts.items(), key=lambda x: -x[1])
    ]

    # ── Avg composite score per stream (for batch view) ─────────────────
    stream_score_map: dict[str, list[float]] = defaultdict(list)
    for alloc in all_allocations:
        if alloc.composite_score is None:
            continue
        eff_id = alloc.manual_stream_id if alloc.manual_stream_id else alloc.suggested_stream_id
        if eff_id:
            stream_score_map[get_stream_name(eff_id)].append(alloc.composite_score)

    score_by_stream = [
        {
            "stream_name": name,
            "avg_composite": round(sum(scores) / len(scores), 1),
            "count": len(scores),
        }
        for name, scores in sorted(stream_score_map.items())
    ]

    # ── Batch freeze status (global — for "All Batches" grouped bar) ────
    all_alloc_global = db.query(TraineeAllocation).all() if batch_name else all_allocations
    batch_groups: dict[str, dict] = defaultdict(lambda: {"frozen": 0, "unfrozen": 0})
    for alloc in all_alloc_global:
        key = "frozen" if alloc.is_frozen else "unfrozen"
        batch_groups[alloc.batch_name][key] += 1

    batch_freeze_status = [
        {
            "batch_name": b,
            "frozen": counts["frozen"],
            "unfrozen": counts["unfrozen"],
            "total": counts["frozen"] + counts["unfrozen"],
        }
        for b, counts in sorted(batch_groups.items())
    ]

    # ── Sync status (always global) ─────────────────────────────────────
    sync_rec = db.query(SyncStatus).first()
    sync_status = None
    if sync_rec:
        sync_status = {
            "last_sync_at": str(sync_rec.last_sync_at) if sync_rec.last_sync_at else None,
            "status": sync_rec.last_sync_status,
            "records_synced": sync_rec.records_synced,
        }

    # ── Allocation config for selected batch ────────────────────────────
    alloc_config = None
    if batch_name:
        cfg = db.query(AllocationConfig).filter_by(batch_name=batch_name).first()
        if cfg:
            alloc_config = {
                "score_weight": cfg.score_weight,
                "dpi_weight": cfg.dpi_weight,
                "last_run_at": str(cfg.last_run_at) if cfg.last_run_at else None,
                "run_by_email": cfg.run_by_email,
                "is_frozen": cfg.is_frozen,
                "frozen_at": str(cfg.frozen_at) if cfg.frozen_at else None,
                "frozen_by_email": cfg.frozen_by_email,
            }

    # ── Recent activity (filtered when batch selected) ──────────────────
    activity: list[dict] = []

    freeze_cfg_q = db.query(AllocationConfig).filter(AllocationConfig.frozen_at.isnot(None))
    if batch_name:
        freeze_cfg_q = freeze_cfg_q.filter(AllocationConfig.batch_name == batch_name)
    for cfg in freeze_cfg_q.order_by(AllocationConfig.frozen_at.desc()).limit(5).all():
        activity.append({
            "type": "freeze",
            "message": f"Batch {cfg.batch_name} allocations frozen",
            "timestamp": str(cfg.frozen_at),
            "actor": cfg.frozen_by_email,
        })

    override_q = db.query(TraineeAllocation).filter(TraineeAllocation.overridden_at.isnot(None))
    if batch_name:
        override_q = override_q.filter(TraineeAllocation.batch_name == batch_name)
    for ov in override_q.order_by(TraineeAllocation.overridden_at.desc()).limit(5).all():
        sname = get_stream_name(ov.manual_stream_id) if ov.manual_stream_id else "Unknown"
        activity.append({
            "type": "override",
            "message": f"{ov.trainee_name} → {sname}",
            "timestamp": str(ov.overridden_at),
            "actor": ov.overridden_by_email,
        })

    if sync_status and sync_status["last_sync_at"]:
        activity.append({
            "type": "sync",
            "message": f"Data synced ({sync_status['records_synced'] or 0} records)",
            "timestamp": sync_status["last_sync_at"],
            "actor": None,
        })

    activity.sort(key=lambda x: x["timestamp"] or "", reverse=True)

    return {
        "batch_name": batch_name,
        "total_trainees": total_trainees,
        "active_batches": active_batches,
        "allocation_rate": round(allocation_rate, 4),
        "freeze_rate": round(freeze_rate, 4),
        "pending_sme_requests": pending_sme,
        "total_allocations": total_alloc,
        "frozen_allocations": frozen,
        "override_count": override_count,
        "avg_composite_score": round(avg_composite, 1) if avg_composite is not None else None,
        "avg_dpi_score": round(avg_dpi, 2) if avg_dpi is not None else None,
        "stream_distribution": stream_distribution,
        "score_by_stream": score_by_stream,
        "batch_freeze_status": batch_freeze_status,
        "alloc_config": alloc_config,
        "sync_status": sync_status,
        "recent_activity": activity[:8],
    }
