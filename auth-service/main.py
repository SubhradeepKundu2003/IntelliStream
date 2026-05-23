from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from auth.routes import router as auth_router
from auth.utils import hash_password
from config import settings
from database import Base, SessionLocal, engine
from models import Role, User
from notifications.routes import router as notifications_router
from sync.routes import router as sync_router
from sync.service import run_sync
from streams.routes import router as streams_router
from stream_templates.routes import router as stream_templates_router
from trainees.routes import trainee_router
from batch_management.routes import router as batch_mgmt_router
from business_requirements.routes import router as br_router
from ai_suggestions.routes import router as ai_suggestions_router
from allocation.routes import router as allocation_router
from scores_upload.routes import router as scores_upload_router
from dashboard.routes import router as dashboard_router
import scores_upload.models  # noqa: F401 — ensures table is registered with Base


def _run_migrations() -> None:
    inspector = inspect(engine)
    if "batch_streams" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("batch_streams")}
        if "priority" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE batch_streams ADD COLUMN priority INTEGER NOT NULL DEFAULT 0"))
            print("[migration] Added 'priority' column to batch_streams")
        if "trainee_pct" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE batch_streams ADD COLUMN trainee_pct FLOAT NOT NULL DEFAULT 0"))
            print("[migration] Added 'trainee_pct' column to batch_streams")

    if "business_requirements" in inspector.get_table_names():
        br_cols = {c["name"] for c in inspector.get_columns("business_requirements")}
        if "location" not in br_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE business_requirements ADD COLUMN location VARCHAR"))
            print("[migration] Added 'location' column to business_requirements")

    if "synced_dpi_records" in inspector.get_table_names():
        dpi_cols = {c["name"] for c in inspector.get_columns("synced_dpi_records")}
        if "sub_batch" not in dpi_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE synced_dpi_records ADD COLUMN sub_batch VARCHAR"))
            print("[migration] Added 'sub_batch' column to synced_dpi_records")

    if "allocation_configs" in inspector.get_table_names():
        ac_cols = {c["name"] for c in inspector.get_columns("allocation_configs")}
        if "is_frozen" not in ac_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE allocation_configs ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE allocation_configs ADD COLUMN frozen_at TIMESTAMP WITH TIME ZONE"))
                conn.execute(text("ALTER TABLE allocation_configs ADD COLUMN frozen_by_email VARCHAR"))
            print("[migration] Added freeze columns to allocation_configs")

    if "trainee_allocations" in inspector.get_table_names():
        ta_cols = {c["name"] for c in inspector.get_columns("trainee_allocations")}
        if "is_frozen" not in ta_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trainee_allocations ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE trainee_allocations ADD COLUMN frozen_at TIMESTAMP WITH TIME ZONE"))
                conn.execute(text("ALTER TABLE trainee_allocations ADD COLUMN frozen_by_email VARCHAR"))
            print("[migration] Added freeze columns to trainee_allocations")

    # excel_batch_registry is created automatically by SQLAlchemy via Base.metadata.create_all
    # sme_associate_requests is created automatically by SQLAlchemy via Base.metadata.create_all

    # Add new notification enum values for PostgreSQL (SQLite stores as VARCHAR, no action needed)
    try:
        with engine.begin() as conn:
            for val in ("sme_request_submitted", "sme_request_reviewed"):
                try:
                    conn.execute(text(f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{val}'"))
                except Exception:
                    pass  # Not PostgreSQL or value already exists
    except Exception:
        pass


def _seed_admin(db: Session) -> None:
    exists = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    if not exists:
        admin = User(
            email=settings.DEFAULT_ADMIN_EMAIL,
            hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            role=Role.admin,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[seed] Default admin created: {settings.DEFAULT_ADMIN_EMAIL}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    db = SessionLocal()
    try:
        _seed_admin(db)
    finally:
        db.close()

    try:
        await run_sync()
    except Exception as exc:
        print(f"[sync] Initial sync skipped (SpringBoot unavailable): {exc}")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_sync, "cron", hour=0, minute=0, id="daily_springboot_sync")
    scheduler.start()

    yield

    scheduler.shutdown()


app = FastAPI(
    title="IntelliStream Auth Service",
    version="1.0.0",
    description="JWT-based authentication with role-based access control",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(notifications_router)
app.include_router(sync_router)
app.include_router(streams_router)
app.include_router(stream_templates_router)
app.include_router(trainee_router)
app.include_router(batch_mgmt_router)
app.include_router(br_router)
app.include_router(ai_suggestions_router)
app.include_router(allocation_router)
app.include_router(scores_upload_router)
app.include_router(dashboard_router)


@app.get("/health")
def health():
    return {"status": "ok"}
