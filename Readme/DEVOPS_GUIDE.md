# Guide DevOps

## But
Ce guide explique comment lancer le stack complet avec Docker Compose et Caddy.

## Services (docker-compose)
- Postgres: `backend/docker-compose.yml` service `postgres`
- Backend FastAPI: `backend/docker-compose.yml` service `backend`
- Frontend Vite: `backend/docker-compose.yml` service `frontend`
- Caddy reverse proxy: `backend/docker-compose.yml` service `caddy`
- Redis optionnel: `backend/docker-compose.yml` service `redis`

## Etapes - stack complet
1. Aller dans `backend`.
2. Lancer Docker Compose.
3. Ouvrir `https://localhost:8443`.
4. Verifier `https://localhost:8443/health`.

Commandes reference:
```bash
cd backend
docker compose up --build
```

## Caddy (reverse proxy + TLS local)
- Config: `backend/caddy/Caddyfile`
- TLS internal, donc navigateur peut demander une exception.
- Proxy API: `/api/*`, `/auth/*`, `/users/*`, `/friends*`, `/messages*`, `/ws*`, `/docs*`

## Backend container
- Dockerfile: `backend/python/Dockerfile`
- Demarre avec `alembic upgrade head` puis `uvicorn app.main:app`

## Postgres init
- Script: `backend/postgres/init/01_create_extensions.sql`
- Monte en volume via `backend/docker-compose.yml`

## Variables utiles (Docker)
- `DATABASE_URL`
- `SECRET_KEY`
- `REDIS_URL`

