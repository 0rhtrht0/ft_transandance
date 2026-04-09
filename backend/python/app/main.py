from fastapi import Depends, FastAPI, status, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.routes import rooms
from app.api.routes import files
from app.api.routes import friends
from app.api.routes import messages
from app.api.routes import (
    auth,
    game_history,
    game_results,
    leaderboard,
    matchmaking,
    notifications,
    profile,
    progression,
    public_api,
    users,
    wallet,
    ws,
    ws_notifications,
)
from app.core.errors import configure_error_handling, standard_error_responses
from app.core.exceptions import (
    EmailAlreadyTaken,
    UsernameAlreadyTaken,
    UserNotFound,
)
from app.dependencies import get_db
from app.models.user import User
from app.schemas.common import RootResponse
from app.schemas.user import UserResponse, UserUpdate
from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.security import hash_password, get_current_user
from app.core.monitoring import PrometheusMiddleware, configure_monitoring, metrics_response
from app.core.public_api import PublicApiRateLimiter
from pathlib import Path
from app.services.social_bootstrap_service import bootstrap_social_schema


app = FastAPI(
    title="Blackhole Backend API",
    description=(
        "API FastAPI pour l'authentification et la gestion de profils "
        "du projet ft_transcendence."
    ),
    version="1.0.0",
)
app.state.public_api_rate_limiter = PublicApiRateLimiter(
    settings.PUBLIC_API_RATE_LIMIT,
    settings.PUBLIC_API_RATE_WINDOW_SECONDS,
)

configure_error_handling(app)
configure_monitoring(app.version)

# Serve uploaded avatars from a stable absolute path
avatar_upload_dir = Path(__file__).resolve().parents[1] / "uploaded_avatars"
app.mount(
    "/uploaded_avatars",
    StaticFiles(directory=str(avatar_upload_dir), check_dir=False),
    name="uploaded_avatars"
)

message_upload_dir = Path(__file__).resolve().parents[1] / "uploaded_messages"
app.mount(
    "/uploaded_messages",
    StaticFiles(directory=str(message_upload_dir), check_dir=False),
    name="uploaded_messages"
)

# CORS strict
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)
app.add_middleware(PrometheusMiddleware)

# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if not settings.SECURITY_HEADERS_ENABLED:
            return response

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "same-origin"

        forwarded_proto = (request.headers.get("x-forwarded-proto") or "").lower()
        is_https = request.url.scheme == "https" or forwarded_proto == "https"
        if is_https and settings.HSTS_MAX_AGE_SECONDS > 0:
            response.headers[
                "Strict-Transport-Security"
            ] = f"max-age={settings.HSTS_MAX_AGE_SECONDS}; includeSubDomains; preload"
        return response
app.add_middleware(SecurityHeadersMiddleware)

# JSON logging
class JsonLogFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name,
        }
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)
        return str(log_record)
handler = logging.StreamHandler()
handler.setFormatter(JsonLogFormatter())
logging.getLogger().handlers = [handler]
logging.getLogger().setLevel(settings.LOG_LEVEL)


@app.on_event("startup")
def ensure_social_schema_ready():
    bootstrap_social_schema(engine, SessionLocal)


@app.get("/health", tags=["monitoring"])
def health():
    return {"status": "ok"}

def check_database_ready() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"database": "ok"}


@app.get("/ready", tags=["monitoring"])
def ready():
    try:
        checks = check_database_ready()
    except Exception as exc:
        checks = {"database": f"error: {exc.__class__.__name__}"}
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "checks": checks},
        )
    return {"status": "ready", "checks": checks}


@app.get("/metrics", tags=["monitoring"])
def metrics():
    return metrics_response()

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(progression.router)
app.include_router(public_api.router)
app.include_router(files.router)
app.include_router(rooms.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(game_history.router, prefix="/api")
app.include_router(game_results.router, prefix="/api")
app.include_router(wallet.router, prefix="/api")
app.include_router(matchmaking.router, prefix="/api")
app.include_router(ws_notifications.router)
app.include_router(friends.router)
app.include_router(messages.router)
app.include_router(users.router)
app.include_router(notifications.router)
app.include_router(ws.router)

@app.get(
    "/",
    response_model=RootResponse,
    summary="Verifier l'etat de l'API",
    description="Retourne un message simple confirmant que le backend est actif.",
    responses=standard_error_responses(status.HTTP_500_INTERNAL_SERVER_ERROR),
)
def root():
    return {"message": "Blackhole backend is running!"}


@app.get(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Recuperer un utilisateur",
    description="Retourne un utilisateur via son identifiant.",
    responses=standard_error_responses(
        status.HTTP_404_NOT_FOUND, status.HTTP_500_INTERNAL_SERVER_ERROR
    ),
)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise UserNotFound()

    return user


@app.patch(
    "/users/me",
    response_model=UserResponse,
    summary="Mettre a jour mon compte",
    description="Met a jour partiellement le pseudo, l'email et/ou le mot de passe.",
    responses=standard_error_responses(
        status.HTTP_400_BAD_REQUEST,
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
        status.HTTP_404_NOT_FOUND,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    ),
)
def update_my_profile_user(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == current_user.id
    ).first()

    if not user:
        raise UserNotFound()

    if update_data.username:
        existing_user = db.query(User).filter(
            User.username == update_data.username,
            User.id != user.id,
        ).first()
        if existing_user:
            raise UsernameAlreadyTaken()
        user.username = update_data.username

    if update_data.email:
        existing_email = db.query(User).filter(
            User.email == update_data.email,
            User.id != user.id,
        ).first()
        if existing_email:
            raise EmailAlreadyTaken()
        user.email = update_data.email

    if update_data.password:
        user.hashed_password = hash_password(update_data.password)

    db.commit()
    db.refresh(user)

    return user
