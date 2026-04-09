from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.errors import standard_error_responses
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.file import StoredFileListResponse, StoredFileResponse, StoredFileUploadResponse
from app.services.file_storage import (
    delete_file_record,
    get_file_record,
    list_file_records,
    store_file_record,
    validate_file_payload,
)


router = APIRouter(prefix="/api/files", tags=["files"])


def _map_file_error(exc: Exception) -> HTTPException:
    if isinstance(exc, FileNotFoundError):
        return HTTPException(status_code=404, detail=str(exc) or "File not found")
    return HTTPException(status_code=400, detail=str(exc) or "Invalid file request")


@router.get(
    "",
    response_model=StoredFileListResponse,
    summary="List my uploaded files",
    description="Returns the authenticated user's stored files with preview and deletion URLs.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def list_my_files(current_user: User = Depends(get_current_user)):
    return {"files": list_file_records(current_user.id)}


@router.post(
    "",
    response_model=StoredFileUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload files",
    description=(
        "Uploads one or more files for the authenticated user. "
        "Supported types are images (PNG/JPG/GIF/WEBP) and documents (PDF/TXT/MD)."
    ),
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
async def upload_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    uploaded: list[dict] = []
    try:
        prepared_files: list[tuple[str, str | None, bytes]] = []
        for file in files:
            content = await file.read()
            validate_file_payload(file.filename or "", file.content_type, content)
            prepared_files.append((file.filename or "", file.content_type, content))

        for filename, content_type, content in prepared_files:
            uploaded.append(
                store_file_record(
                    current_user.id,
                    filename=filename,
                    content_type=content_type,
                    data=content,
                )
            )
    except (ValueError, FileNotFoundError) as exc:
        raise _map_file_error(exc)

    return {"detail": "Files uploaded", "files": uploaded}


@router.get(
    "/{file_id}",
    response_model=StoredFileResponse,
    summary="Get file metadata",
    description="Returns file metadata for the authenticated user.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_file_metadata(file_id: str, current_user: User = Depends(get_current_user)):
    try:
        record, _ = get_file_record(current_user.id, file_id)
    except (ValueError, FileNotFoundError) as exc:
        raise _map_file_error(exc)

    return {
        "id": record["id"],
        "original_name": record["original_name"],
        "content_type": record["content_type"],
        "size_bytes": record["size_bytes"],
        "category": record["category"],
        "preview_kind": record["preview_kind"],
        "created_at": record["created_at"],
        "preview_url": f"/api/files/{record['id']}/content",
        "download_url": f"/api/files/{record['id']}/content?download=1",
        "delete_url": f"/api/files/{record['id']}",
    }


@router.get(
    "/{file_id}/content",
    summary="Preview or download a stored file",
    description="Streams the stored file back to its owner using authenticated access control.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def get_file_content(
    file_id: str,
    download: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
):
    try:
        record, disk_path = get_file_record(current_user.id, file_id)
    except (ValueError, FileNotFoundError) as exc:
        raise _map_file_error(exc)

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=disk_path,
        media_type=record["content_type"],
        filename=record["original_name"],
        content_disposition_type=disposition,
        headers={"Cache-Control": "private, max-age=60"},
    )


@router.delete(
    "/{file_id}",
    response_model=MessageResponse,
    summary="Delete a stored file",
    description="Deletes the stored file and its private metadata for the authenticated user.",
    responses=standard_error_responses(
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def delete_file(file_id: str, current_user: User = Depends(get_current_user)):
    try:
        delete_file_record(current_user.id, file_id)
    except (ValueError, FileNotFoundError) as exc:
        raise _map_file_error(exc)
    return {"detail": "File deleted"}
