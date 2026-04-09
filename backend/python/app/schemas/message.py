from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MessageCreate(BaseModel):
    conversation_id: int | None = Field(
        default=None,
        description="Existing target conversation",
        examples=[3],
    )
    recipient_id: int | None = Field(
        default=None,
        description="Recipient used to create or reuse a direct conversation",
        examples=[7],
    )
    content: str | None = Field(
        default="",
        max_length=1000,
        description="Message content",
        examples=["Hey, up for a match?"],
    )
    image_url: str | None = Field(
        default=None,
        max_length=512,
        description="Optional uploaded image URL",
        examples=["uploaded_messages/message_7_123456.png"],
    )

    @model_validator(mode="after")
    def validate_target(self):
        if self.conversation_id is None and self.recipient_id is None:
            raise ValueError("Either conversation_id or recipient_id must be provided")
        if self.conversation_id is not None and self.recipient_id is not None:
            raise ValueError("Provide only one target: conversation_id or recipient_id")
        self.content = str(self.content or "").strip()
        self.image_url = str(self.image_url or "").strip() or None
        if not self.content and not self.image_url:
            raise ValueError("Provide message content or an image")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"recipient_id": 7, "content": "Hey, up for a match?", "image_url": None}
        }
    )


class MessageResponse(BaseModel):
    id: int = Field(..., description="Message identifier", examples=[12])
    conversation_id: int = Field(..., description="Message conversation", examples=[3])
    sender_id: int = Field(..., description="Message sender", examples=[1])
    content: str = Field(..., description="Message content", examples=["Hello"])
    image_url: str | None = Field(default=None, description="Optional message image URL")
    created_at: datetime = Field(..., description="UTC creation time")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 12,
                "conversation_id": 3,
                "sender_id": 1,
                "content": "Hello",
                "image_url": "uploaded_messages/message_1_123456.png",
                "created_at": "2026-03-08T15:00:00Z",
            }
        },
    )


class MessageDetailResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str | None = None
    sender_avatar: str | None = None
    content: str
    image_url: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ParticipantResponse(BaseModel):
    id: int
    username: str
    avatar: str | None = None
    is_online: bool | None = None
    last_seen: datetime | None = None


class ConversationSummaryResponse(BaseModel):
    id: int
    type: str
    name: str | None = None
    participants: list[ParticipantResponse] = []
    participants_count: int = 0
    last_message: MessageDetailResponse | None = None
    updated_at: datetime
    unread_count: int = 0


class ConversationsListResponse(BaseModel):
    conversations: list[ConversationSummaryResponse]


class MessagesListResponse(BaseModel):
    messages: list[MessageDetailResponse]


class ConversationReadStateResponse(BaseModel):
    conversation_id: int
    unread_count: int = 0
    last_read_message_id: int | None = None


class UnreadMessagesCountResponse(BaseModel):
    unread_count: int = 0


class MessageImageUploadResponse(BaseModel):
    image_url: str
    detail: str = "Image uploaded"
