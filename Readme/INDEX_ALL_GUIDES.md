# Index Complet: Guides Détaillés par Fichier

## 📚 Navigation Rapide

### Backend Files Guides

| Fichier | Contenu | Statut |
|---------|---------|--------|
| [BACKEND_FILE_MAIN.md](BACKEND_FILE_MAIN.md) | main.py, config.py, security.py, database.py | ✅ |
| [BACKEND_FILE_ROUTES.md](BACKEND_FILE_ROUTES.md) | Routes (auth, friends, messages, progression, matchmaking) | ✅ |
| [BACKEND_FILE_MODELS.md](BACKEND_FILE_MODELS.md) | SQLAlchemy Models, Relations, Migrations | ✅ |
| [BACKEND_DETAILED.md](BACKEND_DETAILED.md) | Setup, Endpoints, Services, Examples | ✅ |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Vue d'ensemble, Flows, Stack | ✅ |

### Frontend Files Guides

| Fichier | Contenu | Statut |
|---------|---------|--------|
| [FRONTEND_DETAILED.md](FRONTEND_DETAILED.md) | Vue 3, Router, Components, Game Engine | ✅ |

### DevOps & Infrastructure

| Fichier | Contenu | Statut |
|---------|---------|--------|
| [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md) | Docker, Caddy, PostgreSQL | ✅ |

---

## 🎯 Guides par Concept

### Authentication & Security
- [BACKEND_FILE_MAIN.md → Security](#security) - JWT, Password Hashing, Argon2
- [BACKEND_FILE_MAIN.md → Flux Auth](#auth-flow) - Signup, Login, Get Current User

### Database & Models
- [BACKEND_FILE_MODELS.md](#models) - Tous les models SQLAlchemy
- [BACKEND_FILE_MODELS.md → Relations](#relations) - One-to-One, One-to-Many, Many-to-Many
- [BACKEND_FILE_MODELS.md → Migrations](#migrations) - Alembic, Database Versioning

### API Endpoints
- [BACKEND_FILE_ROUTES.md → Auth Routes](#routes) - Signup, Login, Me
- [BACKEND_FILE_ROUTES.md → Progression](#progression) - Start Stage, Complete Stage
- [BACKEND_FILE_ROUTES.md → Friends](#friends) - Send Request, Accept, List
- [BACKEND_FILE_ROUTES.md → Messages](#messages) - Send Message, Get History
- [BACKEND_FILE_ROUTES.md → Matchmaking](#matchmaking) - Join Queue, Match Found
- [BACKEND_DETAILED.md → API Endpoints](#endpoints) - Tous les endpoints avec exemples

### Real-time & WebSocket
- [BACKEND_FILE_ROUTES.md → WebSocket Manager](#websocket) - Connections, Broadcasting
- [BACKEND_DETAILED.md → WebSocket](#websocket) - Events, Protocols

### Services & Business Logic
- [BACKEND_FILE_ROUTES.md → Services Métier](#services) - Friend Service, Match Service

### Game Engine (Frontend)
- [FRONTEND_DETAILED.md → Game Engine](#engine) - Game Loop, GameScene, Maze Generator, Player
- [FRONTEND_DETAILED.md → Game Seed](#engine) - Procedural Generation avec Seed

### Frontend Components
- [FRONTEND_DETAILED.md → ChatWidget](#composants) - Chat en temps réel
- [FRONTEND_DETAILED.md → NotificationsWidget](#composants) - Notifications
- [FRONTEND_DETAILED.md → GameChatHUD](#composants) - Chat in-game

### API Client (Frontend)
- [FRONTEND_DETAILED.md → API Client](#client) - HTTP Wrapper, Endpoints
- [FRONTEND_DETAILED.md → WebSocket Client](#client) - Connection, Events

### Architecture & Flow
- [ARCHITECTURE.md](#architecture) - Vue d'ensemble complète
- [ARCHITECTURE.md → Communication Flows](#flows) - Auth, Friends, Chat, Matchmaking, Progression
- [ARCHITECTURE.md → Flux Complet](#complet) - Login → Jeu Solo → Chat → Amis

---

## 📖 Lecture Recommandée par Rôle

### Si tu es Backend Developer
```
1. BACKEND_FILE_MAIN.md (20 min)
   - Comprendre FastAPI, middlewares, security
   
2. BACKEND_FILE_MODELS.md (30 min)
   - SQLAlchemy models, relations, migrations
   
3. BACKEND_FILE_ROUTES.md (45 min)
   - Routes par domaine (auth, friends, messages, etc)
   
4. BACKEND_DETAILED.md (60 min)
   - Setup complet, tous endpoints avec exemples
   
5. ARCHITECTURE.md (20 min)
   - Comprendre le projet entièrement
```

### Si tu es Frontend Developer
```
1. ARCHITECTURE.md (30 min)
   - Vue globale projet, API flows
   
2. FRONTEND_DETAILED.md (90 min)
   - Vue 3, Router, Components, Game Engine
   
3. BACKEND_DETAILED.md → API Endpoints (30 min)
   - Comprendre les endpoints à appeler
```

### Si tu fais DevOps
```
1. DEVOPS_GUIDE.md (30 min)
   - Docker, Caddy, PostgreSQL setup
   
2. ARCHITECTURE.md (20 min)
   - Vue infrastructure
   
3. BACKEND_FILE_MAIN.md → Config (10 min)
   - Variables d'environnement
```

---

## 🔍 FAQ: Où Trouver Réponse?

**"Comment fonctionne l'authentification?"**
→ [BACKEND_FILE_MAIN.md → Security](#security)

**"Comment ajouter un endpoint?"**
→ [BACKEND_DETAILED.md → Etapes ajouter endpoint](#endpoints)

**"Quel est le flux d'une demande d'ami?"**
→ [BACKEND_FILE_ROUTES.md → Friends](#friends)

**"Comment la progression par stage fonctionne?"**
→ [BACKEND_FILE_ROUTES.md → Progression](#progression)

**"Comment le chat temps-réel fonctionne?"**
→ [BACKEND_FILE_ROUTES.md → Messages](#messages)
→ [ARCHITECTURE.md → Chat Flow](#flows)

**"Comment matchmaking fonctionne?"**
→ [BACKEND_FILE_ROUTES.md → Matchmaking](#matchmaking)
→ [ARCHITECTURE.md → Matchmaking Flow](#flows)

**"Quelle structure de base de données?"**
→ [BACKEND_FILE_MODELS.md](#models)

**"Comment faire une migration?"**
→ [BACKEND_FILE_MODELS.md → Migrations](#migrations)

**"Comment le game engine fonctionne?"**
→ [FRONTEND_DETAILED.md → Game Engine](#engine)

**"Comment les composants Vue communiquent-ils?"**
→ [FRONTEND_DETAILED.md → Composants](#composants)

**"Comment deployer en Docker?"**
→ [DEVOPS_GUIDE.md](#devops)

---

## 📊 Vue d'Ensemble: Fichiers Backend

```
backend/python/
│
├── app/
│   │
│   ├── main.py ★
│   │   • FastAPI app initialization
│   │   • Middleware setup (CORS, Security)
│   │   • Router registration
│   │   • Health check endpoints
│   │   → BACKEND_FILE_MAIN.md
│   │
│   ├── dependencies.py
│   │   • get_db() - Database session
│   │   • get_current_user() - Auth dependency
│   │   → BACKEND_FILE_MAIN.md → Dependencies
│   │
│   ├── core/
│   │   ├── config.py ★
│   │   │   • Settings from .env
│   │   │   • Database URL, Secret Key
│   │   │   → BACKEND_FILE_MAIN.md → Config
│   │   │
│   │   ├── security.py ★
│   │   │   • JWT generation/verification
│   │   │   • Password hashing (Argon2)
│   │   │   → BACKEND_FILE_MAIN.md → Security
│   │   │
│   │   ├── database.py
│   │   │   • SQLAlchemy engine, session
│   │   │   • Connection pool
│   │   │   → BACKEND_FILE_MAIN.md → Database
│   │   │
│   │   ├── ws_manager.py ★
│   │   │   • WebSocket connection tracking
│   │   │   • Rooms, Broadcasting
│   │   │   → BACKEND_FILE_ROUTES.md → WebSocket
│   │   │
│   │   ├── room_manager.py
│   │   │   • Game room state
│   │   │   → BACKEND_DETAILED.md
│   │   │
│   │   └── exceptions.py
│   │       • Custom HTTP exceptions
│   │
│   ├── models/ ★
│   │   ├── user.py
│   │   │   • User table
│   │   │   → BACKEND_FILE_MODELS.md → Models
│   │   │
│   │   ├── profile.py
│   │   │   • Profile (1-to-1 with User)
│   │   │
│   │   ├── friendship.py
│   │   │   • Friends table (N-N with User)
│   │   │
│   │   ├── friend_request.py
│   │   │   • Friend requests (pending)
│   │   │
│   │   ├── message.py
│   │   │   • Chat messages
│   │   │
│   │   ├── conversation.py
│   │   │   • Conversations (1-1)
│   │   │
│   │   ├── stage_progress.py
│   │   │   • User progress per difficulty
│   │   │
│   │   ├── game_result.py
│   │   │   • Individual game scores
│   │   │
│   │   ├── game_history.py
│   │   │   • Game metadata
│   │   │
│   │   └── notification.py
│   │       • User notifications
│   │       → BACKEND_FILE_MODELS.md
│   │
│   ├── schemas/ ★
│   │   ├── user.py
│   │   │   • UserResponse, UserUpdate
│   │   │
│   │   ├── message.py
│   │   │   • MessageCreate, MessageResponse
│   │   │
│   │   ├── game.py
│   │   │   • Game schemas
│   │   │
│   │   └── common.py
│   │       • ErrorResponse, MessageResponse
│   │       → BACKEND_DETAILED.md
│   │
│   ├── services/ ★
│   │   ├── friend_service.py
│   │   │   • Business logic for friends
│   │   │   • send_request(), accept_request()
│   │   │
│   │   ├── message_service.py
│   │   │   • Message operations
│   │   │
│   │   ├── match_service.py
│   │   │   • Matchmaking queue
│   │   │   → BACKEND_FILE_ROUTES.md → Services
│   │   │
│   │   └── ...
│   │
│   └── api/routes/ ★
│       ├── auth.py
│       │   • POST /auth/signup
│       │   • POST /auth/login
│       │   • GET /auth/me
│       │   → BACKEND_FILE_ROUTES.md → Routes
│       │   → BACKEND_DETAILED.md → Auth
│       │
│       ├── friends.py
│       │   • POST /friends/request
│       │   • POST /friends/accept
│       │   • GET /friends/list
│       │   → BACKEND_FILE_ROUTES.md → Friends
│       │   → BACKEND_DETAILED.md → Friends
│       │
│       ├── messages.py
│       │   • POST /messages
│       │   • GET /messages/{conversation_id}
│       │   → BACKEND_FILE_ROUTES.md → Messages
│       │   → BACKEND_DETAILED.md → Messages
│       │
│       ├── progression_actions.py
│       │   • POST /progression/start_stage
│       │   • POST /progression/complete
│       │   → BACKEND_FILE_ROUTES.md → Progression
│       │   → BACKEND_DETAILED.md → Progression
│       │
│       ├── matchmaking.py
│       │   • POST /matchmaking/join
│       │   • POST /matchmaking/leave
│       │   → BACKEND_FILE_ROUTES.md → Matchmaking
│       │   → BACKEND_DETAILED.md → Matchmaking
│       │
│       ├── ws.py ★
│       │   • WebSocket /ws endpoint
│       │   • Message routing
│       │   → BACKEND_FILE_ROUTES.md → WebSocket
│       │   → BACKEND_DETAILED.md → WebSocket
│       │
│       └── leaderboard.py
│           • GET /leaderboard
│           → BACKEND_DETAILED.md → Leaderboard
│
├── alembic/ ★
│   ├── env.py
│   │   • Alembic configuration
│   │
│   ├── versions/
│   │   ├── 00ea5baf73f1_add_admin_role.py
│   │   ├── 20260308_add_social_chat_tables.py
│   │   └── ... (migration files)
│   │   → BACKEND_FILE_MODELS.md → Migrations
│   │
│   └── alembic.ini
│       • Alembic config file
│
├── requirements.txt ★
│   • Python dependencies
│   → BACKEND_DETAILED.md → Setup
│
└── Dockerfile ★
    • Container image
    → DEVOPS_GUIDE.md
```

**★** = Fichiers clés à comprendre en priorité

---

## 💡 Patterns Clés Expliqués

### Pattern 1: Router Organization
```python
# Routes by domain
auth/auth.py          # Includes auth_signup.py, auth_login.py, etc
friends/friends.py    # Includes friends_list.py, friends_actions.py, etc
messages.py           # Solo file for messages
progression/...       # Directory for progression endpoints

# In main.py
app.include_router(auth.router)
app.include_router(friends.router)
# etc.
```
→ [BACKEND_FILE_ROUTES.md → Routes Structure](#routes)

### Pattern 2: Services + Routes Separation
```python
# services/friend_service.py
class FriendService:
    def send_request(self, from_user_id, to_user_id):
        # Business logic

# routes/friends.py
@router.post("/request")
def send_request(current_user, db):
    service = FriendService(db)
    service.send_request(current_user.id, target_id)
    # Route handles HTTP + notifications
```
→ [BACKEND_FILE_ROUTES.md → Services](#services)

### Pattern 3: Dependency Injection
```python
@app.get("/profile")
def get_profile(
    current_user: User = Depends(get_current_user),  # ← Auto-injected
    db: Session = Depends(get_db)  # ← Auto-injected
):
    # current_user and db already loaded/verified
    pass
```
→ [BACKEND_FILE_MAIN.md → Dependencies](#dependencies)

### Pattern 4: Stateless Auth with JWT
```
No session storage in memory
Each request:
1. Client sends JWT in Authorization header
2. Server verifies signature with SECRET_KEY
3. Server decodes and loads User from DB
4. Stateless = scalable = can run multiple servers
```
→ [BACKEND_FILE_MAIN.md → Stateless](#stateless)

### Pattern 5: Relationships with Cascade
```python
class User(Base):
    # If User deleted → all GameResults auto-deleted
    game_results = relationship("GameResult", cascade="all, delete-orphan")
```
→ [BACKEND_FILE_MODELS.md → Relations](#relations)

---

## 🚀 Quick Start: Ajouter une Feature

### Example: Ajouter endpoint friend search

**Step 1: Create Service**
```python
# services/friend_service.py
def search_users(self, query: str):
    return self.db.query(User).filter(
        User.username.ilike(f"%{query}%")
    ).limit(10).all()
```

**Step 2: Create Route**
```python
# routes/friends.py
@router.get("/search")
def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = FriendService(db)
    users = service.search_users(q)
    return {"results": users}
```

**Step 3: Add to main.py** (if new router)
```python
app.include_router(friends.router)
```

**Done!** Endpoint works immediately.

→ [BACKEND_DETAILED.md → Add Endpoint](#add-endpoint)

---

## 📞 Support

Pour questions détaillées:
- **Auth**: [BACKEND_FILE_MAIN.md](#security)
- **Database**: [BACKEND_FILE_MODELS.md](#models)
- **Routes**: [BACKEND_FILE_ROUTES.md](#routes)
- **Frontend**: [FRONTEND_DETAILED.md](#frontend)
- **DevOps**: [DEVOPS_GUIDE.md](#devops)

