import enum
from sqlalchemy import Boolean, Column, Enum, Integer, String
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
