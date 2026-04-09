# Guide Complet: WebSockets - Communication Real-time

## Table des matières
1. [Concepts Fondamentaux](#concepts)
2. [Architecture Backend](#backend)
3. [Connexion Client](#client)
4. [Types de Messages](#messages)
5. [Room Management](#rooms)
6. [Authentification](#auth)
7. [Reconnexion & Error Handling](#errors)
8. [Exemples Complets](#examples)

---

## Concepts Fondamentaux {#concepts}

### Qu'est-ce que WebSocket?

WebSocket = connexion bidirectionnelle persistent entre client et serveur

```
HTTP (Requête/Réponse):
Client ──→ Serveur (Request)
Client ←── Serveur (Response)
Client ──→ Serveur (Request)
Client ←── Serveur (Response)
[Connexion fermée]

WebSocket (Bidirectionnel):
Client ←→ Serveur
Client ←→ Serveur
Client ←→ Serveur
[Connexion ouverte en continu]
```

### Cas d'Usage

```
✅ WebSocket (Real-time):
- Chat messages (arrive immédiatement)
- Notifications (friend requests, game matches)
- Game sync (positions des joueurs)
- Live updates (scoreboard)

❌ HTTP REST (Non real-time):
- User profile (peut être mis en cache)
- Game results (sauvegardé après coup)
- Friend list (pas urgent)
- Static data
```

### Avantages

```
1. Latence basse (pas d'attente de réponse)
2. Connexion persistante (économe)
3. Bidirectionnel (serveur peut initier messages)
4. Full-duplex (client et serveur parlent en même temps)
```

---

## Architecture Backend {#backend}

### WebSocket Endpoint (FastAPI)

```python
# backend/python/app/api/routes/ws.py

from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import HTMLResponse
import json
import logging
from app.core.security import verify_token_from_ws
from app.core.ws_manager import ConnectionManager

logger = logging.getLogger(__name__)

# Global connection manager
manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),  # Token in query: /ws?token=...
    room: str = Query(None)   # Optional room: /ws?token=...&room=game_123
):
    """
    WebSocket endpoint for real-time communication
    
    Client connects: GET /ws?token=JWT_TOKEN&room=ROOM_ID
    """
    
    # 1. Verify token (authentication)
    try:
        user_id = verify_token_from_ws(token)
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # 2. Accept connection
    await websocket.accept()
    logger.info(f"User {user_id} connected to WS (room: {room})")

    # 3. Add to manager
    await manager.connect(websocket, user_id, room)

    try:
        # 4. Listen for messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Route message based on type
            await handle_ws_message(message, user_id, room, manager)

    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected")
        await manager.disconnect(websocket, user_id, room)
        
    except Exception as e:
        logger.error(f"WS error: {e}")
        await manager.disconnect(websocket, user_id, room)

# Message handler
async def handle_ws_message(message: dict, user_id: int, room: str, manager: ConnectionManager):
    """
    Route messages based on type
    """
    msg_type = message.get('type')

    if msg_type == 'chat_message':
        await handle_chat_message(message, user_id, room, manager)
    
    elif msg_type == 'game_event':
        await handle_game_event(message, user_id, room, manager)
    
    elif msg_type == 'player_moved':
        await handle_player_moved(message, user_id, room, manager)
    
    elif msg_type == 'join_room':
        await handle_join_room(message, user_id, manager)
    
    elif msg_type == 'leave_room':
        await handle_leave_room(message, user_id, manager)
    
    else:
        logger.warning(f"Unknown message type: {msg_type}")
```

**Explication:**
- `@app.websocket("/ws")` = WebSocket endpoint
- `token: str = Query(...)` = Récupère token de query string (`?token=...`)
- `await websocket.accept()` = Accepte connexion
- `await websocket.receive_text()` = Écoute messages entrants
- `WebSocketDisconnect` = Client fermé connexion

### ConnectionManager (Backend)

```python
# backend/python/app/core/ws_manager.py

from typing import Dict, List, Set
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Gère les connexions WebSocket
    - Track active connections par user
    - Manage rooms (multiple users in one room)
    - Broadcast messages
    """
    
    def __init__(self):
        # Maps user_id → WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}
        
        # Maps room_id → Set of user_ids in room
        self.rooms: Dict[str, Set[int]] = {}
        
        # Maps user_id → room_id (pour quick lookup)
        self.user_rooms: Dict[int, str] = {}

    async def connect(self, websocket: WebSocket, user_id: int, room: str = None):
        """
        Enregistre nouvelle connexion
        """
        self.active_connections[user_id] = websocket
        
        if room:
            if room not in self.rooms:
                self.rooms[room] = set()
            self.rooms[room].add(user_id)
            self.user_rooms[user_id] = room
            
            logger.info(f"User {user_id} joined room {room} (total: {len(self.rooms[room])})")

    async def disconnect(self, websocket: WebSocket, user_id: int, room: str = None):
        """
        Unregistre connexion fermée
        """
        # Remove from active connections
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # Remove from room
        if room and room in self.rooms:
            self.rooms[room].discard(user_id)
            if len(self.rooms[room]) == 0:
                del self.rooms[room]
        
        if user_id in self.user_rooms:
            del self.user_rooms[user_id]
        
        logger.info(f"User {user_id} disconnected from room {room}")

    async def send_personal_message(self, user_id: int, message: dict):
        """
        Envoie message à un user spécifique
        """
        if user_id not in self.active_connections:
            logger.warning(f"User {user_id} not connected")
            return
        
        try:
            websocket = self.active_connections[user_id]
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send to user {user_id}: {e}")

    async def broadcast_room(self, room_id: str, message: dict):
        """
        Broadcast à tous les users dans une room
        """
        if room_id not in self.rooms:
            logger.warning(f"Room {room_id} not found")
            return
        
        user_ids = list(self.rooms[room_id])
        
        for user_id in user_ids:
            await self.send_personal_message(user_id, message)
        
        logger.debug(f"Broadcast to room {room_id}: {len(user_ids)} users")

    async def broadcast_all(self, message: dict):
        """
        Broadcast à TOUS les users connectés
        """
        disconnected = []
        
        for user_id in list(self.active_connections.keys()):
            try:
                await self.send_personal_message(user_id, message)
            except Exception as e:
                logger.warning(f"Failed to send to {user_id}: {e}")
                disconnected.append(user_id)
        
        # Clean up
        for user_id in disconnected:
            await self.disconnect(None, user_id)

    def get_room_users(self, room_id: str) -> List[int]:
        """
        Get list of user IDs in a room
        """
        return list(self.rooms.get(room_id, set()))

    def get_user_room(self, user_id: int) -> str:
        """
        Get room ID for a user
        """
        return self.user_rooms.get(user_id)

    def is_user_connected(self, user_id: int) -> bool:
        """
        Check if user is connected
        """
        return user_id in self.active_connections
```

**Structure de Données:**

```python
# Exemple d'état
active_connections = {
    1: <WebSocket>,      # User 1 connected
    2: <WebSocket>,      # User 2 connected
    3: <WebSocket>,      # User 3 connected
}

rooms = {
    "game_123": {1, 2},       # Room 1: Users 1, 2
    "game_456": {3},          # Room 2: User 3
}

user_rooms = {
    1: "game_123",
    2: "game_123",
    3: "game_456",
}

# Broadcast à room game_123 atteint Users 1, 2
# Broadcast à tous atteint Users 1, 2, 3
```

### Message Handlers

```python
# Chat message handler
async def handle_chat_message(message: dict, user_id: int, room: str, manager: ConnectionManager):
    """
    { "type": "chat_message", "body": "hello", "to_user_id": 2 }
    """
    to_user_id = message.get('to_user_id')
    body = message.get('body')
    
    # Save to database
    db_message = await MessageService.create_message(
        from_user_id=user_id,
        to_user_id=to_user_id,
        body=body
    )
    
    # Send to recipient
    response = {
        'type': 'chat_message',
        'id': db_message.id,
        'from_user_id': user_id,
        'body': body,
        'created_at': db_message.created_at.isoformat()
    }
    await manager.send_personal_message(to_user_id, response)

# Game event handler
async def handle_game_event(message: dict, user_id: int, room: str, manager: ConnectionManager):
    """
    { "type": "game_event", "event": "player_died", "data": {...} }
    """
    event = message.get('event')
    
    if event == 'player_died':
        # Broadcast to room (all players see death)
        await manager.broadcast_room(room, {
            'type': 'game_event',
            'event': 'player_died',
            'user_id': user_id
        })
    
    elif event == 'level_complete':
        # Save result
        score = message.get('score')
        time_ms = message.get('time_ms')
        
        await ProgressionService.complete_stage(
            user_id=user_id,
            difficulty=message.get('difficulty'),
            stage=message.get('stage'),
            score=score,
            time_ms=time_ms
        )
        
        await manager.broadcast_room(room, {
            'type': 'game_event',
            'event': 'player_completed',
            'user_id': user_id,
            'score': score,
            'time_ms': time_ms
        })

# Player moved handler (multiplayer sync)
async def handle_player_moved(message: dict, user_id: int, room: str, manager: ConnectionManager):
    """
    { "type": "player_moved", "x": 10, "y": 20, "direction": 0.5 }
    """
    x = message.get('x')
    y = message.get('y')
    direction = message.get('direction')
    
    # Broadcast to other players in room
    await manager.broadcast_room(room, {
        'type': 'player_moved',
        'user_id': user_id,
        'x': x,
        'y': y,
        'direction': direction
    })
```

---

## Connexion Client {#client}

### Frontend: Créer WebSocket

```javascript
// frontend/src/services/websocket.js

class WebSocketClient {
  constructor(url = null) {
    this.url = url || this.buildUrl()
    this.ws = null
    this.token = localStorage.getItem('token')
    this.listeners = {}
    this.messageQueue = []  // Queue si pas connecté
    this.isConnected = false
  }

  buildUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/ws`
  }

  // Connect to WebSocket
  connect(room = null) {
    return new Promise((resolve, reject) => {
      try {
        // Build URL with auth
        let url = `${this.url}?token=${this.token}`
        if (room) {
          url += `&room=${room}`
        }

        console.log('Connecting to WS:', url)
        this.ws = new WebSocket(url)

        // Connection opened
        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.isConnected = true
          
          // Send queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift()
            this.ws.send(JSON.stringify(msg))
          }

          this.emit('connected')
          resolve()
        }

        // Message received
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleMessage(data)
          } catch (e) {
            console.error('Failed to parse message:', e, event.data)
          }
        }

        // Error
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.emit('error', error)
          reject(error)
        }

        // Connection closed
        this.ws.onclose = () => {
          console.log('WebSocket disconnected')
          this.isConnected = false
          this.emit('disconnected')
          
          // Auto-reconnect après 3s
          setTimeout(() => this.reconnect(room), 3000)
        }
      } catch (e) {
        console.error('Failed to create WebSocket:', e)
        reject(e)
      }
    })
  }

  // Reconnect
  reconnect(room = null) {
    if (this.isConnected) return
    console.log('Attempting to reconnect...')
    this.connect(room)
  }

  // Send message
  send(message) {
    const json = JSON.stringify(message)

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(json)
    } else {
      console.warn('WS not connected, queueing message')
      this.messageQueue.push(message)
    }
  }

  // Handle incoming message
  handleMessage(data) {
    const type = data.type

    console.log('WS received:', type, data)

    // Emit event to listeners
    this.emit(type, data)

    // Also emit generic 'message' event
    this.emit('message', data)
  }

  // Event system
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event, callback) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
  }

  emit(event, data) {
    if (!this.listeners[event]) return
    this.listeners[event].forEach(cb => cb(data))
  }

  // Disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }
}

// Export singleton
export const wsClient = new WebSocketClient()
```

**Utilisation:**
```javascript
// Connect
await wsClient.connect('game_123')

// Listen
wsClient.on('chat_message', (data) => {
  console.log('New message:', data.body)
})

// Send
wsClient.send({
  type: 'chat_message',
  body: 'Hello!',
  to_user_id: 2
})

// Disconnect
wsClient.disconnect()
```

---

## Types de Messages {#messages}

### 1. Chat Messages

```javascript
// Client → Server
{
  "type": "chat_message",
  "body": "Hello there!",
  "to_user_id": 2
}

// Server → Client (to recipient)
{
  "type": "chat_message",
  "id": 123,
  "from_user_id": 1,
  "from_username": "player1",
  "body": "Hello there!",
  "created_at": "2025-03-17T10:30:00Z"
}
```

### 2. Friend Requests

```javascript
// Server → Client (when someone sends request)
{
  "type": "friend_request",
  "id": 456,
  "from_user_id": 1,
  "from_username": "player1",
  "from_avatar_url": "https://...",
  "message": "Let's play together!"
}

// Client → Server (accept request)
{
  "type": "friend_request_accepted",
  "request_id": 456
}

// Server → Client (to both users)
{
  "type": "friendship_created",
  "user_id_1": 1,
  "user_id_2": 2,
  "username_1": "player1",
  "username_2": "player2"
}
```

### 3. Matchmaking

```javascript
// Client → Server (join queue)
{
  "type": "join_queue",
  "difficulty": 1,
  "mode": "pvp"  // ou "pve"
}

// Server → Client (match found!)
{
  "type": "match_found",
  "room_id": "game_abc123",
  "opponent": {
    "id": 2,
    "username": "opponent_name",
    "avatar_url": "https://...",
    "elo": 1500
  },
  "seed": 987654,  // Maze seed
  "difficulty": 1,
  "stage": 1
}

// Server → Client (match cancelled)
{
  "type": "match_cancelled",
  "reason": "opponent_disconnected"
}
```

### 4. Game State Sync

```javascript
// Client → Server (player moved)
{
  "type": "player_moved",
  "x": 10,
  "y": 20,
  "direction": 0.785  // radians
}

// Server → Client (opponent moved)
{
  "type": "player_moved",
  "user_id": 2,
  "x": 15,
  "y": 25,
  "direction": 3.14
}

// Client → Server (level complete)
{
  "type": "game_event",
  "event": "level_complete",
  "difficulty": 1,
  "stage": 1,
  "score": 5000,
  "time_ms": 45000
}

// Server → Client (opponent completed)
{
  "type": "game_event",
  "event": "player_completed",
  "user_id": 2,
  "score": 4800,
  "time_ms": 42000,
  "winner": 1  // user_id of winner (lowest time)
}
```

### 5. Notifications

```javascript
// Server → Client (any user)
{
  "type": "notification",
  "id": 789,
  "title": "Friend Request",
  "message": "player1 sent you a friend request",
  "notification_type": "friend_request",
  "data": {
    "from_user_id": 1
  },
  "created_at": "2025-03-17T10:30:00Z"
}

// Server → Client (game invitation)
{
  "type": "notification",
  "title": "Game Invitation",
  "message": "opponent_name invited you to play",
  "notification_type": "game_invitation",
  "data": {
    "from_user_id": 3,
    "difficulty": 1,
    "stage": 2
  }
}
```

### 6. Presence (Online Status)

```javascript
// Client → Server (tell server I'm online)
{
  "type": "presence",
  "status": "online",
  "location": "menu"  // ou "ingame", "lobby"
}

// Server → Client (user came online)
{
  "type": "user_presence",
  "user_id": 2,
  "status": "online",
  "location": "menu"
}

// Server → Client (user went offline)
{
  "type": "user_presence",
  "user_id": 2,
  "status": "offline"
}
```

---

## Room Management {#rooms}

### Room Concept

```
Rooms = isolate conversations/games

┌──────────────────────────────────────────┐
│   Active Connections                      │
│                                            │
│  User 1 ──────────────┐                   │
│                       ├─→ game_123        │
│  User 2 ──────────────┘                   │
│                                            │
│  User 3 ──────────────────→ lobby         │
│                                            │
│  User 4 ──────────────┐                   │
│                       ├─→ game_456        │
│  User 5 ──────────────┘                   │
│                                            │
└──────────────────────────────────────────┘

# Broadcast à game_123 → Users 1, 2
# Broadcast à lobby → User 3
# Broadcast à game_456 → Users 4, 5
```

### Room Types

```javascript
// 1. Direct Message Room (Private chat between 2 users)
// URL: /ws?token=JWT&room=dm_user1_user2
// Messages: only visible to those 2 users

// 2. Game Room (Multiplayer game)
// URL: /ws?token=JWT&room=game_abc123
// Messages: all players in game sync state
// Duration: until game ends

// 3. Lobby (Global announcements, matchmaking)
// URL: /ws?token=JWT&room=lobby
// Messages: matchmaking events, global notifications
// Users: everyone waiting for match

// 4. Rank Chat (Channel-like, multiple users)
// URL: /ws?token=JWT&room=friends
// Messages: visible to all connected friends
```

### Frontend: Join Room

```javascript
// Join a game room
wsClient.send({
  type: 'join_room',
  room_id: 'game_abc123'
})

// Server acknowledges
wsClient.on('room_joined', (data) => {
  console.log('Joined room:', data.room_id)
  console.log('Other players:', data.users)
})

// Leave room
wsClient.send({
  type: 'leave_room',
  room_id: 'game_abc123'
})

wsClient.on('room_left', (data) => {
  console.log('Left room:', data.room_id)
})
```

---

## Authentification {#auth}

### Token in Query String

```javascript
// Frontend: Récupère token et le passe en query
const token = localStorage.getItem('token')
const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`)
```

**Pourquoi query string?**
- WebSocket handshake ne peut pas passer custom headers (limitation du protocole)
- Query string est accessible dans l'URL de connexion
- Backend vérifie le token avant d'accepter

### Backend: Verify Token

```python
# backend/python/app/core/security/security_tokens.py

from jose import JWTError, jwt
from datetime import datetime

def verify_token_from_ws(token: str) -> int:
    """
    Verify JWT token and return user_id
    Raises exception if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: int = payload.get("sub")
        
        if user_id is None:
            raise JWTError("Invalid token")
        
        return user_id
    
    except JWTError as e:
        raise Exception(f"Invalid token: {e}")
```

### Expiration Handling

```javascript
// Frontend: Check token expiration before connecting
function isTokenExpired() {
  const token = localStorage.getItem('token')
  if (!token) return true
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000  // Convert to ms
    return Date.now() > exp
  } catch {
    return true
  }
}

// Connect only if token valid
if (isTokenExpired()) {
  // Refresh token or redirect to login
  redirectToLogin()
} else {
  wsClient.connect('game_123')
}
```

---

## Reconnexion & Error Handling {#errors}

### Auto-Reconnect

```javascript
// backend/python/app/core/ws_manager.py

class WebSocketWithReconnect {
  constructor() {
    this.maxRetries = 5
    this.retryCount = 0
    this.retryDelay = 1000  // Start at 1s
  }

  async reconnect(room = null) {
    if (this.retryCount >= this.maxRetries) {
      console.error('Max retries reached, giving up')
      this.emit('reconnect_failed')
      return
    }

    this.retryCount++
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1)  // Exponential backoff
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`)
    
    setTimeout(() => {
      this.connect(room)
        .then(() => {
          this.retryCount = 0  // Reset on success
          this.retryDelay = 1000
        })
        .catch(() => this.reconnect(room))
    }, delay)
  }
}

// Exponential backoff pattern:
// Attempt 1: 1s
// Attempt 2: 2s
// Attempt 3: 4s
// Attempt 4: 8s
// Attempt 5: 16s
```

### Handle Disconnections

```javascript
// Listen for disconnection
wsClient.on('disconnected', () => {
  // Show UI notification
  showNotification('Connection lost, reconnecting...')
  
  // Stop game loop if in game
  if (gameRunning) {
    pauseGame()
  }
})

// Listen for reconnection
wsClient.on('connected', () => {
  hideNotification()
  
  // Resume game
  if (gamePaused) {
    resumeGame()
  }
})

// Listen for errors
wsClient.on('error', (error) => {
  console.error('WebSocket error:', error)
  showError('Connection error: ' + error.message)
})
```

### Message Timeout

```javascript
// If message not ack'd, retry
class WebSocketWithTimeout {
  sendWithTimeout(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36)
      message.id = id
      
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'))
      }, timeout)
      
      // Listen for ack
      const ackListener = (data) => {
        if (data.id === id) {
          clearTimeout(timer)
          this.off('ack', ackListener)
          resolve(data)
        }
      }
      
      this.on('ack', ackListener)
      this.send(message)
    })
  }
}

// Usage
try {
  const ack = await wsClient.sendWithTimeout({
    type: 'player_moved',
    x: 10,
    y: 20
  }, 3000)
  
  console.log('Move confirmed:', ack)
} catch (e) {
  console.error('Move failed:', e)
  // Retry or show error
}
```

---

## Exemples Complets {#examples}

### Exemple 1: Chat Temps Réel

#### Frontend

```vue
<template>
  <div class="chat">
    <div class="messages">
      <div v-for="msg in messages" :key="msg.id" class="message">
        <strong>{{ msg.from_username }}:</strong> {{ msg.body }}
      </div>
    </div>
    
    <input v-model="input" @keyup.enter="send" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { wsClient } from '@/services/websocket'

const messages = ref([])
const input = ref('')

onMounted(async () => {
  // Connect to WebSocket
  await wsClient.connect()
  
  // Listen for incoming messages
  wsClient.on('chat_message', (data) => {
    messages.value.push(data)
    
    // Auto-scroll to bottom
    setTimeout(() => {
      const container = document.querySelector('.messages')
      container.scrollTop = container.scrollHeight
    }, 0)
  })
  
  // Load history
  const token = localStorage.getItem('token')
  const res = await fetch('/api/messages', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) {
    const data = await res.json()
    messages.value = data.messages
  }
})

onUnmounted(() => {
  wsClient.disconnect()
})

const send = async () => {
  if (!input.value.trim()) return
  
  wsClient.send({
    type: 'chat_message',
    body: input.value,
    to_user_id: 2  // Hardcoded for example
  })
  
  input.value = ''
}
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid #ddd;
}

.message {
  margin: 0.5rem 0;
  padding: 0.5rem;
  background: #f0f0f0;
  border-radius: 5px;
}

input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}
</style>
```

#### Backend

```python
# Message handler (from earlier)
async def handle_chat_message(message: dict, user_id: int, room: str, manager: ConnectionManager):
    to_user_id = message.get('to_user_id')
    body = message.get('body')
    
    # Save to database
    db_message = await MessageService.create_message(
        from_user_id=user_id,
        to_user_id=to_user_id,
        body=body
    )
    
    # Get user info
    from_user = await User.get(user_id)
    
    # Send to recipient
    response = {
        'type': 'chat_message',
        'id': db_message.id,
        'from_user_id': user_id,
        'from_username': from_user.username,
        'body': body,
        'created_at': db_message.created_at.isoformat()
    }
    
    await manager.send_personal_message(to_user_id, response)
```

### Exemple 2: Multiplayer Game Sync

#### Frontend

```javascript
// src/game/multiplayer.js

import { wsClient } from '@/services/websocket'

class MultiplayerGame {
  constructor(gameRoom) {
    this.gameRoom = gameRoom
    this.opponents = {}  // { user_id: { x, y, direction } }
  }

  async start() {
    // Connect to game room
    await wsClient.connect(this.gameRoom)
    
    // Listen for opponent movements
    wsClient.on('player_moved', (data) => {
      this.opponents[data.user_id] = {
        x: data.x,
        y: data.y,
        direction: data.direction
      }
    })
    
    // Listen for game events
    wsClient.on('game_event', (data) => {
      if (data.event === 'player_completed') {
        this.handlePlayerCompleted(data)
      }
    })
  }

  // Send player movement
  updatePlayerPosition(x, y, direction) {
    wsClient.send({
      type: 'player_moved',
      x: x,
      y: y,
      direction: direction
    })
  }

  // Notify completion
  completeLevel(score, time_ms) {
    wsClient.send({
      type: 'game_event',
      event: 'level_complete',
      difficulty: this.difficulty,
      stage: this.stage,
      score: score,
      time_ms: time_ms
    })
  }

  handlePlayerCompleted(data) {
    const winner = data.user_id  // First to complete
    console.log(`${winner} completed! Score: ${data.score}`)
    
    // Show winner animation
    // End game
  }

  // Render opponents on canvas
  renderOpponents(ctx) {
    for (const [userId, pos] of Object.entries(this.opponents)) {
      // Draw opponent at pos.x, pos.y
      ctx.fillStyle = '#FF6B6B'
      ctx.beginPath()
      ctx.arc(pos.x * 32 + 16, pos.y * 32 + 16, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Usage
const mpGame = new MultiplayerGame('game_abc123')
await mpGame.start()

// In game loop
game.on('playerMoved', (x, y, direction) => {
  mpGame.updatePlayerPosition(x, y, direction)
})

game.on('levelComplete', (score, time_ms) => {
  mpGame.completeLevel(score, time_ms)
})
```

#### Backend

```python
# Game handlers (from earlier sections)
async def handle_player_moved(message: dict, user_id: int, room: str, manager: ConnectionManager):
    x = message.get('x')
    y = message.get('y')
    direction = message.get('direction')
    
    # Broadcast to other players
    await manager.broadcast_room(room, {
        'type': 'player_moved',
        'user_id': user_id,
        'x': x,
        'y': y,
        'direction': direction
    })

async def handle_game_event(message: dict, user_id: int, room: str, manager: ConnectionManager):
    event = message.get('event')
    
    if event == 'level_complete':
        score = message.get('score')
        time_ms = message.get('time_ms')
        
        # Save to database
        await ProgressionService.complete_stage(
            user_id=user_id,
            difficulty=message.get('difficulty'),
            stage=message.get('stage'),
            score=score,
            time_ms=time_ms
        )
        
        # Broadcast to all in room
        await manager.broadcast_room(room, {
            'type': 'game_event',
            'event': 'player_completed',
            'user_id': user_id,
            'score': score,
            'time_ms': time_ms
        })
```

### Exemple 3: Matchmaking via WebSocket

#### Frontend

```javascript
// src/matchmaking.js

class MatchmakingService {
  async joinQueue(difficulty, mode = 'pvp') {
    // Connect to lobby
    await wsClient.connect('lobby')
    
    // Send join request
    wsClient.send({
      type: 'join_queue',
      difficulty: difficulty,
      mode: mode
    })
    
    // Wait for match
    return new Promise((resolve) => {
      wsClient.on('match_found', (data) => {
        resolve({
          roomId: data.room_id,
          opponent: data.opponent,
          seed: data.seed,
          difficulty: data.difficulty,
          stage: data.stage
        })
      })
    })
  }

  leaveQueue() {
    wsClient.send({
      type: 'leave_queue'
    })
    
    wsClient.disconnect()
  }
}

// Usage
const matchmaking = new MatchmakingService()

try {
  const match = await matchmaking.joinQueue(1, 'pvp')
  console.log('Match found!', match)
  
  // Navigate to game
  router.push({
    path: '/game',
    query: {
      roomId: match.roomId,
      opponent: match.opponent.username,
      seed: match.seed,
      difficulty: match.difficulty,
      stage: match.stage
    }
  })
} catch (e) {
  console.error('Matchmaking failed:', e)
}
```

#### Backend

```python
# app/services/match_service.py

class MatchService:
    def __init__(self, manager: ConnectionManager):
        self.manager = manager
        self.queue = []  # List of { user_id, difficulty, mode }
        self.next_room_id = 1

    async def join_queue(self, user_id: int, difficulty: int, mode: str):
        """Add user to matchmaking queue"""
        self.queue.append({
            'user_id': user_id,
            'difficulty': difficulty,
            'mode': mode,
            'joined_at': datetime.now()
        })
        
        # Try to match
        await self.try_match()

    async def leave_queue(self, user_id: int):
        """Remove user from queue"""
        self.queue = [u for u in self.queue if u['user_id'] != user_id]

    async def try_match(self):
        """Try to match players"""
        # Group by difficulty
        by_difficulty = {}
        for player in self.queue:
            diff = player['difficulty']
            if diff not in by_difficulty:
                by_difficulty[diff] = []
            by_difficulty[diff].append(player)
        
        # Match pairs
        for difficulty, players in by_difficulty.items():
            while len(players) >= 2:
                player1 = players.pop(0)
                player2 = players.pop(0)
                
                # Create game room
                room_id = f"game_{self.next_room_id}"
                self.next_room_id += 1
                
                # Generate maze seed
                seed = random.randint(0, 2**31 - 1)
                
                # Notify both players
                user1_data = await User.get(player1['user_id'])
                user2_data = await User.get(player2['user_id'])
                
                message = {
                    'type': 'match_found',
                    'room_id': room_id,
                    'seed': seed,
                    'difficulty': difficulty,
                    'stage': 1
                }
                
                # Send to player 1
                message_p1 = {
                    **message,
                    'opponent': {
                        'id': user2_data.id,
                        'username': user2_data.username,
                        'avatar_url': user2_data.profile.avatar_url
                    }
                }
                await self.manager.send_personal_message(player1['user_id'], message_p1)
                
                # Send to player 2
                message_p2 = {
                    **message,
                    'opponent': {
                        'id': user1_data.id,
                        'username': user1_data.username,
                        'avatar_url': user1_data.profile.avatar_url
                    }
                }
                await self.manager.send_personal_message(player2['user_id'], message_p2)

# WebSocket handler
async def handle_matchmaking_message(message: dict, user_id: int, manager: ConnectionManager):
    if message['type'] == 'join_queue':
        await MatchService.join_queue(
            user_id,
            message.get('difficulty'),
            message.get('mode', 'pvp')
        )
    
    elif message['type'] == 'leave_queue':
        await MatchService.leave_queue(user_id)
```

---

## Performance & Optimization

### Message Compression

```javascript
// Pour les messages fréquents (player_moved), compresser les données

// Au lieu de:
{
  "type": "player_moved",
  "user_id": 123,
  "x": 10,
  "y": 20,
  "direction": 0.785
}

// Utiliser format court:
{
  "t": "pm",  // type -> t
  "u": 123,   // user_id -> u
  "x": 10,
  "y": 20,
  "d": 0.785  // direction -> d
}

// Backend décode et traite
```

### Throttling

```javascript
// Ne pas envoyer player_moved à chaque pixel

class ThrottledWS {
  constructor(wsClient, throttleMs = 100) {
    this.wsClient = wsClient
    this.throttleMs = throttleMs
    this.lastSent = {}
  }

  sendThrottled(messageType, data) {
    const now = Date.now()
    const last = this.lastSent[messageType] || 0
    
    if (now - last > this.throttleMs) {
      this.wsClient.send({
        type: messageType,
        ...data
      })
      this.lastSent[messageType] = now
    }
  }
}

// Usage
const throttledWS = new ThrottledWS(wsClient, 100)  // Max 10x per second

game.on('playerMoved', (x, y, direction) => {
  throttledWS.sendThrottled('player_moved', { x, y, direction })
})
```

### Memory Cleanup

```javascript
// Detach listeners when component unmounts
onUnmounted(() => {
  // Remove specific listeners
  wsClient.off('chat_message', messageHandler)
  
  // Or disconnect completely
  wsClient.disconnect()
})
```

---

## Debugging WebSocket

### Browser DevTools

```javascript
// In browser console:

// See all events
wsClient.on('message', (data) => {
  console.table(data)
})

// Monitor connection state
console.log('Connected:', wsClient.isConnected)
console.log('Queue size:', wsClient.messageQueue.length)

// Manually send (testing)
wsClient.send({
  type: 'chat_message',
  body: 'test',
  to_user_id: 2
})
```

### Server Logging

```python
# Backend logs
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# In ws handler
logger.debug(f"Received from {user_id}: {message}")
logger.debug(f"Broadcasting to room {room}: {len(users)} users")
logger.debug(f"Queue size: {len(manager.active_connections)}")
```

### Network Monitoring

```bash
# Use websocat to test WS server directly
websocat ws://localhost:8000/ws?token=YOUR_TOKEN

# Send test message
{"type": "ping"}

# Should echo back or server responds
```

---

## Summary Checklist

```
✅ Backend WebSocket Endpoint
  - Accept connection via /ws?token=...
  - Verify JWT token
  - Manage connections (add/remove)
  - Route messages by type

✅ ConnectionManager
  - Track active_connections per user_id
  - Track rooms with user sets
  - Send to specific user
  - Broadcast to room
  - Broadcast to all

✅ Frontend WebSocket Client
  - Connect with token in query
  - Auto-reconnect with exponential backoff
  - Event emitter pattern
  - Message queueing when offline
  - Graceful disconnect

✅ Message Types
  - Chat: direct messages
  - Matchmaking: join/match found
  - Game sync: player movements
  - Notifications: friend requests
  - Presence: online status

✅ Error Handling
  - Token verification
  - Connection timeouts
  - Message timeouts
  - Graceful disconnects
  - Auto-reconnect

✅ Performance
  - Throttle frequent messages
  - Compress data format
  - Memory cleanup
  - Connection pooling
```

