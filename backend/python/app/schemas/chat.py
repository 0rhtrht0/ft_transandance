"""
Pydantic schemas for chat and notifications
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from uuid import UUID


# ============= Messages =============

class MessageCreate(BaseModel):
    """Create a new message"""
    conversation_id: str
    content: str = Field(..., min_length=1, max_length=1000)


class MessageResponse(BaseModel):
    """Message response"""
    id: UUID
    sender_id: UUID
    sender_name: Optional[str] = None
    content: str
    created_at: datetime
    is_read: bool
    
    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    """Create a direct conversation"""
    other_user_id: str


class ConversationResponse(BaseModel):
    """Conversation response"""
    id: UUID
    type: str  # 'direct', 'room', 'match'
    name: Optional[str] = None
    participants_count: int = 0
    last_message: Optional[MessageResponse] = None
    updated_at: datetime
    unread_count: int = 0
    
    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    """Detailed conversation with all messages"""
    id: UUID
    type: str
    name: Optional[str]
    messages: List[MessageResponse]
    participants: List[dict]  # [{id, username, is_online}]
    
    class Config:
        from_attributes = True


# ============= Notifications =============

class NotificationCreate(BaseModel):
    """Create notification (admin only)"""
    user_id: str
    type: str
    title: str
    message: Optional[str] = None
    actor_id: Optional[str] = None
    data: Optional[dict] = None


class NotificationResponse(BaseModel):
    """Notification response"""
    id: UUID
    type: str
    title: str
    message: Optional[str]
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    is_read: bool
    created_at: datetime
    data: Optional[dict] = None
    
    class Config:
        from_attributes = True


class NotificationsListResponse(BaseModel):
    """List of notifications"""
    notifications: List[NotificationResponse]
    unread_count: int
    total_count: int


# ============= WebSocket Events =============

class WSMessageEvent(BaseModel):
    """WebSocket message event"""
    type: str = "message"
    conversation_id: str
    sender_id: str
    sender_name: str
    content: str
    timestamp: datetime


class WSNotificationEvent(BaseModel):
    """WebSocket notification event"""
    type: str = "notification"
    notification: NotificationResponse


class WSUserStatusEvent(BaseModel):
    """WebSocket user status event"""
    type: str = "user_status"
    user_id: str
    user_name: str
    is_online: bool
    timestamp: datetime


class WSStateUpdate(BaseModel):
    """WebSocket game state update"""
    type: str = "state"
    match_id: str
    tick: int
    players: dict
    black_hole: dict
