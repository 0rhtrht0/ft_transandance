# Architecture Complète - Transcendence Labyrinth

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vue 3 + Vite)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Router (Auth → Menu → Ingame → Maze → Social → Legal)    │ │
│  │  • ChatWidget (REST + WS)                                  │ │
│  │  • Activity Feed (Persistent Notifications)                │ │
│  │  • Game Engine (Canvas 2D)                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                    HTTP + WebSocket                              │
│                              │                                    │
└─────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
┌───────▼────────────────────────────────┐   ┌──────▼──────────────┐
│  BACKEND API (FastAPI + Starlette)    │   │  WEBSOCKET MANAGER  │
│  ┌─────────────────────────────────┐  │   │  ┌────────────────┐ │
│  │ Routes HTTP                     │  │   │  │ Rooms/Lobbies  │ │
│  │ • /api/auth/* (JWT)             │  │   │  │ • Matchmaking  │ │
│  │ • /api/friends/* (CRUD)         │  │   │  │ • Game Rooms   │ │
│  │ • /api/messages/* (Chat)        │  │   │  │ • Chat         │ │
│  │ • /api/progression/* (Levels)   │  │   │  │ • Notifications│ │
│  │ • /api/matchmaking/*            │  │   │  └────────────────┘ │
│  │ • /api/game_history/*           │  │   │                     │
│  │ • /api/leaderboard/*            │  │   │ Real-time Events    │
│  │ • /api/profile/*                │  │   │ (State Sync)        │
│  └─────────────────────────────────┘  │   │                     │
│                                        │   └─────────────────────┘
│  ┌─────────────────────────────────┐  │
│  │ Business Logic (Services)       │  │
│  │ • AuthService                   │  │
│  │ • FriendService                 │  │
│  │ • MessageService                │  │
│  │ • ProgressionService            │  │
│  │ • GameHistoryService            │  │
│  │ • MatchmakingService            │  │
│  └─────────────────────────────────┘  │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ Data Layer (SQLAlchemy)         │  │
│  │ • User, Profile                 │  │
│  │ • Friendship, FriendRequest     │  │
│  │ • Message, Conversation         │  │
│  │ • StageProgress                 │  │
│  │ • GameResult, GameHistory       │  │
│  │ • Notification                  │  │
│  └─────────────────────────────────┘  │
└────────────────────────────────────────┘
        │
        │  SQL
        │
┌───────▼──────────┐
│   PostgreSQL     │
│  (Alembic)       │
└──────────────────┘
```

## Communication Flows

### 1. Authentification
```
Client (Frontend)
    │
    ├─→ POST /api/auth/signup {email, username, password}
    │   └─→ Response: JWT token + user_id
    │
    ├─→ POST /api/auth/login {email, password}
    │   └─→ Response: JWT token + user_id
    │
    └─→ GET /api/auth/me (with Authorization: Bearer <token>)
        └─→ Response: User profile data
```

### 2. Système d'Amis
```
Client A                           Client B
    │                                 │
    ├─→ POST /api/friends/request     │
    │   {user_id_b: B}                │
    │   └─→ FriendRequest created     │
    │                                 │
    │                      ◄─ Notification WS
    │                                 │
    │                    Client B accepte
    │                                 │
    │   ◄─────────────────────────────┤
    │   POST /api/friends/accept
    │   {request_id: ...}
    │   └─→ Friendship created
    │                                 │
    ├─→ GET /api/friends/list         │
    │   └─→ List of Friend objects    │
```

### 3. Chat en Temps Réel
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  REST Layer (Historique)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ GET /api/messages/conversations                     │   │
│  │ POST /api/messages {recipient_id, body}            │   │
│  │ GET /api/messages/{conversation_id}                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ▲                                   │
│                          │                                   │
│                          │ (Load history)                   │
│                          │                                   │
├──────────────────────────┼─────────────────────────────────┤
│                          │                                   │
│  WebSocket Layer (Real-time)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ /ws?token=<jwt>                                     │   │
│  │                                                     │   │
│  │ Client → Server: message.send                      │   │
│  │ └─→ {recipient_id, body, timestamp}              │   │
│  │                                                     │   │
│  │ Server → Client: message.received                 │   │
│  │ └─→ {sender_id, body, timestamp}                │   │
│  │                                                     │   │
│  │ Server → All: message.broadcast                   │   │
│  │ └─→ Message saved to DB                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4. Système de Matchmaking & Jeu Multijoueur
```
Client A (Facile)               Client B (Facile)
    │                               │
    ├─→ POST /api/matchmaking/join  │
    │   {difficulty: "facile"}      │
    │                               │
    │   Queue: [{user_A}]           │
    │                               ├─→ POST /api/matchmaking/join
    │                               │   {difficulty: "facile"}
    │                               │
    │                    Queue: [{user_A}, {user_B}] ✓ Match!
    │                               │
    │ ◄──────────── Match Found ─────┤
    │ Response: room_id, seed        │
    │ ◄──────────── WS room init ────┤
    │                               │
    ├─→ WebSocket /ws?room=<id>    ├─→ WebSocket /ws?room=<id>
    │   (Start syncing game state)   │   (Start syncing game state)
    │                               │
    │   ╔═════════════════════════════╗
    │   ║  Real-time Game Sync       ║
    │   ║  • Player positions        ║
    │   ║  • Collectibles            ║
    │   ║  • Damage/Health           ║
    │   ║  • Game events             ║
    │   ╚═════════════════════════════╝
    │                               │
    └─────────→ Game Ends ←─────────┘
        POST /api/game_results
        {players: [{id, score, ...}], winner: ...}
        └─→ GameResult + GameHistory saved
```

### 5. Progression Utilisateur (Étapes/Difficultés)
```
User selects difficulty "moyen" + stage 3
         │
         ├─→ POST /api/progression/start_stage
         │   {difficulty: "moyen", stage: 3}
         │   └─→ Checks user level, returns game seed
         │
         ├─→ Stores in localStorage
         │   • bh_game_difficulty = "moyen"
         │   • bh_game_stage = 3
         │
         ├─→ Navigate to /ingame?difficulty=moyen&stage=3
         │
         ├─→ GameScene initializes with:
         │   • Seed for procedural generation
         │   • Difficulty modifiers (speed, enemies, etc.)
         │   • Stage-specific rules
         │
         └─→ POST /api/progression/complete_stage
             {difficulty, stage, score, time}
             └─→ StageProgress updated
```

### 6. Historique de Jeu & Leaderboard
```
User plays game (solo or multiplayer)
         │
         └─→ POST /api/game_results
             {
               players: [{id, score, time, ...}],
               winner_id: ...,
               difficulty: ...,
               stage: ...,
               is_multiplayer: true/false
             }
             └─→ Saves GameResult + GameHistory + updates leaderboard
```

## Flux Complet: Login → Jeu Solo → Chat → Amis

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. AUTHENTIFICATION                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User inputs email/password on /auth                               │
│  ↓                                                                  │
│  Frontend: POST /api/auth/login                                    │
│  ↓                                                                  │
│  Backend: Verify password, generate JWT                            │
│  ↓                                                                  │
│  Frontend: localStorage.setItem("access_token", token)             │
│  Frontend: Emit 'auth:updated'                                     │
│  ↓                                                                  │
│  Router: Navigate to /menu                                         │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. MENU PRINCIPAL                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  App.vue mounts:                                                   │
│  - ChatWidget (connects to WS)                                     │
│  - NotificationsWidget (listens to notifications)                  │
│  ↓                                                                  │
│  User selects:                                                     │
│  • Difficulty (facile, moyen, difficile)                          │
│  • Stage (1, 2, 3, ...)                                           │
│  ↓                                                                  │
│  Frontend: POST /api/progression/start_stage                       │
│  Backend: Returns seed + game config                               │
│  ↓                                                                  │
│  localStorage: Store difficulty + stage                            │
│  Router: Navigate to /ingame?difficulty=X&stage=Y                  │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. JEU SOLO (ou Multijoueur via Matchmaking)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  IngameView loads MazeView                                         │
│  ↓                                                                  │
│  GameScene initializes with seed                                   │
│  Canvas renders maze + player                                      │
│  ↓                                                                  │
│  Player moves, collects items, survives                            │
│  ↓                                                                  │
│  Win condition met → GameoverView                                  │
│  ↓                                                                  │
│  POST /api/game_results {score, time, difficulty, stage}          │
│  Backend: Saves result, updates leaderboard                        │
│  ↓                                                                  │
│  VictoryView: Display score + ranking                              │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. CHAT PERSISTANT (à tout moment)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ChatWidget (dans App.vue):                                        │
│  ↓                                                                  │
│  GET /api/messages/conversations (charge historique)              │
│  ↓                                                                  │
│  WebSocket /ws (temps réel)                                        │
│  ↓                                                                  │
│  User selects friend to chat                                       │
│  ↓                                                                  │
│  POST /api/messages {recipient_id, body}                           │
│  WS: message.received → Other client sees it instantly            │
│  ↓                                                                  │
│  Repeat (real-time interaction)                                    │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. GESTION DES AMIS                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  FriendsView / Friends page:                                       │
│  ↓                                                                  │
│  GET /api/friends/list (affiche amis actuels)                      │
│  GET /api/friends/requests (demandes en attente)                   │
│  ↓                                                                  │
│  User sends request:                                               │
│  POST /api/friends/request {user_id}                               │
│  Backend: Creates FriendRequest                                    │
│  ↓                                                                  │
│  Other user receives notification (WS):                            │
│  notification.new → {type: 'friend_request', from_user_id: ...}  │
│  ↓                                                                  │
│  Other user accepts:                                               │
│  POST /api/friends/accept {request_id}                             │
│  Backend: Friendship created                                       │
│  ↓                                                                  │
│  Both users see each other in friends list                         │
│  Can now chat directly                                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Technologies Stack

### Backend
- **Framework**: FastAPI + Starlette (async Python web framework)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Migrations**: Alembic
- **Authentication**: JWT (python-jose) + Password Hashing (passlib/argon2)
- **Real-time**: WebSocket (native FastAPI support)
- **Validation**: Pydantic schemas
- **External API**: Google OAuth verification (httpx)

### Frontend
- **Build Tool**: Vite (fast ES module bundler)
- **Framework**: Vue 3 (reactive UI framework)
- **Routing**: Vue Router 4 (SPA navigation)
- **Rendering**: Canvas 2D (game engine)
- **HTTP Client**: Native Fetch API
- **WebSocket**: Native Browser WebSocket API
- **Storage**: localStorage (JWT token persistence)
- **Testing**: Playwright (E2E), Jest (unit)

### Infrastructure
- **Docker**: Containerization (backend + postgres)
- **Caddy**: Reverse proxy / TLS termination
- **Node.js Legacy**: Gateway server for real-time (optional fallback)

## Concepts Clés

### 1. **JWT Authentication**
- User login → Backend generates JWT token
- Token stored in localStorage
- Every HTTP request includes: `Authorization: Bearer <token>`
- WebSocket connections authenticated via `?token=<jwt>` query param

### 2. **WebSocket Real-time Layer**
- Path: `/ws?token=<jwt>`
- Manages: chat messages, notifications, game room state, friend requests
- Runs persistently while app is open
- Handles disconnections & reconnections

### 3. **Game Seed & Procedural Generation**
- When starting a game, server returns a `seed` value
- Client uses this seed to generate the exact same maze
- Ensures consistency between players in multiplayer

### 4. **Matchmaking Queue**
- Queues per difficulty: facile, moyen, difficile
- When 2+ players in same queue → Match created
- Game room created with unique room_id

### 5. **Stage Progression**
- Each user has StageProgress per difficulty
- Tracks: current stage, completion status, best score/time
- Starting game checks permissions (must complete previous stages)

## Sécurité

- **CORS**: Configurable allow-list
- **HTTPS**: Enforced via Caddy (in production)
- **CSRF Protection**: Not needed (SPA + JWT)
- **Password Hashing**: Argon2 (slow hash)
- **Rate Limiting**: Login endpoint rate-limited
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, etc.
- **Input Validation**: Pydantic schemas

## Scalabilité

- Stateless API design (can run multiple FastAPI instances)
- Single WebSocket manager (per instance; use Redis for multi-instance)
- PostgreSQL for persistence (scales with replication)
- Frontend is static (Vite build) → Can be served by CDN
