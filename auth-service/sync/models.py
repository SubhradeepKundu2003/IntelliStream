from sqlalchemy import Column, Float, Integer, String
from database import Base


class SyncedBatch(Base):
    __tablename__ = "synced_batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, unique=True, nullable=False, index=True)
    subjects_json = Column(String, nullable=False, default="[]")
    trainee_count = Column(Integer, nullable=False, default=0)
    synced_at = Column(String, nullable=False)


class SyncedDpiRecord(Base):
    __tablename__ = "synced_dpi_records"
    id = Column(Integer, primary_key=True, index=True)
    trainee_id = Column(String, unique=True, nullable=False, index=True)
    batch_name = Column(String, nullable=False, index=True)
    trainee_name = Column(String, nullable=False)
    dpi = Column(Float, nullable=False)
    location = Column(String, nullable=True)
    sub_batch = Column(String, nullable=True)
    synced_at = Column(String, nullable=False)


class SyncedSubjectScore(Base):
    __tablename__ = "synced_subject_scores"
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, nullable=False, index=True)
    batch_name = Column(String, nullable=False, index=True)
    trainee_id = Column(String, nullable=False, index=True)
    trainee_name = Column(String, nullable=False)
    subject_name = Column(String, nullable=False)
    subject_id = Column(String, nullable=True)
    exam_name = Column(String, nullable=True)
    score = Column(Float, nullable=False)
    synced_at = Column(String, nullable=False)


class SyncStatus(Base):
    __tablename__ = "sync_status"
    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, unique=True, nullable=False)
    last_sync_at = Column(String, nullable=True)
    last_sync_status = Column(String, nullable=True)
    records_synced = Column(Integer, nullable=True)
