from pathlib import Path
import sys

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app
import app.main as main_module


client = TestClient(app)


def test_metrics_endpoint_exposes_prometheus_metrics():
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "blackhole_http_requests_total" in response.text
    assert "blackhole_app_info" in response.text


def test_ready_returns_ready_when_database_check_succeeds(monkeypatch):
    monkeypatch.setattr(main_module, "check_database_ready", lambda: {"database": "ok"})

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}


def test_ready_returns_503_when_database_check_fails(monkeypatch):
    def _raise_error():
        raise RuntimeError("db down")

    monkeypatch.setattr(main_module, "check_database_ready", _raise_error)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["checks"]["database"].startswith("error:")
