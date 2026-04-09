from pathlib import Path
import sys
from types import SimpleNamespace

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api.routes import auth_google as auth_google_routes


def test_google_client_config_enabled(monkeypatch):
    monkeypatch.setattr(auth_google_routes.settings, "GOOGLE_CLIENT_ID", "test-client-id")

    response = auth_google_routes.google_client_config()

    assert response["enabled"] is True
    assert response["client_id"] == "test-client-id"


def test_google_client_config_disabled(monkeypatch):
    monkeypatch.setattr(auth_google_routes.settings, "GOOGLE_CLIENT_ID", "")

    response = auth_google_routes.google_client_config()

    assert response["enabled"] is False
    assert response["client_id"] == ""


def test_google_redirect_target_uses_forwarded_https_origin():
    request = SimpleNamespace(
        url=SimpleNamespace(scheme="http", netloc="backend:8000"),
        headers={
            "host": "10.0.0.8:8443",
            "x-forwarded-proto": "https",
        },
    )
    user = SimpleNamespace(id=7, username="Neo")

    redirect_target = auth_google_routes._build_google_redirect_target(
        request,
        "signed-token",
        user,
    )

    assert redirect_target.startswith("https://10.0.0.8:8443/auth#")
    assert "google_access_token=signed-token" in redirect_target
    assert "google_user_id=7" in redirect_target
    assert "google_username=Neo" in redirect_target
