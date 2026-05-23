from sqlalchemy import Column, Integer, String
from database import Base


class TraineeStreamReference(Base):
    __tablename__ = "trainee_stream_references"
    trainee_id = Column(String, primary_key=True)
    batch_name = Column(String, nullable=False)
    stream_name = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class ExcelBatchRegistry(Base):
    __tablename__ = "excel_batch_registry"
    batch_name = Column(String, primary_key=True)
    uploaded_at = Column(String, nullable=False)
    trainee_count = Column(Integer, nullable=False, default=0)
