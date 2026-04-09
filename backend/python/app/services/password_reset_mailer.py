import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_enabled() -> bool:
    return bool(settings.SMTP_HOST)


def send_password_reset_token(email: str, token: str, origin: str | None = None) -> None:
    if not _smtp_enabled():
        logger.info("SMTP not configured; skipping password reset email send.")
        return

    message = EmailMessage()
    message["Subject"] = "Blackhole - Réinitialisation de mot de passe"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = email
    
    base_url = origin or settings.PUBLIC_FRONTEND_ORIGIN
    
    message.set_content(
        "\n".join(
            [
                "Vous avez demandé la réinitialisation de votre mot de passe.",
                "",
                "Veuillez cliquer sur le lien ci-dessous pour créer un nouveau mot de passe :",
                f"{base_url}/auth?reset_token={token}",
                "",
                "Ce lien expire bientôt.",
                "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
            ]
        )
    )

    smtp_client_class = smtplib.SMTP_SSL if settings.SMTP_USE_SSL else smtplib.SMTP
    with smtp_client_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            server.starttls()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)
