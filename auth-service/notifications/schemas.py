from datetime import datetime

from pydantic import BaseModel

from .models import NotificationType


class NotificationResponse(BaseModel):
    id:              int
    recipient_email: str
    type:            NotificationType
    title:           str
    message:         str
    is_read:         bool
    created_at:      datetime

    model_config = {"from_attributes": True}
