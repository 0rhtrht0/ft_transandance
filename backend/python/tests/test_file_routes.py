from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core import security
from app.main import app
import app.services.file_storage as file_storage_service


PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
    b"\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc`\x00\x00\x00\x02\x00\x01"
    b"\xe2!\xbc3"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@pytest.fixture()
def file_client(tmp_path, monkeypatch):
    monkeypatch.setattr(file_storage_service, "USER_UPLOAD_ROOT", tmp_path / "user_uploads")
    app.dependency_overrides[security.get_current_user] = lambda: SimpleNamespace(id=7, username="neo42")
    client = TestClient(app)
    try:
        yield client
    finally:
        app.dependency_overrides.clear()


def test_file_routes_upload_list_preview_and_delete(file_client):
    upload_response = file_client.post(
        "/api/files",
        files=[
            ("files", ("avatar.png", PNG_BYTES, "image/png")),
            ("files", ("notes.pdf", PDF_BYTES, "application/pdf")),
            ("files", ("readme.txt", b"hello blackhole", "text/plain")),
        ],
    )

    assert upload_response.status_code == 201
    payload = upload_response.json()
    assert len(payload["files"]) == 3
    image_entry = next(item for item in payload["files"] if item["original_name"] == "avatar.png")
    assert image_entry["preview_kind"] == "image"

    list_response = file_client.get("/api/files")
    assert list_response.status_code == 200
    assert len(list_response.json()["files"]) == 3

    metadata_response = file_client.get(f"/api/files/{image_entry['id']}")
    assert metadata_response.status_code == 200
    assert metadata_response.json()["download_url"].endswith("?download=1")

    preview_response = file_client.get(f"/api/files/{image_entry['id']}/content")
    assert preview_response.status_code == 200
    assert preview_response.headers["content-type"] == "image/png"
    assert preview_response.content.startswith(b"\x89PNG")

    delete_response = file_client.delete(f"/api/files/{image_entry['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"detail": "File deleted"}

    missing_response = file_client.get(f"/api/files/{image_entry['id']}")
    assert missing_response.status_code == 404


def test_file_routes_reject_invalid_format(file_client):
    response = file_client.post(
        "/api/files",
        files=[("files", ("malware.exe", b"MZ....", "application/octet-stream"))],
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported file format"


def test_file_routes_enforce_private_access(file_client):
    upload_response = file_client.post(
        "/api/files",
        files=[("files", ("private.txt", b"secret", "text/plain"))],
    )
    file_id = upload_response.json()["files"][0]["id"]

    app.dependency_overrides[security.get_current_user] = lambda: SimpleNamespace(id=12, username="trinity")

    response = file_client.get(f"/api/files/{file_id}/content")
    assert response.status_code == 404


def test_file_routes_reject_invalid_signature(file_client):
    response = file_client.post(
        "/api/files",
        files=[("files", ("fake.pdf", b"not a real pdf", "application/pdf"))],
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid file signature"
