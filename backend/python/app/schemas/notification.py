from pydantic import BaseModel, Field
from datetime import datetime

class NotificationCreatePayload(BaseModel):
    type: str = Field(..., min_length=1, max_length=64)
    title: str = Field(default="Notification", min_length=1, max_length=120)
    message: str = Field(default="", max_length=1000)

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    read: bool
    created_at: datetime

class NotificationsListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
    total_count: int