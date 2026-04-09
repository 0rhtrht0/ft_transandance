from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import re
from uuid import uuid4


USER_UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "user_uploads"
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
TEXT_PREVIEW_LIMIT_BYTES = 32 * 1024

ALLOWED_FILE_TYPES: dict[str, dict[str, str | tuple[str, ...]]] = {
    ".png": {
        "content_type": "image/png",
        "category": "image",
        "preview_kind": "image",
    },
    ".jpg": {
        "content_type": "image/jpeg",
        "category": "image",
        "preview_kind": "image",
    },
    ".jpeg": {
        "content_type": "image/jpeg",
        "category": "image",
        "preview_kind": "image",
    },
    ".gif": {
        "content_type": "image/gif",
        "category": "image",
        "preview_kind": "image",
    },
    ".webp": {
        "content_type": "image/webp",
        "category": "image",
        "preview_kind": "image",
    },
    ".pdf": {
        "content_type": "application/pdf",
        "category": "document",
        "preview_kind": "pdf",
    },
    ".txt": {
        "content_type": "text/plain",
        "category": "document",
        "preview_kind": "text",
    },
    ".md": {
        "content_type": "text/markdown",
        "category": "document",
        "preview_kind": "text",
    },
}


def _sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(filename or "").name).strip("._")
    return cleaned


def _user_directory(user_id: int) -> Path:
    user_dir = USER_UPLOAD_ROOT / str(int(user_id))
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def _metadata_path(user_dir: Path, file_id: str) -> Path:
    return user_dir / f"{file_id}.json"


def _content_path(user_dir: Path, stored_name: str) -> Path:
    return user_dir / stored_name


def _build_urls(file_id: str) -> dict[str, str]:
    base = f"/api/files/{file_id}"
    return {
        "preview_url": f"{base}/content",
        "download_url": f"{base}/content?download=1",
        "delete_url": base,
    }


def _validate_signature(extension: str, data: bytes) -> bool:
    if extension == ".png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if extension in {".jpg", ".jpeg"}:
        return data.startswith(b"\xff\xd8\xff")
    if extension == ".gif":
        return data.startswith((b"GIF87a", b"GIF89a"))
    if extension == ".webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    if extension == ".pdf":
        return data.startswith(b"%PDF")
    if extension in {".txt", ".md"}:
        try:
            data[:TEXT_PREVIEW_LIMIT_BYTES].decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False
    return False


def validate_file_payload(filename: str, content_type: str | None, data: bytes) -> dict:
    safe_name = _sanitize_filename(filename)
    if not safe_name:
        raise ValueError("Invalid filename")

    extension = Path(safe_name).suffix.lower()
    file_type = ALLOWED_FILE_TYPES.get(extension)
    if not file_type:
        raise ValueError("Unsupported file format")

    expected_type = str(file_type["content_type"])
    provided_type = str(content_type or "").strip().lower()
    if provided_type and provided_type != expected_type:
        raise ValueError("Unsupported file type")

    size_bytes = len(data)
    if size_bytes <= 0:
        raise ValueError("Empty file upload")
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise ValueError("File exceeds the 10 MB limit")

    if not _validate_signature(extension, data):
        raise ValueError("Invalid file signature")

    return {
        "safe_name": safe_name,
        "extension": extension,
        "content_type": expected_type,
        "category": file_type["category"],
        "preview_kind": file_type["preview_kind"],
        "size_bytes": size_bytes,
    }


def serialize_file_record(record: dict) -> dict:
    return {
        "id": record["id"],
        "original_name": record["original_name"],
        "content_type": record["content_type"],
        "size_bytes": int(record["size_bytes"]),
        "category": record["category"],
        "preview_kind": record["preview_kind"],
        "created_at": record["created_at"],
        **_build_urls(record["id"]),
    }


def store_file_record(user_id: int, *, filename: str, content_type: str | None, data: bytes) -> dict:
    validated = validate_file_payload(filename, content_type, data)
    user_dir = _user_directory(user_id)
    file_id = uuid4().hex
    stored_name = f"{file_id}{validated['extension']}"
    disk_path = _content_path(user_dir, stored_name)
    metadata_path = _metadata_path(user_dir, file_id)

    disk_path.write_bytes(data)
    record = {
        "id": file_id,
        "user_id": int(user_id),
        "stored_name": stored_name,
        "original_name": validated["safe_name"],
        "content_type": validated["content_type"],
        "size_bytes": validated["size_bytes"],
        "category": validated["category"],
        "preview_kind": validated["preview_kind"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path.write_text(json.dumps(record, ensure_ascii=True), encoding="utf-8")
    return serialize_file_record(record)


def list_file_records(user_id: int) -> list[dict]:
    user_dir = _user_directory(user_id)
    records: list[dict] = []

    for metadata_file in sorted(user_dir.glob("*.json")):
        try:
            raw = json.loads(metadata_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        stored_name = str(raw.get("stored_name") or "").strip()
        if not stored_name:
            continue
        disk_path = _content_path(user_dir, stored_name)
        if not disk_path.exists():
            continue

        records.append(serialize_file_record(raw))

    records.sort(key=lambda entry: entry["created_at"], reverse=True)
    return records


def get_file_record(user_id: int, file_id: str) -> tuple[dict, Path]:
    user_dir = _user_directory(user_id)
    metadata_path = _metadata_path(user_dir, file_id)
    if not metadata_path.exists():
        raise FileNotFoundError("File not found")

    raw = json.loads(metadata_path.read_text(encoding="utf-8"))
    stored_name = str(raw.get("stored_name") or "").strip()
    disk_path = _content_path(user_dir, stored_name)
    if not stored_name or not disk_path.exists():
        raise FileNotFoundError("File not found")

    return raw, disk_path


def delete_file_record(user_id: int, file_id: str) -> None:
    raw, disk_path = get_file_record(user_id, file_id)
    user_dir = _user_directory(user_id)
    metadata_path = _metadata_path(user_dir, str(raw["id"]))

    if disk_path.exists():
        disk_path.unlink()
    if metadata_path.exists():
        metadata_path.unlink()
