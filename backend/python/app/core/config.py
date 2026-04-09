import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv


def _is_docker() -> bool:
    return Path("/.dockerenv").exists()


def _load_env() -> None:
    explicit_path = os.getenv("DOTENV_PATH")
    if explicit_path:
        load_dotenv(explicit_path, override=False)
        return

    if _is_docker():
        docker_env = Path(__file__).resolve().parents[2] / ".env.docker"
        if docker_env.exists():
            load_dotenv(docker_env, override=False)
            return
        if os.getenv("DATABASE_URL") or os.getenv("SECRET_KEY"):
            return

    project_env = Path(__file__).resolve().parents[2] / ".env"
    if project_env.exists():
        load_dotenv(project_env, override=False)
        return

    dotenv_path = find_dotenv()
    if dotenv_path:
        load_dotenv(dotenv_path, override=False)
    else:
        load_dotenv(override=False)


_load_env()


def _parse_csv_env(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    parsed = [item.strip() for item in raw_value.split(",") if item.strip()]
    return parsed or default


def _parse_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_origin_env(name: str, default: str) -> str:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().rstrip("/")
    return normalized or default


def _normalize_database_url(database_url: str) -> str:
    if not database_url.startswith("sqlite:///"):
        return database_url

    database_path = database_url.removeprefix("sqlite:///")
    if database_path == ":memory:" or database_path.startswith("/"):
        return database_url

    base_dir = Path(__file__).resolve().parents[4]
    return f"sqlite:///{(base_dir / database_path).resolve()}"


class Settings:
    DATABASE_URL: str = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./dev.db"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_ALLOWED_ISSUERS: list[str] = _parse_csv_env(
        "GOOGLE_ALLOWED_ISSUERS",
        ["accounts.google.com", "https://accounts.google.com"],
    )
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "30")
    )
    PASSWORD_RESET_DEV_RETURN_TOKEN: bool = _parse_bool_env(
        "PASSWORD_RESET_DEV_RETURN_TOKEN", True
    )
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "no-reply@blackhole.local")
    SMTP_USE_TLS: bool = _parse_bool_env("SMTP_USE_TLS", True)
    SMTP_USE_SSL: bool = _parse_bool_env("SMTP_USE_SSL", False)
    PUBLIC_FRONTEND_ORIGIN: str = _parse_origin_env(
        "PUBLIC_FRONTEND_ORIGIN",
        "https://localhost:8443",
    )

    CORS_ALLOW_ORIGINS: list[str] = _parse_csv_env(
        "CORS_ALLOW_ORIGINS",
        [
            "https://localhost:8443",
            "https://127.0.0.1:8443",
            "https://10.11.5.9:8443",
            "https://10.11.5.9.nip.io:8443",
        ],
    )
    CORS_ALLOW_METHODS: list[str] = _parse_csv_env(
        "CORS_ALLOW_METHODS",
        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    )
    CORS_ALLOW_HEADERS: list[str] = _parse_csv_env(
        "CORS_ALLOW_HEADERS",
        [
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "X-Request-ID",
            "X-API-Key",
        ],
    )
    CORS_ALLOW_CREDENTIALS: bool = _parse_bool_env("CORS_ALLOW_CREDENTIALS", True)
    CORS_ALLOW_ORIGIN_REGEX: str = os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"https://((localhost|127\.0\.0\.1)|(\d{1,3}(?:\.\d{1,3}){3})|(([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+))(:\d+)?$",
    )

    LOGIN_MAX_ATTEMPTS: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_ATTEMPT_WINDOW_SECONDS: int = int(
        os.getenv("LOGIN_ATTEMPT_WINDOW_SECONDS", "300")
    )
    LOGIN_BLOCK_SECONDS: int = int(os.getenv("LOGIN_BLOCK_SECONDS", "300"))
    PUBLIC_API_KEYS: list[str] = _parse_csv_env(
        "PUBLIC_API_KEYS",
        ["blackhole-public-dev-key"],
    )
    PUBLIC_API_RATE_LIMIT: int = int(os.getenv("PUBLIC_API_RATE_LIMIT", "60"))
    PUBLIC_API_RATE_WINDOW_SECONDS: int = int(
        os.getenv("PUBLIC_API_RATE_WINDOW_SECONDS", "60")
    )
    SECURITY_HEADERS_ENABLED: bool = _parse_bool_env(
        "SECURITY_HEADERS_ENABLED", True
    )
    HSTS_MAX_AGE_SECONDS: int = int(os.getenv("HSTS_MAX_AGE_SECONDS", "31536000"))


settings = Settings()
