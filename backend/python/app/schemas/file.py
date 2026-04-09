from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StoredFileResponse(BaseModel):
    id: str = Field(..., description="Stable file identifier", examples=["4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11"])
    original_name: str = Field(..., description="Original filename", examples=["match-notes.pdf"])
    content_type: str = Field(..., description="Validated MIME type", examples=["application/pdf"])
    size_bytes: int = Field(..., description="Stored file size in bytes", examples=[24576])
    category: Literal["image", "document"] = Field(..., description="High-level file category")
    preview_kind: Literal["image", "pdf", "text", "generic"] = Field(
        ...,
        description="Preferred preview strategy for the client",
    )
    created_at: datetime = Field(..., description="UTC upload timestamp")
    preview_url: str = Field(..., description="Authenticated inline preview URL")
    download_url: str = Field(..., description="Authenticated download URL")
    delete_url: str = Field(..., description="Delete endpoint URL")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11",
                "original_name": "match-notes.pdf",
                "content_type": "application/pdf",
                "size_bytes": 24576,
                "category": "document",
                "preview_kind": "pdf",
                "created_at": "2026-03-31T10:30:00Z",
                "preview_url": "/api/files/4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11/content",
                "download_url": "/api/files/4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11/content?download=1",
                "delete_url": "/api/files/4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11",
            }
        }
    )


class StoredFileListResponse(BaseModel):
    files: list[StoredFileResponse] = Field(default_factory=list)


class StoredFileUploadResponse(BaseModel):
    files: list[StoredFileResponse] = Field(default_factory=list)
    detail: str = Field(default="Files uploaded")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "detail": "Files uploaded",
                "files": [
                    {
                        "id": "4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11",
                        "original_name": "match-notes.pdf",
                        "content_type": "application/pdf",
                        "size_bytes": 24576,
                        "category": "document",
                        "preview_kind": "pdf",
                        "created_at": "2026-03-31T10:30:00Z",
                        "preview_url": "/api/files/4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11/content",
                        "download_url": "/api/files/4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11/content?download=1",
                        "delete_url": "/api/files/4d9e0c3f7f3a4b6f8a2b5c1d9e7f0a11",
                    }
                ],
            }
        }
    )
