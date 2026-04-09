# 📘 Guide Complet Backend - Étapes par Étapes

**Table des matières**
1. [Setup Environnement](#setup)
2. [Architecture Générale](#architecture)
3. [Database & Migrations](#database)
4. [Authentication & Sécurité](#auth)
5. [API Routes](#routes)
6. [WebSocket Real-time](#websocket)
7. [Services & Logique Métier](#services)
8. [Démarrage du Backend](#start)

---

## 1. Setup Environnement {#setup}

### Étape 1.1: Installer Python & Dépendances
```bash
# Vérifier Python 3.11+
python --version  # 3.11+ requis

# Naviguer au backend
cd backend/python

# Créer venv (optionnel, recommended)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

### Étape 1.2: Installer Requirements
```bash
# Installer toutes les dépendances
pip install -r requirements.txt

# Vérifier installation
python -c "import fastapi; print(fastapi.__version__)"
```

### Étape 1.3: Variables d'Environnement
```bash
# Créer .env depuis le template
cp .env.example .env

# Éditer .env avec tes params:
nano .env
# ou code .env
```

**Variables clés:**
```env
DATABASE_URL=postgresql://user:pass@localhost/db_name
JWT_SECRET_KEY=your-super-secret-key-min-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
ENVIRONMENT=development
```

---

## 2. Architecture Générale {#architecture}

### Étape 2.1: Structure du Projet

```
backend/python/
├── app/
│   ├── __init__.py
│   ├── main.py                 ← Entry point (FastAPI app)
│   ├── dependencies.py         ← Dependency injection
│   ├── core/
│   │   ├── config.py          ← Configuration
│   │   ├── database.py        ← SQLAlchemy setup
│   │   ├── security.py        ← Auth imports
│   │   ├── security_auth.py   ← JWT + OAuth2
│   │   ├── security_tokens.py ← Token handling
│   │   └── security_hash.py   ← Password hashing
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py        ← /api/auth/*
│   │       ├── users.py       ← /api/users/*
│   │       ├── friends.py     ← /api/friends/*
│   │       ├── messages.py    ← /api/messages/*
│   │       ├── rooms.py       ← /api/rooms/* (WebSocket)
│   │       ├── matchmaking.py ← /api/matchmaking/*
│   │       └── progression.py ← /api/progression/*
│   ├── models/                ← SQLAlchemy models
│   │   ├── user.py
│   │   ├── friendship.py
│   │   ├── message.py
│   │   ├── game_result.py
│   │   └── ...
│   ├── schemas/               ← Pydantic validators
│   │   ├── user.py
│   │   ├── message.py
│   │   └── ...
│   ├── services/              ← Business logic
│   │   ├── user_service.py
│   │   ├── friend_service.py
│   │   ├── match_service.py
│   │   └── ...
│   └── tests/                 ← Unit tests
│       ├── test_auth.py
│       ├── test_friends.py
│       └── ...
├── alembic/                   ← Database migrations
│   ├── versions/
│   └── env.py
└── requirements.txt
```

### Étape 2.2: Flux de Requête Typique

```
Client HTTP Request
    ↓
Middleware (CORS, SecurityHeaders)
    ↓
Route Handler (router.post('/api/endpoint'))
    ↓
Dependencies Injection (get_current_user, get_db)
    ↓
Request Validation (Pydantic schema)
    ↓
Service Layer (UserService.get_user())
    ↓
Database Layer (SQLAlchemy query)
    ↓
Response (JSONResponse)
    ↓
Client
```

---

## 3. Database & Migrations {#database}

### Étape 3.1: Setup PostgreSQL

```bash
# Option 1: Avec Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=transcendence \
  -p 5432:5432 \
  postgres:16

# Option 2: PostgreSQL local
# Installer PostgreSQL 16+
# Créer database:
psql -U postgres
CREATE DATABASE transcendence;
\q
```

### Étape 3.2: Vérifier Connexion Database

```bash
# Tester la connexion
python -c "
from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text('SELECT 1'))
    print('✅ Database connected')
"
```

### Étape 3.3: Exécuter Migrations

```bash
# Voir l'état des migrations
alembic current

# Uploader toutes les migrations
alembic upgrade head

# Vérifier les tables créées
psql -U user -d transcendence -c "\dt"
```

### Étape 3.4: Créer une Migration

```bash
# Auto-générer une migration (après modifier un model)
alembic revision --autogenerate -m "add_avatar_to_profiles"

# Vérifier le fichier généré
ls alembic/versions/

# Appliquer
alembic upgrade head
```

**Migration Example (auto-generated):**
```python
# alembic/versions/20260317_add_avatar.py
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_url', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_avatar_url'), 'users', ['avatar_url'])

def downgrade() -> None:
    op.drop_index(op.f('ix_users_avatar_url'), table_name='users')
    op.drop_column('users', 'avatar_url')
```

---

## 4. Authentication & Sécurité {#auth}

### Étape 4.1: Password Hashing (Argon2)

```python
# app/core/security_hash.py
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,    # 64 MB
    argon2__time_cost=3,          # 3 iterations
    argon2__parallelism=4         # 4 threads
)

def hash_password(password: str) -> str:
    """Hash password with Argon2"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password (constant-time comparison)"""
    return pwd_context.verify(plain_password, hashed_password)
```

### Étape 4.2: JWT Token Creation

```python
# app/core/security_tokens.py
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.core.config import settings

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt

def verify_token(token: str):
    """Verify JWT token"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None
```

### Étape 4.3: Signup Route

```python
# app/api/routes/auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password, create_access_token
from app.core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Create new user account"""
    
    # 1. Validate input
    if len(user_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters"
        )
    
    # 2. Check email uniqueness
    existing = db.query(User).filter(
        User.email == user_data.email.lower()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # 3. Hash password
    hashed_password = hash_password(user_data.password)
    
    # 4. Create user
    new_user = User(
        email=user_data.email.lower(),
        username=user_data.username,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 5. Create token
    access_token = create_access_token(data={"sub": new_user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
```

### Étape 4.4: Login Route

```python
@router.post("/login")
async def login(
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    """Authenticate user and return token"""
    
    # 1. Find user
    user = db.query(User).filter(
        User.email == email.lower()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 2. Verify password
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 3. Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
```

---

## 5. API Routes {#routes}

### Étape 5.1: Protected Route avec Dependency

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from sqlalchemy.orm import Session
from app.core.security_tokens import verify_token
from app.core.database import get_db
from app.models.user import User

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency: Extract & verify JWT token"""
    
    token = credentials.credentials
    user_id = verify_token(token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user

# Usage dans une route
@router.get("/api/users/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username
    }
```

### Étape 5.2: CRUD Routes Exemple

```python
# app/api/routes/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username
    }

@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.put("/{user_id}")
async def update_user(
    user_id: int,
    update_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user (only own data)"""
    
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    user = db.query(User).filter(User.id == user_id).first()
    
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    
    return user
```

---

## 6. WebSocket Real-time {#websocket}

### Étape 6.1: WebSocket Endpoint Setup

```python
# app/api/routes/rooms.py
from fastapi import APIRouter, WebSocket, Query, Depends
from sqlalchemy.orm import Session
from app.core.security_tokens import verify_token
from app.core.database import get_db

router = APIRouter(tags=["rooms"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}
        self.rooms: dict[str, list[int]] = {}
    
    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def broadcast_room(self, room_id: str, message: dict):
        if room_id in self.rooms:
            for user_id in self.rooms[room_id]:
                await self.send_personal_message(user_id, message)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """WebSocket endpoint with token authentication"""
    
    # 1. Verify token
    user_id = verify_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    # 2. Connect
    await manager.connect(user_id, websocket)
    
    try:
        while True:
            # 3. Receive message
            data = await websocket.receive_json()
            
            # 4. Process based on type
            msg_type = data.get("type")
            
            if msg_type == "chat":
                # Handle chat
                await manager.broadcast_room(
                    data.get("room_id"),
                    {
                        "type": "chat",
                        "from": user_id,
                        "body": data.get("body")
                    }
                )
            
            elif msg_type == "game_sync":
                # Handle game update
                await manager.broadcast_room(
                    data.get("room_id"),
                    {
                        "type": "player_moved",
                        "user_id": user_id,
                        "x": data.get("x"),
                        "y": data.get("y")
                    }
                )
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        manager.disconnect(user_id)
```

---

## 7. Services & Logique Métier {#services}

### Étape 7.1: Service Layer Pattern

```python
# app/services/friend_service.py
from sqlalchemy.orm import Session
from app.models.friendship import Friendship
from app.models.user import User
from fastapi import HTTPException

class FriendService:
    def __init__(self, db: Session):
        self.db = db
    
    def send_request(self, from_user_id: int, to_user_id: int):
        """Send friend request"""
        
        # Check already friends
        existing = self.db.query(Friendship).filter(
            ((Friendship.user_id_1 == from_user_id) & 
             (Friendship.user_id_2 == to_user_id)) |
            ((Friendship.user_id_1 == to_user_id) & 
             (Friendship.user_id_2 == from_user_id))
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Already friends or request pending"
            )
        
        # Create request
        request = FriendRequest(
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            status="pending"
        )
        
        self.db.add(request)
        self.db.commit()
        
        return request
    
    def accept_request(self, request_id: int, user_id: int):
        """Accept friend request"""
        
        request = self.db.query(FriendRequest).filter(
            FriendRequest.id == request_id
        ).first()
        
        if not request or request.to_user_id != user_id:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Create friendship
        friendship = Friendship(
            user_id_1=min(request.from_user_id, request.to_user_id),
            user_id_2=max(request.from_user_id, request.to_user_id)
        )
        
        self.db.add(friendship)
        request.status = "accepted"
        
        self.db.commit()
        
        return friendship
```

### Étape 7.2: Usage dans Route

```python
# app/api/routes/friends.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.friend_service import FriendService

router = APIRouter(prefix="/api/friends", tags=["friends"])

@router.post("/requests")
async def send_friend_request(
    to_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send friend request"""
    
    service = FriendService(db)
    request = service.send_request(current_user.id, to_user_id)
    
    return request

@router.post("/requests/{request_id}/accept")
async def accept_friend_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept friend request"""
    
    service = FriendService(db)
    friendship = service.accept_request(request_id, current_user.id)
    
    return friendship
```

---

## 8. Démarrage du Backend {#start}

### Étape 8.1: Démarrer le Serveur

```bash
# Depuis backend/python/
python -m uvicorn app.main:app --reload

# Output attendu:
# INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
# INFO:     Started reloader process [1234] using StatReload
```

### Étape 8.2: Tester l'API

```bash
# Vérifier que le serveur répond
curl http://localhost:8000/docs

# Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"password123"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

# Get current user (remplacer TOKEN par le token reçu)
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer TOKEN"
```

### Étape 8.3: Vérifier Santé

```bash
# Health check
curl http://localhost:8000/health

# OpenAPI Docs
# Ouvre http://localhost:8000/docs

# ReDoc
# Ouvre http://localhost:8000/redoc
```

---

## Résumé des Étapes

```
✅ 1. Setup: Python + requirements + .env
✅ 2. Architecture: Comprendre la structure
✅ 3. Database: PostgreSQL + Alembic migrations
✅ 4. Auth: Hashing + JWT + Tokens
✅ 5. Routes: CRUD + Dependencies
✅ 6. WebSocket: Real-time connections
✅ 7. Services: Business logic
✅ 8. Startup: Lancer et tester
```

**Backend prêt! ✅**
