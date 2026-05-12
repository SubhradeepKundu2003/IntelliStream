import enum
from sqlalchemy import Boolean, Column, Enum, Float, ForeignKey, Integer, String
from database import Base


class Role(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    sme = "sme"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.sme, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


# ---------------------------------------------------------------------------
# Domain enums
# ---------------------------------------------------------------------------

class Subject(str, enum.Enum):
    java          = "java"
    python        = "python"
    sql           = "sql"
    cybersecurity = "cybersecurity"
    agile         = "agile"
    aiml          = "aiml"
    webtech       = "webtech"
    cloud         = "cloud"


class BatchStatus(str, enum.Enum):
    setup      = "setup"
    training   = "training"
    assessment = "assessment"
    allocation = "allocation"
    completed  = "completed"


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------

class Stream(Base):
    __tablename__ = "streams"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, unique=True, nullable=False)
    description  = Column(String, nullable=True)
    is_mandatory = Column(Boolean, default=False)
    intake_pct   = Column(Float, nullable=False)
    is_active    = Column(Boolean, default=True)


class StreamSubject(Base):
    __tablename__ = "stream_subjects"

    id           = Column(Integer, primary_key=True, index=True)
    stream_id    = Column(Integer, ForeignKey("streams.id"), nullable=False)
    subject_name = Column(String, nullable=False)
    weight_pct   = Column(Float, nullable=False)


class Batch(Base):
    __tablename__ = "batches"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, nullable=False)
    year           = Column(Integer, nullable=False)
    quarter        = Column(Integer, nullable=False)
    total_trainees = Column(Integer, default=0)
    status         = Column(Enum(BatchStatus), default=BatchStatus.setup)
    is_active      = Column(Boolean, default=True)


class Trainee(Base):
    __tablename__ = "trainees"

    id          = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, nullable=False)
    name        = Column(String, nullable=False)
    email       = Column(String, nullable=True)
    batch_id    = Column(Integer, ForeignKey("batches.id"), nullable=False)
    is_active   = Column(Boolean, default=True)


class AllocationRecord(Base):
    __tablename__ = "allocation_records"

    id                 = Column(Integer, primary_key=True, index=True)
    trainee_id         = Column(Integer, ForeignKey("trainees.id"), nullable=False)
    batch_id           = Column(Integer, ForeignKey("batches.id"), nullable=False)
    stream_id          = Column(Integer, ForeignKey("streams.id"), nullable=True)
    dpi_score          = Column(Float, nullable=True)
    avg_score          = Column(Float, nullable=True)
    composite_score    = Column(Float, nullable=True)
    is_manual_override = Column(Boolean, default=False)
    override_reason    = Column(String, nullable=True)
    is_active          = Column(Boolean, default=True)
