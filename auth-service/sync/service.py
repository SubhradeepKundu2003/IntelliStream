import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from .models import SyncedBatch, SyncedDpiRecord, SyncedSubjectScore, SyncStatus

logger = logging.getLogger(__name__)

_BASE = settings.SPRINGBOOT_BASE_URL


async def _fetch(client: httpx.AsyncClient, path: str) -> list:
    resp = await client.get(f"{_BASE}{path}", timeout=30.0)
    resp.raise_for_status()
    return resp.json()


async def run_sync() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    db: Session = SessionLocal()
    try:
        async with httpx.AsyncClient() as client:
            batches_raw = await _fetch(client, "/api/subjects")
            dpi_raw = await _fetch(client, "/api/dpi")
            scores_raw = await _fetch(client, "/api/scores")

        db.query(SyncedBatch).delete()
        for b in batches_raw:
            db.add(SyncedBatch(
                batch_name=b["batchName"],
                subjects_json=json.dumps(b.get("subjects") or []),
                synced_at=now,
            ))

        db.query(SyncedDpiRecord).delete()
        for d in dpi_raw:
            db.add(SyncedDpiRecord(
                trainee_id=d["traineeId"],
                trainee_name=d["traineeName"],
                dpi=d["dpi"],
                synced_at=now,
            ))

        db.query(SyncedSubjectScore).delete()
        for s in scores_raw:
            db.add(SyncedSubjectScore(
                external_id=str(s["id"]),
                trainee_id=s["traineeId"],
                trainee_name=s["traineeName"],
                subject_name=s["subjectName"],
                subject_id=s.get("subjectId"),
                exam_name=s.get("examName"),
                score=s["score"],
                synced_at=now,
            ))

        total = len(batches_raw) + len(dpi_raw) + len(scores_raw)
        status_row = db.query(SyncStatus).filter(SyncStatus.source == "springboot").first()
        if status_row:
            status_row.last_sync_at = now
            status_row.last_sync_status = "success"
            status_row.records_synced = total
        else:
            db.add(SyncStatus(
                source="springboot",
                last_sync_at=now,
                last_sync_status="success",
                records_synced=total,
            ))

        db.commit()
        logger.info("[sync] OK — batches=%d dpi=%d scores=%d", len(batches_raw), len(dpi_raw), len(scores_raw))
        return {
            "batches_synced": len(batches_raw),
            "dpi_records_synced": len(dpi_raw),
            "scores_synced": len(scores_raw),
            "synced_at": now,
        }

    except Exception as exc:
        db.rollback()
        logger.error("[sync] FAILED: %s", exc)
        try:
            status_row = db.query(SyncStatus).filter(SyncStatus.source == "springboot").first()
            if status_row:
                status_row.last_sync_at = now
                status_row.last_sync_status = f"failed: {exc}"
            else:
                db.add(SyncStatus(
                    source="springboot",
                    last_sync_at=now,
                    last_sync_status=f"failed: {exc}",
                    records_synced=0,
                ))
            db.commit()
        except Exception:
            db.rollback()
        raise
    finally:
        db.close()
