# Guide Backend

## But
Ce backend fournit l API FastAPI pour authentification, profils, progression, matchmaking, resultats, amis et messagerie.

## Stack
- FastAPI + Starlette
- SQLAlchemy + Alembic
- JWT via python-jose
- Hashing mot de passe via passlib (argon2)
- httpx pour la verif Google

## Structure rapide
- `backend/python/app/main.py` : creation de l app, middlewares, routes
- `backend/python/app/api/routes/` : endpoints par domaine
- `backend/python/app/models/` : modeles SQLAlchemy
- `backend/python/app/schemas/` : schemas Pydantic
- `backend/python/app/services/` : logique metier
- `backend/python/app/core/` : config, security, ws manager, room manager
- `backend/python/app/alembic/` : migrations

## Etapes - demarrer en local (Python)
1. Copier `.env.example` vers `.env` et adapter `DATABASE_URL` et `SECRET_KEY`.
2. Depuis `backend/python`, creer un venv et installer les dependances.
3. Lancer les migrations Alembic.
4. Lancer le serveur FastAPI.
5. Verifier `GET /health` et `GET /docs`.

Commandes reference:
```bash
cd backend/python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload
```

## Etapes - ajouter un endpoint
1. Creer un fichier dans `backend/python/app/api/routes/` ou ajouter a un routeur existant.
2. Si nouveau routeur, l inclure dans `backend/python/app/api/routes/<domaine>.py`.
3. Inclure le routeur dans `backend/python/app/main.py`.
4. Ajouter les schemas Pydantic dans `backend/python/app/schemas/`.
5. Ajouter ou mettre a jour les modeles dans `backend/python/app/models/`.

## Authentification (resume technique)
- Tokens JWT generes par `backend/python/app/api/routes/auth_tokens.py`.
- Verification via `get_current_user` dans `backend/python/app/core/security_auth.py`.
- Header `Authorization: Bearer <token>` ou cookie `access_token` acceptes.
- Rate limit login: `backend/python/app/api/routes/auth_rate_limit.py`.

## Donnees principales
- Utilisateur: `backend/python/app/models/user.py`
- Profil: `backend/python/app/models/profile.py`
- Progression par difficulte: `backend/python/app/models/stage_progress.py`
- Resultats: `backend/python/app/models/game_result.py`
- Matchmaking/rooms: `backend/python/app/core/room_manager.py`

