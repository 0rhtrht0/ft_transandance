# Backend Documentation Détaillée

## Table des matières
1. [Structure du Projet](#structure)
2. [Setup Local](#setup)
3. [API Endpoints](#endpoints)
4. [Services Métier](#services)
5. [Modèles de Données](#modeles)
6. [Exemples d'Utilisation](#exemples)
7. [WebSocket](#websocket)
8. [Migrations](#migrations)

---

## Structure du Projet {#structure}

```
backend/python/
├── app/
│   ├── __init__.py              # App initialization
│   ├── main.py                  # FastAPI app + middleware setup
│   ├── dependencies.py          # Dependency injection
│   │
│   ├── api/
│   │   └── routes/              # All HTTP endpoints
│   │       ├── auth.py                 # Login, Signup, OAuth
│   │       ├── auth_tokens.py          # JWT generation
│   │       ├── auth_rate_limit.py      # Login rate limiting
│   │       ├── friends.py              # Friend management
│   │       ├── friends_list.py         # List/remove friends
│   │       ├── friends_request_actions.py  # Accept/reject
│   │       ├── messages.py             # Chat messages REST
│   │       ├── profile.py              # User profile CRUD
│   │       ├── progression.py          # Game stages/difficulty
│   │       ├── game_history.py         # Game results + history
│   │       ├── game_results.py         # Save game outcomes
│   │       ├── matchmaking.py          # Matchmaking queue
│   │       ├── rooms.py                # Game rooms management
│   │       ├── leaderboard.py          # Rankings
│   │       ├── ws.py                   # WebSocket handler
│   │       └── ws_notifications.py     # WS notification events
│   │
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── user.py                    # User account
│   │   ├── profile.py                 # User profile (extended)
│   │   ├── friendship.py              # Friend relationship
│   │   ├── friend_request.py          # Friend request (pending)
│   │   ├── conversation.py            # Chat conversation
│   │   ├── message.py                 # Chat message
│   │   ├── stage_progress.py          # User progress per stage
│   │   ├── game_result.py             # Single game result
│   │   ├── game_history.py            # Aggregated game history
│   │   ├── game_players.py            # Multiplayer game players
│   │   ├── notification.py            # User notifications
│   │   └── score.py                   # Leaderboard entry
│   │
│   ├── schemas/                 # Pydantic validation schemas
│   │   ├── user.py                    # User request/response
│   │   ├── message.py                 # Message schemas
│   │   ├── game.py                    # Game/matchmaking schemas
│   │   ├── common.py                  # Shared (e.g., RootResponse)
│   │   └── ...
│   │
│   ├── services/                # Business logic
│   │   ├── connection_manager.py      # WebSocket connection mgmt
│   │   ├── message_service.py         # Message operations
│   │   ├── auth_service.py            # Auth business logic
│   │   ├── friend_service.py          # Friend operations
│   │   ├── room_manager.py            # Game room management
│   │   ├── matchmaking_service.py     # Queue + matching logic
│   │   └── ...
│   │
│   ├── core/                    # Core utilities & config
│   │   ├── config.py                  # Settings (env vars)
│   │   ├── security.py                # Password hashing + JWT
│   │   ├── security_auth.py           # get_current_user logic
│   │   ├── errors.py                  # Error handling
│   │   ├── exceptions.py              # Custom exceptions
│   │   ├── ws_manager.py              # WebSocket manager
│   │   ├── room_manager.py            # Game room state
│   │   └── ...
│   │
│   └── alembic/                 # Database migrations
│       ├── env.py
│       ├── script.py.mako
│       └── versions/                 # Migration files
│           ├── 00ea5baf73f1_add_admin_role.py
│           ├── 20260308_add_social_chat_tables.py
│           └── ...
│
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Container definition
├── alembic.ini                  # Alembic config
└── CHAT_API_REFERENCE.py       # Chat API examples
```

---

## Setup Local {#setup}

### Prérequis
- Python 3.9+
- PostgreSQL 12+
- pip ou conda

### Étapes

```bash
# 1. Clone repo + cd backend
cd backend/python

# 2. Créer venv
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# OU
.venv\Scripts\activate  # Windows

# 3. Installer dépendances
pip install -r requirements.txt

# 4. Créer .env (copie de .env.example)
cp .env.example .env
# Éditer DATABASE_URL et SECRET_KEY

# 5. Appliquer migrations
alembic upgrade head

# 6. Lancer serveur
python -m uvicorn app.main:app --reload

# 7. Vérifier
curl http://localhost:8000/health
# Accéder à docs interactif
open http://localhost:8000/docs
```

### Variables d'Environnement Clés
```env
DATABASE_URL=postgresql://user:pass@localhost/dbname
SECRET_KEY=your-super-secret-key
JWT_ALGORITHM=HS256
CORS_ALLOW_ORIGINS=["http://localhost:5173"]
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## API Endpoints {#endpoints}

### Authentification

#### 1. Signup (Enregistrement)
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "myusername",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user_id": 42,
  "username": "myusername"
}
```

#### 2. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user_id": 42
}
```

#### 3. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": 42,
  "email": "user@example.com",
  "username": "myusername",
  "is_active": true,
  "profile": {
    "bio": "I love mazes!",
    "avatar_url": "/uploaded_avatars/user42.png"
  }
}
```

---

### Profil Utilisateur

#### 1. Get Profile
```http
GET /api/profile/{user_id}
```

**Response (200 OK):**
```json
{
  "user_id": 42,
  "username": "myusername",
  "bio": "Maze enthusiast",
  "avatar_url": "/uploaded_avatars/user42.png",
  "is_online": true,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### 2. Update Profile
```http
PUT /api/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "bio": "Updated bio",
  "avatar_file": "<file_binary>"  // multipart/form-data if uploading
}
```

**Response (200 OK):**
```json
{
  "id": 42,
  "bio": "Updated bio",
  "avatar_url": "/uploaded_avatars/user42_new.png"
}
```

---

### Amis (Friends)

#### 1. Envoyer une Demande d'Ami
```http
POST /api/friends/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": 99
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "from_user_id": 42,
  "to_user_id": 99,
  "status": "pending",
  "created_at": "2024-03-15T14:20:00Z"
}
```

#### 2. Accepter Demande d'Ami
```http
POST /api/friends/accept
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_id": 1
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "user_id_a": 42,
  "user_id_b": 99,
  "created_at": "2024-03-15T14:21:00Z"
}
```

#### 3. Rejeter Demande d'Ami
```http
POST /api/friends/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_id": 1
}
```

**Response (200 OK):**
```json
{ "message": "Friend request rejected" }
```

#### 4. Annuler Demande d'Ami (Non-sent)
```http
POST /api/friends/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_id": 1
}
```

**Response (200 OK):**
```json
{ "message": "Friend request cancelled" }
```

#### 5. Lister Amis
```http
GET /api/friends/list
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "friends": [
    {
      "id": 99,
      "username": "friend1",
      "avatar_url": "/uploaded_avatars/user99.png",
      "is_online": true
    },
    {
      "id": 88,
      "username": "friend2",
      "avatar_url": "/uploaded_avatars/user88.png",
      "is_online": false
    }
  ]
}
```

#### 6. Lister Demandes en Attente
```http
GET /api/friends/requests
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "incoming": [
    {
      "id": 5,
      "from_user": {
        "id": 77,
        "username": "user77",
        "avatar_url": "/uploaded_avatars/user77.png"
      },
      "created_at": "2024-03-14T09:00:00Z"
    }
  ],
  "outgoing": [
    {
      "id": 6,
      "to_user": {
        "id": 66,
        "username": "user66"
      },
      "created_at": "2024-03-15T11:00:00Z"
    }
  ]
}
```

#### 7. Supprimer Ami
```http
DELETE /api/friends/{friend_user_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{ "message": "Friendship removed" }
```

---

### Messages / Chat

#### 1. Envoyer Message
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipient_id": 99,
  "body": "Hey, how are you?"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "sender_id": 42,
  "recipient_id": 99,
  "body": "Hey, how are you?",
  "timestamp": "2024-03-15T14:30:00Z",
  "is_read": false
}
```

#### 2. Lister Conversations
```http
GET /api/messages/conversations
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "conversations": [
    {
      "conversation_id": 1,
      "other_user": {
        "id": 99,
        "username": "friend1",
        "avatar_url": "/uploaded_avatars/user99.png"
      },
      "last_message": "Hey, how are you?",
      "last_message_timestamp": "2024-03-15T14:30:00Z",
      "unread_count": 2
    }
  ]
}
```

#### 3. Récupérer Messages d'une Conversation
```http
GET /api/messages/{conversation_id}?limit=50&offset=0
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": 1,
      "sender_id": 42,
      "body": "Hey, how are you?",
      "timestamp": "2024-03-15T14:30:00Z"
    },
    {
      "id": 2,
      "sender_id": 99,
      "body": "Great! You?",
      "timestamp": "2024-03-15T14:31:00Z"
    }
  ]
}
```

---

### Progression (Stages & Difficulty)

#### 1. Démarrer une Étape
```http
POST /api/progression/start_stage
Authorization: Bearer <token>
Content-Type: application/json

{
  "difficulty": "moyen",
  "stage": 3
}
```

**Response (200 OK):**
```json
{
  "seed": "A1B2C3D4",
  "difficulty": "moyen",
  "stage": 3,
  "game_url": "/ingame?difficulty=moyen&stage=3"
}
```

#### 2. Compléter une Étape
```http
POST /api/progression/complete_stage
Authorization: Bearer <token>
Content-Type: application/json

{
  "difficulty": "moyen",
  "stage": 3,
  "score": 1500,
  "time_seconds": 120
}
```

**Response (200 OK):**
```json
{
  "stage": 3,
  "difficulty": "moyen",
  "is_completed": true,
  "best_score": 1500,
  "best_time": 120,
  "next_stage_unlocked": true
}
```

#### 3. Récupérer Progression Utilisateur
```http
GET /api/progression
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "user_id": 42,
  "stages_progress": {
    "facile": {
      "stage_1": {"is_completed": true, "best_score": 1000, "best_time": 85},
      "stage_2": {"is_completed": true, "best_score": 1200, "best_time": 95},
      "stage_3": {"is_completed": false}
    },
    "moyen": {
      "stage_1": {"is_completed": true, "best_score": 900, "best_time": 110}
    }
  }
}
```

---

### Matchmaking

#### 1. Rejoindre File de Matchmaking
```http
POST /api/matchmaking/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "difficulty": "moyen"
}
```

**Response (202 Accepted ou 200 OK si match trouvé):**

Si pas de match (queue):
```json
{
  "status": "waiting",
  "queue_position": 2,
  "difficulty": "moyen"
}
```

Si match trouvé:
```json
{
  "status": "matched",
  "room_id": "room_abc123def456",
  "opponent": {
    "id": 77,
    "username": "player2",
    "avatar_url": "/uploaded_avatars/user77.png"
  },
  "seed": "X1Y2Z3W4",
  "difficulty": "moyen"
}
```

#### 2. Quitter File de Matchmaking
```http
POST /api/matchmaking/leave
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{ "message": "Left matchmaking queue" }
```

---

### Résultats & Historique de Jeu

#### 1. Sauvegarder Résultat de Jeu
```http
POST /api/game_results
Authorization: Bearer <token>
Content-Type: application/json

{
  "score": 2500,
  "time_seconds": 250,
  "difficulty": "moyen",
  "stage": 3,
  "is_multiplayer": false,
  "winner_id": 42
}
```

**Response (201 Created):**
```json
{
  "id": 101,
  "player_id": 42,
  "score": 2500,
  "time_seconds": 250,
  "difficulty": "moyen",
  "stage": 3,
  "is_multiplayer": false,
  "created_at": "2024-03-15T15:00:00Z"
}
```

#### 2. Récupérer Historique de Jeu
```http
GET /api/game_history?limit=20&offset=0
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "games": [
    {
      "id": 101,
      "score": 2500,
      "time_seconds": 250,
      "difficulty": "moyen",
      "stage": 3,
      "is_multiplayer": false,
      "created_at": "2024-03-15T15:00:00Z"
    },
    {
      "id": 100,
      "score": 1800,
      "time_seconds": 300,
      "difficulty": "facile",
      "stage": 2,
      "is_multiplayer": false,
      "created_at": "2024-03-15T14:00:00Z"
    }
  ],
  "total": 42
}
```

---

### Leaderboard

#### 1. Récupérer Top Joueurs (par Difficulté)
```http
GET /api/leaderboard?difficulty=moyen&limit=10
```

**Response (200 OK):**
```json
{
  "difficulty": "moyen",
  "rankings": [
    {
      "rank": 1,
      "user_id": 10,
      "username": "master_player",
      "avatar_url": "/uploaded_avatars/user10.png",
      "total_score": 50000,
      "games_played": 25
    },
    {
      "rank": 2,
      "user_id": 42,
      "username": "myusername",
      "avatar_url": "/uploaded_avatars/user42.png",
      "total_score": 45000,
      "games_played": 20
    }
  ]
}
```

---

## Services Métier {#services}

### AuthService
Responsable de l'authentification, JWT, vérification Google OAuth.

**Méthodes principales:**
- `register_user(email, username, password)` → User
- `login_user(email, password)` → JWT token
- `verify_google_token(token)` → User
- `refresh_token(refresh_token)` → New JWT

### FriendService
Gère les relations d'amitié et les demandes.

**Méthodes principales:**
- `send_friend_request(from_user_id, to_user_id)` → FriendRequest
- `accept_friend_request(request_id)` → Friendship
- `reject_friend_request(request_id)` → None
- `get_friends_list(user_id)` → [User]
- `remove_friend(user_id_a, user_id_b)` → None

### MessageService
Gère les messages et conversations.

**Méthodes principales:**
- `create_message(sender_id, recipient_id, body)` → Message
- `get_conversation_messages(user_id_a, user_id_b, limit, offset)` → [Message]
- `get_conversations(user_id)` → [Conversation]

### ProgressionService
Gère la progression du joueur par stage/difficultés.

**Méthodes principales:**
- `start_stage(user_id, difficulty, stage)` → {seed, game_url}
- `complete_stage(user_id, difficulty, stage, score, time)` → StageProgress
- `get_user_progression(user_id)` → {stages_progress}
- `unlock_next_stage(user_id, difficulty, stage)` → None

### GameHistoryService
Enregistre les résultats de jeu.

**Méthodes principales:**
- `save_game_result(player_id, score, time, difficulty, stage, is_multiplayer)` → GameResult
- `get_user_history(user_id, limit, offset)` → [GameResult]
- `get_leaderboard(difficulty, limit)` → [LeaderboardEntry]

---

## Modèles de Données {#modeles}

### User
```python
class User(Base):
    __tablename__ = "users"
    
    id: int (Primary Key)
    email: str (Unique, Not Null)
    username: str (Unique, Not Null)
    password_hash: str (Not Null)
    is_active: bool (Default: True)
    created_at: DateTime
    updated_at: DateTime
```

### Profile
```python
class Profile(Base):
    __tablename__ = "profiles"
    
    id: int (Primary Key)
    user_id: int (Foreign Key → User)
    bio: str (Optional)
    avatar_url: str (Optional)
    is_online: bool (Default: False)
    last_seen: DateTime
```

### Friendship
```python
class Friendship(Base):
    __tablename__ = "friendships"
    
    id: int (Primary Key)
    user_id_a: int (Foreign Key → User)
    user_id_b: int (Foreign Key → User)
    created_at: DateTime
    # Constraint: user_id_a < user_id_b (normalized)
```

### FriendRequest
```python
class FriendRequest(Base):
    __tablename__ = "friend_requests"
    
    id: int (Primary Key)
    from_user_id: int (Foreign Key → User)
    to_user_id: int (Foreign Key → User)
    status: str (Enum: pending, accepted, rejected)
    created_at: DateTime
    updated_at: DateTime
```

### Conversation
```python
class Conversation(Base):
    __tablename__ = "conversations"
    
    id: int (Primary Key)
    user_id_a: int (Foreign Key → User)
    user_id_b: int (Foreign Key → User)
    created_at: DateTime
    updated_at: DateTime
```

### Message
```python
class Message(Base):
    __tablename__ = "messages"
    
    id: int (Primary Key)
    conversation_id: int (Foreign Key → Conversation)
    sender_id: int (Foreign Key → User)
    body: str (Not Null)
    is_read: bool (Default: False)
    created_at: DateTime
```

### StageProgress
```python
class StageProgress(Base):
    __tablename__ = "stage_progress"
    
    id: int (Primary Key)
    user_id: int (Foreign Key → User)
    difficulty: str (facile, moyen, difficile)
    stage: int
    is_completed: bool (Default: False)
    best_score: int
    best_time: int (seconds)
    attempts: int
    completed_at: DateTime (Optional)
```

### GameResult
```python
class GameResult(Base):
    __tablename__ = "game_results"
    
    id: int (Primary Key)
    player_id: int (Foreign Key → User)
    score: int
    time_seconds: int
    difficulty: str
    stage: int
    is_multiplayer: bool
    room_id: str (Optional)
    opponent_id: int (Optional, Foreign Key → User)
    winner_id: int (Optional, Foreign Key → User)
    created_at: DateTime
```

### GameHistory
```python
class GameHistory(Base):
    __tablename__ = "game_history"
    
    id: int (Primary Key)
    room_id: str (Unique)
    difficulty: str
    stage: int
    seed: str
    created_at: DateTime
    completed_at: DateTime (Optional)
    # Relationship to GamePlayers (list of players in this game)
```

### GamePlayers
```python
class GamePlayers(Base):
    __tablename__ = "game_players"
    
    id: int (Primary Key)
    game_history_id: int (Foreign Key → GameHistory)
    user_id: int (Foreign Key → User)
    score: int (Final score)
    time_survived: int (seconds)
    is_winner: bool
```

---

## Exemples d'Utilisation {#exemples}

### Exemple 1: Flux Complet d'Amitié

```python
# 1. User A sends friend request to User B
POST /api/friends/request
{
  "user_id": 99  # User B's ID
}
# Response: FriendRequest created with id=1

# 2. Server sends WS notification to User B
ws → notification.friend_request
{
  "type": "friend_request",
  "from_user_id": 42,
  "from_username": "myusername",
  "request_id": 1
}

# 3. User B accepts request
POST /api/friends/accept
{
  "request_id": 1
}
# Response: Friendship created

# 4. Both users can now see each other in friend list
GET /api/friends/list
# Returns: [User 99, ...]
```

### Exemple 2: Chat en Temps Réel

```python
# 1. Get conversation history (REST)
GET /api/messages/conversations
# Response: [{conversation_id: 1, other_user: {...}}]

GET /api/messages/1?limit=20
# Response: [{id: 1, sender_id: 42, body: "Hello"}, ...]

# 2. Connect to WebSocket
ws://localhost:8000/ws?token=<jwt>

# 3. Send message via WebSocket (real-time)
ws → message.send
{
  "recipient_id": 99,
  "body": "How are you?"
}

# 4. Receive on other end (if connected)
ws ← message.received
{
  "sender_id": 42,
  "body": "How are you?",
  "timestamp": "2024-03-15T15:00:00Z"
}

# 5. Message automatically persisted to DB
```

### Exemple 3: Progression & Jeu Solo

```python
# 1. User selects difficulty "moyen", stage 2
POST /api/progression/start_stage
{
  "difficulty": "moyen",
  "stage": 2
}
# Response:
# {
#   "seed": "SEED1234",
#   "difficulty": "moyen",
#   "stage": 2
# }

# 2. Frontend uses seed to initialize game
# → GameScene generates maze with seed SEED1234

# 3. User plays and completes stage
POST /api/progression/complete_stage
{
  "difficulty": "moyen",
  "stage": 2,
  "score": 1800,
  "time_seconds": 150
}
# Response:
# {
#   "is_completed": true,
#   "best_score": 1800,
#   "best_time": 150,
#   "next_stage_unlocked": true
# }

# 4. Can now start stage 3
POST /api/progression/start_stage
{
  "difficulty": "moyen",
  "stage": 3
}
# Works! (stage 2 was completed)
```

### Exemple 4: Matchmaking & Jeu Multijoueur

```python
# Player A joins matchmaking (moyen difficulty)
POST /api/matchmaking/join
{
  "difficulty": "moyen"
}
# Response: {"status": "waiting", "queue_position": 1}

# Player B joins same queue
POST /api/matchmaking/join
{
  "difficulty": "moyen"
}
# Response: 
# {
#   "status": "matched",
#   "room_id": "room_xyz789",
#   "opponent": {player A},
#   "seed": "SEED5678"
# }

# Both players get matched notification via WS
ws ← game.matched
{
  "room_id": "room_xyz789",
  "opponent_id": 42,
  "seed": "SEED5678"
}

# Both connect to game room WebSocket
ws://localhost:8000/ws?room=room_xyz789&token=<jwt>

# Game state sync (real-time)
ws → game.update
{
  "player_a": {"x": 100, "y": 200, "health": 100},
  "player_b": {"x": 250, "y": 180, "health": 95}
}

# Game completes
POST /api/game_results
{
  "score": 2500,
  "time_seconds": 300,
  "difficulty": "moyen",
  "is_multiplayer": true,
  "winner_id": 42
}
```

### Exemple 5: Leaderboard & Historique

```python
# Get user's game history
GET /api/game_history?limit=10&offset=0
# Response: [
#   {id: 101, score: 2500, difficulty: "moyen", stage: 3, ...},
#   {id: 100, score: 1800, difficulty: "facile", stage: 2, ...}
# ]

# Get global leaderboard (moyen difficulty)
GET /api/leaderboard?difficulty=moyen&limit=10
# Response:
# {
#   "rankings": [
#     {"rank": 1, "username": "master", "total_score": 50000},
#     {"rank": 2, "username": "myusername", "total_score": 45000}
#   ]
# }
```

---

## WebSocket {#websocket}

### Connexion

```javascript
const token = localStorage.getItem("access_token");
const ws = new WebSocket(
  `ws://localhost:8000/ws?token=${token}&room=${roomId}`
);
```

### Événements WS (Server → Client)

#### Notifications
```json
{
  "type": "notification",
  "event": "friend_request",
  "data": {
    "from_user_id": 42,
    "request_id": 1
  }
}
```

#### Message Chat
```json
{
  "type": "message",
  "event": "message.received",
  "data": {
    "sender_id": 99,
    "body": "Hey!",
    "timestamp": "2024-03-15T15:00:00Z"
  }
}
```

#### Game Room Join
```json
{
  "type": "game",
  "event": "room.join",
  "data": {
    "room_id": "room_xyz",
    "players": [42, 99],
    "seed": "SEED1234"
  }
}
```

#### Game State Sync
```json
{
  "type": "game",
  "event": "game.update",
  "data": {
    "timestamp": 1234567890,
    "states": {
      "42": {"x": 100, "y": 200, "health": 95},
      "99": {"x": 150, "y": 250, "health": 100}
    }
  }
}
```

### Événements WS (Client → Server)

#### Send Message
```json
{
  "type": "message",
  "event": "message.send",
  "data": {
    "recipient_id": 99,
    "body": "How are you?"
  }
}
```

#### Send Game Action
```json
{
  "type": "game",
  "event": "game.action",
  "data": {
    "action": "move",
    "direction": "up",
    "timestamp": 1234567890
  }
}
```

---

## Migrations {#migrations}

### Créer Migration

```bash
cd backend/python
alembic revision --autogenerate -m "Add avatar to profiles"
```

Cela crée un fichier dans `alembic/versions/` avec les changements détectés.

### Appliquer Migrations

```bash
# Upgrade to latest
alembic upgrade head

# Upgrade to specific version
alembic upgrade abc123def456

# Downgrade to specific version
alembic downgrade abc123def456

# View current version
alembic current

# View migration history
alembic history
```

### Exemple Migration

```python
# alembic/versions/20260315_add_avatar_to_profiles.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column(
        'profiles',
        sa.Column('avatar_url', sa.String, nullable=True)
    )

def downgrade():
    op.drop_column('profiles', 'avatar_url')
```

---

## Configuration & Déploiement

### Environment Variables
```bash
# Core
DATABASE_URL=postgresql://user:pass@host/dbname
SECRET_KEY=your-super-secret-key
JWT_ALGORITHM=HS256

# CORS
CORS_ALLOW_ORIGINS=["http://localhost:5173", "https://app.example.com"]
CORS_ALLOW_CREDENTIALS=true

# External
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Logging
LOG_LEVEL=INFO
```

### Docker

```bash
# Build
docker build -t backend:latest backend/python

# Run
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e SECRET_KEY=... \
  backend:latest
```

### Production Checklist
- [ ] Change SECRET_KEY to a strong random value
- [ ] Set CORS_ALLOW_ORIGINS to production domains
- [ ] Enable HTTPS (via Caddy reverse proxy)
- [ ] Set DEBUG=False
- [ ] Use PostgreSQL replicas for redundancy
- [ ] Set up monitoring (logs, metrics)
- [ ] Enable rate limiting on all endpoints
- [ ] Set up backups for database
