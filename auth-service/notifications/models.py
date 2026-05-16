import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy import Enum as SAEnum

from database import Base


class NotificationType(str, enum.Enum):
    proposal_submitted = "proposal_submitted"
    proposal_approved  = "proposal_approved"
    proposal_rejected  = "proposal_rejected"
    sme_assigned       = "sme_assigned"
    sme_removed        = "sme_removed"
    stream_deleted     = "stream_deleted"


class Notification(Base):
    __tablename__ = "notifications"

    id              = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String, index=True, nullable=False)
    type            = Column(SAEnum(NotificationType), nullable=False)
    title           = Column(String, nullable=False)
    message         = Column(String, nullable=False)
    is_read         = Column(Boolean, default=False, nullable=False)
    created_at      = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
