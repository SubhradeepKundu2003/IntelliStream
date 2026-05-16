from sqlalchemy.orm import Session

from .models import Notification, NotificationType


def create_notification(
    db: Session,
    recipient_email: str,
    type: NotificationType,
    title: str,
    message: str,
) -> None:
    db.add(Notification(
        recipient_email=recipient_email,
        type=type,
        title=title,
        message=message,
    ))
