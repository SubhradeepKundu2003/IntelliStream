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


@app.get("/health")
def health():
    return {"status": "ok"}
