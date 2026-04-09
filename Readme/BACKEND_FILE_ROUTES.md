# Guide Détaillé: Backend - Routes & Services

## Table des matières
1. [Structure Routes (api/routes)](#routes)
2. [Progression & Stages Expliqué](#progression)
3. [Friends System Expliqué](#friends)
4. [Messages & Chat Expliqué](#messages)
5. [Matchmaking & Game Rooms](#matchmaking)
6. [Services Métier](#services)
7. [WebSocket Manager](#websocket)

---

## Structure Routes (api/routes) {#routes}

### Architecture Générale

```
backend/python/app/api/routes/
├── auth/                      # Authentification
│   ├── auth_signup.py         # POST /auth/signup
│   ├── auth_login.py          # POST /auth/login
│   ├── auth_me.py             # GET /auth/me
│   └── auth.py                # Router principal
│
├── friends/                   # Système d'amis
│   ├── friends_list.py        # GET /friends/list
│   ├── friends_request_actions.py  # POST /friends/accept, reject
│   ├── friends_requests.py    # GET /friends/requests
│   └── friends.py             # Router principal
│
├── messages/                  # Chat
│   ├── messages.py            # POST, GET messages
│   └── ...
│
├── progression/               # Stages/Difficulty
│   ├── progression_actions.py # POST /progression/start, complete
│   ├── progression_reads.py   # GET /progression
│   └── ...
│
├── matchmaking.py             # POST /matchmaking/join, leave
├── rooms.py                   # Game rooms management
├── game_results.py            # Save game scores
├── game_history.py            # Get past games
├── leaderboard.py             # Rankings
├── ws.py                      # WebSocket endpoint
└── ws_notifications.py        # Notifications via WS
```

### Pattern: Router Principal

Chaque domaine (auth, friends, etc) a un `<domaine>.py` qui inclut tous les sub-routers:

```python
# friends.py
from fastapi import APIRouter
from app.api.routes.friends_list import router as list_router
from app.api.routes.friends_request_actions import router as actions_router

router = APIRouter(prefix="/api/friends", tags=["friends"])
router.include_router(list_router)
router.include_router(actions_router)
```

**Avantages:**
- Code organisé par domaine
- Facile à trouver/modifier endpoint
- Routers composables et testables indépendamment

---

## Progression & Stages Expliqué {#progression}

### Concept

Utilisateur progresse par **difficultés** (facile, moyen, difficile) et **étapes** (1, 2, 3, ...).

```
User 42
└── Difficulty: facile
    └── current_stage: 3  (a complété 1, 2. Can play 3. Cannot play 4)
└── Difficulty: moyen
    └── current_stage: 1  (locked, hasn't completed facile)
└── Difficulty: difficile
    └── current_stage: 1  (locked)
```

### Base de Données

```python
class StageProgress(Base):
    __tablename__ = "stage_progress"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    difficulty = Column(String)  # "facile", "moyen", "difficile"
    current_stage = Column(Integer, default=1)
    # current_stage = stage le plus haut que user peut jouer
    # (il a complété current_stage - 1)
```

### Endpoints Progression

#### 1. Start Stage

**Route:** `POST /api/progression/start_stage?difficulty=moyen&stage=2`

**Ce qui se passe:**

```python
def start_stage(
    difficulty: str,  # "moyen"
    stage: int,       # 2
    current_user: User,
    db: Session
):
    # 1. Valide que difficultét est valide
    validate_difficulty(difficulty)  # Vérifie "facile", "moyen", ou "difficile"
    
    # 2. Valide que stage est valide
    validate_stage(stage)  # Vérifie 1 <= stage <= 100
    
    # 3. Vérifie que user est autorisé à jouer cette stage
    if not can_play_stage(db, user_id=42, difficulty="moyen", stage=2):
        # User a pas complété moyen/1 → 403
        progress = get_or_create_progress(db, user_id=42, difficulty="moyen")
        # progress.current_stage = 1 (pas encore complété)
        raise HTTPException(
            status_code=403,
            detail=f"Stage 2 locked. Max playable: stage {progress.current_stage}"
        )
    
    # ✓ User autorisé
    return {
        "status": "ok",
        "difficulty": "moyen",
        "stage": 2,
        "message": "Stage 2 (moyen) ready to play"
    }
```

**Frontend utilise:**

```javascript
const response = await fetch(
  'http://localhost:8000/api/progression/start_stage?difficulty=moyen&stage=2',
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }
)

if (response.ok) {
  // Peut jouer stage 2
  navigate('/ingame?difficulty=moyen&stage=2')
} else {
  // Stage locked
  alert('Must complete stage 1 first')
}
```

#### 2. Complete Stage

**Route:** `POST /api/progression/complete`

**Body:**
```json
{
  "difficulty": "moyen",
  "stage": 2,
  "score": 1500,
  "time_ms": 120000
}
```

**Ce qui se passe:**

```python
def complete_stage(
    data: CompleteStageRequest,  # {difficulty, stage, score, time_ms}
    current_user: User,
    db: Session
):
    # 1. Valide input
    difficulty = validate_difficulty(data.difficulty)
    stage = validate_stage(data.stage)
    
    # 2. Charge progression de user
    progress = get_or_create_progress(
        db, 
        user_id=current_user.id, 
        difficulty="moyen"
    )
    # progress.current_stage = 2 (user était en train de jouer stage 2)
    
    # 3. Vérifie que user jouait bien cette stage
    if stage != progress.current_stage:
        # Tentative de tricher (complète stage 5 sans avoir fait 4)
        raise HTTPException(
            status_code=403,
            detail=f"Must complete stage {progress.current_stage} first"
        )
    
    # 4. Débloque la prochaine stage (si pas la dernière)
    if progress.current_stage < MAX_STAGES:
        progress.current_stage += 1
        # Stage 2 → 3
    
    # 5. Sauvegarde score dans GameResult
    game_result = GameResult(
        user_id=current_user.id,
        score=data.score,  # 1500
        result="victory",
        time_ms=data.time_ms,  # 120000
        level=stage,  # 2
        pace_label=f"moyen_2"
    )
    db.add(game_result)
    db.commit()
    
    # 6. Retourne progression updatée
    return StageProgressResponse(
        id=progress.id,
        user_id=progress.user_id,
        difficulty=progress.difficulty,
        current_stage=progress.current_stage  # 3
    )
```

**Frontend:**

```javascript
// Après que joueur complète stage
const result = await fetch(
  'http://localhost:8000/api/progression/complete',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      difficulty: 'moyen',
      stage: 2,
      score: 1500,
      time_ms: 120000
    })
  }
)

const data = await result.json()
// data.current_stage = 3

if (data.current_stage > 2) {
  alert('Next stage unlocked!')
  navigate('/menu')
}
```

#### 3. Get Progression

**Route:** `GET /api/progression`

**Response:**
```json
{
  "user_id": 42,
  "facile": {
    "current_stage": 5,
    "completed_at": "2024-03-15T10:30:00Z"
  },
  "moyen": {
    "current_stage": 2,
    "completed_at": null
  },
  "difficile": {
    "current_stage": 1,
    "completed_at": null
  }
}
```

---

## Friends System Expliqué {#friends}

### Concept

Système en 3 étapes:
1. User A envoie demande à User B
2. User B accepte (ou rejette)
3. Deviennent amis

### Database

```python
class FriendRequest(Base):
    __tablename__ = "friend_requests"
    
    id = Column(Integer, primary_key=True)
    from_user_id = Column(Integer, ForeignKey("users.id"))
    to_user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="pending")  # pending, accepted, rejected

class Friendship(Base):
    __tablename__ = "friendships"
    
    id = Column(Integer, primary_key=True)
    user_id_a = Column(Integer, ForeignKey("users.id"))
    user_id_b = Column(Integer, ForeignKey("users.id"))
    # Constraint: user_id_a < user_id_b (to avoid duplicates)
```

### Endpoints Friends

#### 1. Send Friend Request

**Route:** `POST /api/friends/request`

**Body:**
```json
{
  "user_id": 99  // User to add
}
```

**Code:**

```python
def send_friend_request(
    target_user_id: int,
    current_user: User,
    db: Session
):
    # 1. Valide pas self-request
    if target_user_id == current_user.id:
        raise HTTPException(400, "Cannot add yourself")
    
    # 2. Vérifie que target existe
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(404, "User not found")
    
    # 3. Vérifie pas déjà amis
    existing = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id_a == current_user.id, 
                 Friendship.user_id_b == target_user_id),
            and_(Friendship.user_id_a == target_user_id, 
                 Friendship.user_id_b == current_user.id)
        )
    ).first()
    if existing:
        raise HTTPException(400, "Already friends")
    
    # 4. Vérifie pas déjà en demande
    existing_request = db.query(FriendRequest).filter(
        and_(
            FriendRequest.from_user_id == current_user.id,
            FriendRequest.to_user_id == target_user_id,
            FriendRequest.status == "pending"
        )
    ).first()
    if existing_request:
        raise HTTPException(400, "Request already pending")
    
    # 5. Crée demande
    friend_request = FriendRequest(
        from_user_id=current_user.id,
        to_user_id=target_user_id
    )
    db.add(friend_request)
    db.commit()
    
    # 6. Envoie notification à target (WebSocket)
    await ws_manager.send_personal_message(
        message={
            "type": "notification",
            "event": "friend_request",
            "data": {
                "from_user_id": current_user.id,
                "from_username": current_user.username,
                "request_id": friend_request.id
            }
        },
        user_id=target_user_id
    )
    
    return {"status": "request_sent"}
```

#### 2. Accept Friend Request

**Route:** `POST /api/friends/accept`

**Body:**
```json
{
  "request_id": 1
}
```

**Code:**

```python
def accept_friend_request(
    request_id: int,
    current_user: User,
    db: Session
):
    # 1. Trouve la demande
    friend_request = db.query(FriendRequest).filter(
        FriendRequest.id == request_id
    ).first()
    
    if not friend_request:
        raise HTTPException(404, "Request not found")
    
    # 2. Vérifie que current_user est le destinataire
    if friend_request.to_user_id != current_user.id:
        raise HTTPException(403, "Not authorized")
    
    # 3. Vérifie que demande est pending
    if friend_request.status != "pending":
        raise HTTPException(400, "Request already processed")
    
    # 4. Crée Friendship
    # Normalized: min user_id first
    user_a = min(friend_request.from_user_id, current_user.id)
    user_b = max(friend_request.from_user_id, current_user.id)
    
    friendship = Friendship(user_id_a=user_a, user_id_b=user_b)
    db.add(friendship)
    
    # 5. Marque demande comme accepted
    friend_request.status = "accepted"
    
    db.commit()
    
    # 6. Envoie notification à both users
    await ws_manager.broadcast_room(
        message={
            "type": "notification",
            "event": "friends_updated"
        },
        user_ids=[friend_request.from_user_id, current_user.id]
    )
    
    return {"status": "friends"}
```

#### 3. List Friends

**Route:** `GET /api/friends/list`

**Response:**
```json
{
  "friends": [
    {
      "id": 99,
      "username": "friend1",
      "avatar_url": "/uploaded_avatars/user99.png",
      "is_online": true
    }
  ]
}
```

**Code:**

```python
def list_friends(
    current_user: User,
    db: Session
):
    # 1. Query friendships où current_user est membre
    friendships = db.query(Friendship).filter(
        or_(
            Friendship.user_id_a == current_user.id,
            Friendship.user_id_b == current_user.id
        )
    ).all()
    
    friends = []
    for friendship in friendships:
        # Détermine l'ami (pas current_user)
        friend_id = (
            friendship.user_id_b 
            if friendship.user_id_a == current_user.id 
            else friendship.user_id_a
        )
        
        # Charge User
        friend = db.query(User).filter(User.id == friend_id).first()
        
        # Ajoute au resultat
        friends.append({
            "id": friend.id,
            "username": friend.username,
            "avatar_url": friend.profile.avatar_url if friend.profile else None,
            "is_online": user_is_online(friend_id)  # Check WS manager
        })
    
    return {"friends": friends}
```

#### 4. List Friend Requests

**Route:** `GET /api/friends/requests`

**Response:**
```json
{
  "incoming": [
    {
      "id": 5,
      "from_user": { "id": 77, "username": "user77" },
      "created_at": "2024-03-15T10:30:00Z"
    }
  ],
  "outgoing": [
    {
      "id": 6,
      "to_user": { "id": 66, "username": "user66" },
      "created_at": "2024-03-15T11:00:00Z"
    }
  ]
}
```

---

## Messages & Chat Expliqué {#messages}

### Concept

Chat entre 2 users:
1. Créé **Conversation** automatiquement (1-1 avec 2 users)
2. Ajoute **Message** à la conversation
3. Persiste en DB + envoie en temps réel (WS)

### Database

```python
class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True)
    user_id_a = Column(Integer, ForeignKey("users.id"))
    user_id_b = Column(Integer, ForeignKey("users.id"))

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    body = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Endpoints Messages

#### 1. Send Message

**Route:** `POST /api/messages`

**Body:**
```json
{
  "recipient_id": 99,
  "body": "Hey, how are you?"
}
```

**Code:**

```python
def send_message(
    payload: MessageCreate,  # {recipient_id, body}
    current_user: User,
    db: Session
):
    sender_id = current_user.id
    recipient_id = payload.recipient_id
    
    # 1. Vérifie recipient existe
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if not recipient:
        raise HTTPException(404, "Recipient not found")
    
    # 2. Trouve ou crée Conversation
    # Normalized: min user_id first
    user_a = min(sender_id, recipient_id)
    user_b = max(sender_id, recipient_id)
    
    conversation = db.query(Conversation).filter(
        and_(
            Conversation.user_id_a == user_a,
            Conversation.user_id_b == user_b
        )
    ).first()
    
    if not conversation:
        # Crée nouvelle conversation
        conversation = Conversation(user_id_a=user_a, user_id_b=user_b)
        db.add(conversation)
        db.flush()  # Get ID avant de continuer
    
    # 3. Crée Message
    message = Message(
        conversation_id=conversation.id,
        sender_id=sender_id,
        body=payload.body
    )
    db.add(message)
    db.commit()
    
    # 4. Persiste en DB
    db.refresh(message)
    
    # 5. Envoie en temps réel au recipient (WebSocket)
    await ws_manager.send_personal_message(
        message={
            "type": "message",
            "event": "message.received",
            "data": {
                "id": message.id,
                "sender_id": sender_id,
                "body": payload.body,
                "timestamp": message.created_at.isoformat()
            }
        },
        user_id=recipient_id
    )
    
    return MessageResponse(
        id=message.id,
        sender_id=sender_id,
        recipient_id=recipient_id,
        body=payload.body,
        timestamp=message.created_at,
        is_read=False
    )
```

#### 2. Get Messages History

**Route:** `GET /api/messages/{conversation_id}?limit=50&offset=0`

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "sender_id": 42,
      "body": "Hello!",
      "timestamp": "2024-03-15T10:30:00Z"
    },
    {
      "id": 2,
      "sender_id": 99,
      "body": "Hi there!",
      "timestamp": "2024-03-15T10:31:00Z"
    }
  ]
}
```

**Code:**

```python
def get_messages(
    conversation_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: User,
    db: Session
):
    # 1. Vérifie que current_user est participant
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(404, "Conversation not found")
    
    if not (
        conversation.user_id_a == current_user.id or
        conversation.user_id_b == current_user.id
    ):
        raise HTTPException(403, "Not authorized")
    
    # 2. Query messages avec pagination
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()
    
    # 3. Marque comme read
    for msg in messages:
        if msg.sender_id != current_user.id:
            msg.is_read = True
    db.commit()
    
    return {"messages": [MessageResponse.from_orm(m) for m in messages]}
```

#### 3. Get Conversations List

**Route:** `GET /api/messages/conversations`

**Response:**
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

---

## Matchmaking & Game Rooms {#matchmaking}

### Concept

1. Player joins queue pour une difficulté
2. Quand 2+ players → crée Room avec unique room_id
3. Envoie room_id à players
4. Players connect via WebSocket à room
5. Game synchro réelle temps-réel

### Service

```python
class MatchService:
    def __init__(self):
        self.queue = []  # List de users waiting
    
    def join_queue(self, user_id: int):
        """Add user to waiting queue"""
        if user_id not in self.queue:
            self.queue.append(user_id)
    
    def leave_queue(self, user_id: int):
        """Remove user from queue"""
        if user_id in self.queue:
            self.queue.remove(user_id)
    
    def try_match(self):
        """
        Try to create a match from queue
        Returns (room_id, [player1_id, player2_id]) or None
        """
        if len(self.queue) >= 2:
            player1 = self.queue.pop(0)
            player2 = self.queue.pop(0)
            room_id = f"room_{uuid.uuid4().hex[:6]}"
            
            return room_id, [player1, player2]
        
        return None
```

### Endpoints Matchmaking

#### 1. Join Matchmaking

**Route:** `POST /api/matchmaking/join`

**Body:**
```json
{
  "difficulty": "moyen"
}
```

**Code:**

```python
matchmaking_service = MatchService()

async def join_matchmaking(
    difficulty: str,
    current_user: User,
    db: Session
):
    # 1. Valide difficulty
    if difficulty not in ["facile", "moyen", "difficile"]:
        raise HTTPException(400, "Invalid difficulty")
    
    # 2. Ajoute à queue
    matchmaking_service.join_queue(current_user.id)
    
    # 3. Try matcher
    result = matchmaking_service.try_match()
    
    if result:
        # ✓ Match trouvé
        room_id, player_ids = result
        
        # Crée GameHistory
        game_history = GameHistory(
            room_id=room_id,
            difficulty=difficulty,
            seed=generate_seed()
        )
        db.add(game_history)
        db.commit()
        
        # Envoie match notification aux 2 players
        for player_id in player_ids:
            other_id = player_ids[1] if player_ids[0] == player_id else player_ids[0]
            
            await ws_manager.send_personal_message(
                message={
                    "type": "game",
                    "event": "game.matched",
                    "data": {
                        "room_id": room_id,
                        "opponent_id": other_id,
                        "seed": game_history.seed,
                        "difficulty": difficulty
                    }
                },
                user_id=player_id
            )
        
        return {
            "status": "matched",
            "room_id": room_id,
            "opponent_id": ...,
            "seed": game_history.seed
        }
    else:
        # ✗ Waiting in queue
        queue_position = matchmaking_service.queue.index(current_user.id)
        
        return {
            "status": "waiting",
            "queue_position": queue_position,
            "difficulty": difficulty
        }
```

---

## Services Métier {#services}

### Service Pattern

Chaque domaine a un "service" qui contient la logique métier:

```python
# services/friend_service.py
class FriendService:
    def __init__(self, db: Session):
        self.db = db
    
    def send_request(self, from_user_id: int, to_user_id: int):
        """Envoie demande d'ami avec toutes les vérifications"""
        # Logique métier centrale
        pass
    
    def accept_request(self, request_id: int, user_id: int):
        """Accept request + create friendship"""
        pass
```

**Avantages:**
- Logique pas directement dans routes
- Réutilisable (api + tests)
- Facile à tester

### Exemple: Friend Service

```python
# services/friend_service.py

class FriendService:
    def __init__(self, db: Session):
        self.db = db
    
    def send_request(self, from_user_id: int, to_user_id: int):
        """Sends friend request with validation"""
        
        # Valide
        if from_user_id == to_user_id:
            raise ValueError("Cannot add yourself")
        
        target = self.db.query(User).filter(User.id == to_user_id).first()
        if not target:
            raise ValueError("User not found")
        
        # Check pas déjà amis
        existing = self._find_friendship(from_user_id, to_user_id)
        if existing:
            raise ValueError("Already friends")
        
        # Create request
        request = FriendRequest(
            from_user_id=from_user_id,
            to_user_id=to_user_id
        )
        self.db.add(request)
        self.db.commit()
        
        return request
    
    def accept_request(self, request_id: int, user_id: int):
        """Accept request and create friendship"""
        
        request = self.db.query(FriendRequest).filter(
            FriendRequest.id == request_id
        ).first()
        
        if not request:
            raise ValueError("Request not found")
        
        if request.to_user_id != user_id:
            raise ValueError("Not authorized")
        
        # Create friendship
        user_a = min(request.from_user_id, user_id)
        user_b = max(request.from_user_id, user_id)
        
        friendship = Friendship(user_id_a=user_a, user_id_b=user_b)
        self.db.add(friendship)
        
        request.status = "accepted"
        self.db.commit()
        
        return friendship
    
    def _find_friendship(self, user_a: int, user_b: int):
        """Helper: find friendship between 2 users"""
        return self.db.query(Friendship).filter(
            or_(
                and_(Friendship.user_id_a == user_a, Friendship.user_id_b == user_b),
                and_(Friendship.user_id_a == user_b, Friendship.user_id_b == user_a)
            )
        ).first()

# routes/friends_request_actions.py

from app.services.friend_service import FriendService

@router.post("/accept")
async def accept_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = FriendService(db)
    
    try:
        friendship = service.accept_request(request_id, current_user.id)
        
        # Send WS notification
        friend_id = (
            friendship.user_id_a 
            if friendship.user_id_a != current_user.id 
            else friendship.user_id_b
        )
        await ws_manager.broadcast_room(
            message={
                "type": "notification",
                "event": "friends_updated"
            },
            user_ids=[current_user.id, friend_id]
        )
        
        return {"status": "friends"}
    
    except ValueError as e:
        raise HTTPException(400, str(e))
```

---

## WebSocket Manager {#websocket}

### Qu'est-ce que c'est?

Central manager pour toutes les connexions WebSocket:
- Tracking users connectés
- Routing messages
- Broadcasting

### Structure

```python
# core/ws_manager.py

class ConnectionManager:
    def __init__(self):
        self.active_connections = {}  # {user_id: WebSocket}
        self.rooms = {}  # {room_id: set(user_ids)}
        self.user_rooms = {}  # {user_id: room_id}
    
    async def connect(self, user_id: int, websocket: WebSocket):
        """User connects"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        """User disconnects"""
        del self.active_connections[user_id]
        room_id = self.user_rooms.pop(user_id, None)
        if room_id:
            self.rooms[room_id].discard(user_id)
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Send to specific user"""
        ws = self.active_connections.get(user_id)
        if ws:
            await ws.send_json(message)
    
    async def broadcast_room(self, room_id: str, message: dict):
        """Broadcast to all in room"""
        users = self.rooms.get(room_id, set())
        for user_id in users:
            await self.send_personal_message(message, user_id)
    
    async def broadcast(self, message: dict):
        """Broadcast to all connected users"""
        for user_id in self.active_connections:
            await self.send_personal_message(message, user_id)

manager = ConnectionManager()
```

### WebSocket Endpoint

```python
# routes/ws.py

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    room: str = None,
    db: Session = Depends(get_db)
):
    # 1. Authentifie via token
    user_id = get_user_from_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        await websocket.close(code=1008, reason="Unauthorized")
        return
    
    # 2. Connect
    await manager.connect(user_id, websocket)
    
    # 3. Join room si specififié
    if room:
        manager.add_user_to_room(room, user_id)
    
    try:
        while True:
            # 4. Reçoit message du client
            data = await websocket.receive_json()
            
            # 5. Route selon type
            if data.get("type") == "message":
                # Chat message
                await handle_chat_message(data, user_id, db)
            
            elif data.get("type") == "game":
                # Game action
                await handle_game_action(data, user_id, room)
            
            elif data.get("type") == "ping":
                # Keep-alive
                await manager.send_personal_message(
                    {"type": "pong"},
                    user_id
                )
    
    except Exception as e:
        logger.error(f"WS error: {e}")
    
    finally:
        # 6. Disconnect
        manager.disconnect(user_id)
```

### Message Flow

```
Client connects:
GET /ws?token=<token>&room=room_xyz123
    ↓
Backend authenticates token
    ↓
ConnectionManager.connect(user_id, websocket)
    ↓
active_connections[42] = WebSocket
rooms["room_xyz123"] = {42, 99}
    ↓
Client connected ✓

Client sends message:
{
  "type": "message",
  "event": "message.send",
  "data": {
    "recipient_id": 99,
    "body": "Hello!"
  }
}
    ↓
handle_chat_message() processes
    ↓
Saves to DB
    ↓
manager.send_personal_message(message, 99)
    ↓
active_connections[99].send_json(message)
    ↓
Other client receives instantly

Client leaves:
WebSocket disconnects
    ↓
finally: manager.disconnect(42)
    ↓
active_connections.pop(42)
    ↓
users notified (user left game)
```

