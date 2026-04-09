from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services import password_reset_mailer


class _DummySMTP:
    last_message = None

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def starttls(self):
        return None

    def login(self, username, password):
        return None

    def send_message(self, message):
        _DummySMTP.last_message = message


def test_password_reset_mailer_uses_public_https_origin(monkeypatch):
    monkeypatch.setattr(password_reset_mailer.settings, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(password_reset_mailer.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(password_reset_mailer.settings, "SMTP_USE_TLS", False)
    monkeypatch.setattr(password_reset_mailer.settings, "SMTP_USE_SSL", False)
    monkeypatch.setattr(password_reset_mailer.settings, "SMTP_USERNAME", "")
    monkeypatch.setattr(password_reset_mailer.settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(
        password_reset_mailer.settings,
        "PUBLIC_FRONTEND_ORIGIN",
        "https://localhost:8443",
    )
    monkeypatch.setattr(password_reset_mailer.smtplib, "SMTP", _DummySMTP)

    password_reset_mailer.send_password_reset_token("neo@example.com", "token-123")

    assert _DummySMTP.last_message is not None
    assert "https://localhost:8443/auth?reset_token=token-123" in _DummySMTP.last_message.get_content()
