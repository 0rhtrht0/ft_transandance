from pathlib import Path
import re
import sys

from starlette.middleware.cors import CORSMiddleware

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app


def test_cors_allows_configured_origin():
    cors_middleware = next(
        middleware
        for middleware in app.user_middleware
        if middleware.cls is CORSMiddleware
    )
    allow_origins = cors_middleware.kwargs.get("allow_origins", [])
    assert "https://localhost:8443" in allow_origins


def test_cors_allows_remote_ip_origin_regex():
    cors_middleware = next(
        middleware
        for middleware in app.user_middleware
        if middleware.cls is CORSMiddleware
    )
    allow_origin_regex = cors_middleware.kwargs.get("allow_origin_regex")
    assert isinstance(allow_origin_regex, str)
    assert re.match(allow_origin_regex, "https://192.168.1.45:8443")
