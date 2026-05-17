from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from database import Base


class BusinessRequirement(Base):
    __tablename__ = "business_requirements"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    location = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)


class BRStream(Base):
    __tablename__ = "br_streams"

    id = Column(Integer, primary_key=True, index=True)
    br_id = Column(Integer, ForeignKey("business_requirements.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    is_mandatory = Column(Boolean, default=False)
    capacity_type = Column(String, nullable=False)   # 'percentage' | 'count'
    capacity_value = Column(Float, nullable=False)
    roles_needed = Column(String, default="[]")      # JSON array of strings
    subjects_needed = Column(String, default="[]")   # JSON array of strings
    is_active = Column(Boolean, default=True)
