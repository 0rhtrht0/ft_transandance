# Frontend Documentation Détaillée

## Table des matières
1. [Structure du Projet](#structure)
2. [Setup Local](#setup)
3. [Routing & Navigation](#routing)
4. [Composants Principaux](#composants)
5. [Game Engine](#engine)
6. [API & WebSocket Client](#client)
7. [Exemples d'Utilisation](#exemples)
8. [Tests](#tests)

---

## Structure du Projet {#structure}

```
frontend/
├── src/
│   ├── main.js                      # App entry point (Vue mount)
│   │
│   ├── views/                       # Route-level Vue components
│   │   ├── App.vue                  # Root layout (header, nav, slots)
│   │   ├── AuthView.vue             # Login/Signup page
│   │   ├── MenuView.vue             # Main menu (level/difficulty select)
│   │   ├── IngameView.vue           # In-game UI overlay
│   │   ├── MazeView.vue             # Maze game canvas
│   │   ├── GameoverView.vue         # Game over screen
│   │   ├── VictoryView.vue          # Victory screen
│   │   ├── IntroView.vue            # Intro/splash screen
│   │   ├── FriendsView.vue          # Friends management
│   │   ├── CreditsView.vue          # Credits
│   │   └── ...
│   │
│   ├── components/                  # Reusable Vue components
│   │   ├── ChatWidget.vue           # Chat UI + messaging
│   │   ├── GameChatHUD.vue          # In-game chat overlay
│   │   ├── NotificationsWidget.vue  # Notifications panel
│   │   ├── ...
│   │
│   ├── routes/                      # Non-Vue route logic (HTML/JS/CSS)
│   │   ├── auth/
│   │   │   ├── auth.html            # Auth form HTML
│   │   │   ├── auth.js              # Auth logic (login, signup)
│   │   │   ├── auth_api.js          # Auth API calls
│   │   │   ├── auth_storage.js      # localStorage management
│   │   │   └── auth.css
│   │   │
│   │   ├── menu/
│   │   │   ├── menu.html
│   │   │   ├── menu.js              # Menu logic
│   │   │   ├── level_selector.js    # Difficulty/stage selection
│   │   │   ├── multiplayer_selector.js
│   │   │   ├── leaderboard.js
│   │   │   └── menu.css
│   │   │
│   │   ├── ingame/
│   │   │   ├── ingame.html
│   │   │   ├── ingame.js            # Main ingame loop
│   │   │   ├── ingame_difficulty.js # Load difficulty from query
│   │   │   ├── ingame_stage.js      # Load stage from query
│   │   │   ├── ingame_multiplayer.js# Multiplayer game handling
│   │   │   ├── maze.html
│   │   │   ├── maze.js              # Maze rendering setup
│   │   │   │
│   │   │   ├── engine/
│   │   │   │   ├── game.js          # Main Game class (loop)
│   │   │   │   ├── renderer.js      # Canvas rendering
│   │   │   │   ├── input_handler.js # Keyboard input
│   │   │   │   └── collision.js     # Physics
│   │   │   │
│   │   │   ├── scene/
│   │   │   │   ├── GameScene.js     # Main game scene
│   │   │   │   ├── Player.js        # Player class
│   │   │   │   ├── Maze.js          # Maze generator (seed-based)
│   │   │   │   ├── Enemy.js         # Enemy AI
│   │   │   │   └── Item.js          # Collectibles
│   │   │   │
│   │   │   ├── network/
│   │   │   │   ├── GameClient.js    # WebSocket client for game
│   │   │   │   └── game-state-sync.js # State reconciliation
│   │   │   │
│   │   │   └── ingame.css
│   │   │
│   │   ├── friends/
│   │   │   ├── friends.html
│   │   │   ├── friends.js
│   │   │   ├── friends_api.js
│   │   │   └── friends.css
│   │   │
│   │   ├── credits/
│   │   │   └── ...
│   │   │
│   │   └── intro/
│   │       └── ...
│   │
│   ├── core/                        # Shared utilities
│   │   ├── api.js                   # HTTP client (fetch wrapper)
│   │   ├── websocket.js             # WebSocket client
│   │   ├── constants.js             # Game constants (speeds, etc.)
│   │   └── utils.js                 # Helpers
│   │
│   ├── router/
│   │   └── index.js                 # Vue Router configuration
│   │
│   ├── network/                     # Network layer
│   │   ├── api_client.js            # REST API client
│   │   ├── ws_client.js             # WebSocket client
│   │   └── ...
│   │
│   ├── ui/
│   │   ├── styles.css               # Global styles
│   │   ├── route-transition.css     # Route animations
│   │   └── ...
│   │
│   ├── assets/
│   │   ├── fonts/
│   │   ├── images/
│   │   ├── sounds/
│   │   └── ...
│   │
│   └── tests/
│       ├── GameChatHUD.test.js
│       ├── setup.js
│       └── ...
│
├── tests/
│   ├── e2e/
│   │   └── basic.spec.js            # Playwright E2E tests
│   └── ...
│
├── public/
│   └── index.html
│
├── vite.config.js                   # Vite configuration
├── playwright.config.js             # E2E test configuration
├── package.json                     # Dependencies
├── package-lock.json
└── index.html
```

---

## Setup Local {#setup}

### Prérequis
- Node.js 16+
- npm ou yarn

### Étapes

```bash
# 1. Aller dans frontend
cd frontend

# 2. Installer dépendances
npm install

# 3. Créer .env (copie de .env.example)
cp .env.example .env
# Éditer VITE_API_URL et VITE_WS_URL

# 4. Lancer dev server
npm run dev

# 5. Ouvrir http://localhost:5173
open http://localhost:5173

# Production build
npm run build

# Preview production build
npm run preview

# Run E2E tests
npm run test:e2e

# Run unit tests
npm run test:unit
```

### Variables d'Environnement
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

---

## Routing & Navigation {#routing}

### Vue Router Configuration

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/auth',
    component: AuthView,
    meta: { requiresGuest: true }  // Only if not authenticated
  },
  {
    path: '/menu',
    component: MenuView,
    meta: { requiresAuth: true }   // Only if authenticated
  },
  {
    path: '/ingame',
    component: IngameView,
    meta: { requiresAuth: true }
  },
  {
    path: '/maze',
    component: MazeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/gameover',
    component: GameoverView,
    meta: { requiresAuth: true }
  },
  {
    path: '/victory',
    component: VictoryView,
    meta: { requiresAuth: true }
  },
  {
    path: '/friends',
    component: FriendsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/intro',
    component: IntroView
  },
  {
    path: '/',
    redirect: '/intro'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guard: Check auth on every route
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('access_token')
  
  if (to.meta.requiresAuth && !token) {
    next('/auth')
  } else if (to.meta.requiresGuest && token) {
    next('/menu')
  } else {
    next()
  }
})

export default router
```

### Navigation Flow

```
/intro (splash) 
  ↓
/auth (login/signup) 
  ↓
/menu (select level/difficulty) 
  ↓
/ingame (game UI overlay) + /maze (game canvas)
  ↓
/gameover (loss) OR /victory (win)
  ↓
/leaderboard / /friends
  ↓
Back to /menu
```

---

## Composants Principaux {#composants}

### 1. ChatWidget.vue

Gère le chat en temps réel avec historique et notifications.

```vue
<template>
  <div class="chat-widget">
    <div class="conversations-list">
      <div v-for="conv in conversations" :key="conv.id" 
           @click="selectConversation(conv.id)">
        {{ conv.other_user.username }}
      </div>
    </div>
    
    <div v-if="selectedConversation" class="message-area">
      <div class="messages">
        <div v-for="msg in messages" :key="msg.id"
             :class="{ own: msg.sender_id === userId }">
          {{ msg.body }}
        </div>
      </div>
      
      <input v-model="messageBody" @keyup.enter="sendMessage">
      <button @click="sendMessage">Send</button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      conversations: [],
      selectedConversation: null,
      messages: [],
      messageBody: '',
      userId: null
    }
  },
  
  async mounted() {
    this.userId = this.$root.currentUserId
    
    // Load conversation history (REST)
    const res = await fetch(
      `${process.env.VITE_API_URL}/api/messages/conversations`,
      { headers: { 'Authorization': `Bearer ${this.token}` } }
    )
    this.conversations = (await res.json()).conversations
    
    // Connect to WebSocket for real-time
    this.connectWebSocket()
  },
  
  methods: {
    connectWebSocket() {
      const token = localStorage.getItem('access_token')
      this.ws = new WebSocket(
        `${process.env.VITE_WS_URL}/ws?token=${token}`
      )
      
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        
        if (msg.type === 'message' && msg.event === 'message.received') {
          // Add to current conversation
          this.messages.push(msg.data)
        } else if (msg.type === 'notification') {
          // Handle notifications
        }
      }
    },
    
    async selectConversation(convId) {
      this.selectedConversation = convId
      
      // Load message history
      const res = await fetch(
        `${process.env.VITE_API_URL}/api/messages/${convId}?limit=50`,
        { headers: { 'Authorization': `Bearer ${this.token}` } }
      )
      this.messages = (await res.json()).messages
    },
    
    sendMessage() {
      if (!this.messageBody.trim()) return
      
      const payload = {
        type: 'message',
        event: 'message.send',
        data: {
          recipient_id: this.selectedConversation,
          body: this.messageBody
        }
      }
      
      this.ws.send(JSON.stringify(payload))
      this.messageBody = ''
    }
  }
}
</script>

<style scoped>
.chat-widget {
  display: grid;
  grid-template-columns: 1fr 2fr;
  height: 400px;
  background: #222;
  border-radius: 8px;
}
/* ... */
</style>
```

### 2. NotificationsWidget.vue

Affiche les notifications (friend requests, game invites, etc.).

```vue
<template>
  <div class="notifications-widget">
    <div class="bell-icon" @click="togglePanel">
      🔔
      <span v-if="unreadCount > 0" class="badge">
        {{ unreadCount }}
      </span>
    </div>
    
    <div v-if="panelOpen" class="notification-panel">
      <div v-for="notif in notifications" :key="notif.id" 
           class="notification-item">
        <div v-if="notif.type === 'friend_request'">
          <p>{{ notif.from_username }} sent you a friend request</p>
          <button @click="acceptRequest(notif.request_id)">Accept</button>
          <button @click="rejectRequest(notif.request_id)">Reject</button>
        </div>
        
        <div v-else-if="notif.type === 'game_invite'">
          <p>{{ notif.from_username }} invited you to play</p>
          <button @click="joinGame(notif.room_id)">Join</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      notifications: [],
      panelOpen: false,
      unreadCount: 0,
      ws: null
    }
  },
  
  mounted() {
    this.connectWebSocket()
  },
  
  methods: {
    connectWebSocket() {
      const token = localStorage.getItem('access_token')
      this.ws = new WebSocket(
        `${process.env.VITE_WS_URL}/ws?token=${token}`
      )
      
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        
        if (msg.type === 'notification') {
          this.notifications.push({
            id: Date.now(),
            ...msg.data
          })
          this.unreadCount++
        }
      }
    },
    
    togglePanel() {
      this.panelOpen = !this.panelOpen
      if (this.panelOpen) this.unreadCount = 0
    },
    
    async acceptRequest(requestId) {
      await fetch(
        `${process.env.VITE_API_URL}/api/friends/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ request_id: requestId })
        }
      )
      this.notifications = this.notifications.filter(n => n.request_id !== requestId)
    }
  }
}
</script>

<style scoped>
.bell-icon {
  position: relative;
  cursor: pointer;
  font-size: 24px;
}

.badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: red;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.notification-panel {
  position: absolute;
  top: 40px;
  right: 0;
  background: #333;
  border: 1px solid #555;
  border-radius: 8px;
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
}

/* ... */
</style>
```

### 3. GameChatHUD.vue

Chat intégré pendant le jeu (overlay).

```vue
<template>
  <div class="game-chat-hud">
    <div class="chat-messages">
      <div v-for="msg in recentMessages" :key="msg.id" 
           :class="{ mine: msg.sender_id === userId }">
        <span class="username">{{ msg.username }}</span>
        <span class="body">{{ msg.body }}</span>
      </div>
    </div>
    
    <input v-if="showInput" v-model="inputText" 
           @keyup.enter="sendMessage"
           placeholder="Say something...">
    
    <button @click="toggleInput">Chat</button>
  </div>
</template>

<script>
export default {
  props: ['roomId', 'token'],
  
  data() {
    return {
      recentMessages: [],
      showInput: false,
      inputText: '',
      userId: null,
      ws: null
    }
  },
  
  mounted() {
    this.userId = parseInt(localStorage.getItem('user_id'))
    this.connectToGameRoom()
  },
  
  methods: {
    connectToGameRoom() {
      this.ws = new WebSocket(
        `${process.env.VITE_WS_URL}/ws?room=${this.roomId}&token=${this.token}`
      )
      
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'message') {
          this.recentMessages.push(msg.data)
          // Keep only last 10 messages
          if (this.recentMessages.length > 10) {
            this.recentMessages.shift()
          }
        }
      }
    },
    
    sendMessage() {
      this.ws.send(JSON.stringify({
        type: 'message',
        event: 'message.send',
        data: {
          body: this.inputText,
          room_id: this.roomId
        }
      }))
      this.inputText = ''
    },
    
    toggleInput() {
      this.showInput = !this.showInput
    }
  }
}
</script>

<style scoped>
.game-chat-hud {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #444;
  border-radius: 8px;
  color: #fff;
  min-width: 250px;
}

.chat-messages {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
}

.chat-messages > div {
  margin-bottom: 8px;
  font-size: 12px;
}

.chat-messages .mine {
  color: #4df;
  text-align: right;
}

input {
  width: 100%;
  padding: 8px;
  background: #333;
  border: none;
  border-top: 1px solid #555;
  color: #fff;
}

button {
  width: 100%;
  padding: 8px;
  background: #555;
  color: #fff;
  border: none;
  cursor: pointer;
}

/* ... */
</style>
```

---

## Game Engine {#engine}

### 1. Game Class (Main Loop)

```javascript
// routes/ingame/engine/game.js
export class Game {
  constructor(canvas, config = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.width = canvas.width
    this.height = canvas.height
    
    this.isRunning = false
    this.deltaTime = 0
    this.lastFrameTime = 0
    this.fps = config.fps || 60
    this.frameInterval = 1000 / this.fps
    
    this.scene = null
    this.inputHandler = null
    this.renderer = null
  }
  
  initialize(scene, inputHandler, renderer) {
    this.scene = scene
    this.inputHandler = inputHandler
    this.renderer = renderer
  }
  
  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastFrameTime = Date.now()
    this.update()
  }
  
  stop() {
    this.isRunning = false
  }
  
  update() {
    if (!this.isRunning) return
    
    const now = Date.now()
    this.deltaTime = (now - this.lastFrameTime) / 1000
    this.lastFrameTime = now
    
    // Game logic update
    if (this.scene) {
      this.scene.update(this.deltaTime)
    }
    
    // Render
    this.render()
    
    // Loop
    requestAnimationFrame(() => this.update())
  }
  
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.width, this.height)
    
    // Render scene
    if (this.renderer && this.scene) {
      this.renderer.render(this.ctx, this.scene)
    }
  }
  
  handleInput(key) {
    if (this.inputHandler) {
      this.inputHandler.handleKey(key)
    }
  }
}
```

### 2. GameScene Class

```javascript
// routes/ingame/scene/GameScene.js
export class GameScene {
  constructor(config) {
    this.difficulty = config.difficulty // facile, moyen, difficile
    this.stage = config.stage
    this.seed = config.seed
    
    this.width = 800
    this.height = 600
    
    // Generate maze with seed
    this.maze = new Maze(this.width, this.height, this.seed)
    
    // Create player
    this.player = new Player(
      this.width / 2,
      this.height / 2,
      this.getDifficultyConfig()
    )
    
    // Create enemies based on difficulty
    this.enemies = []
    this.createEnemies()
    
    // Items/collectibles
    this.items = []
    this.createItems()
    
    // Game state
    this.score = 0
    this.health = 100
    this.time = 0
    this.isGameOver = false
    this.isWon = false
  }
  
  getDifficultyConfig() {
    const configs = {
      facile: {
        playerSpeed: 150,
        enemySpeed: 60,
        enemyCount: 2,
        itemCount: 15
      },
      moyen: {
        playerSpeed: 150,
        enemySpeed: 100,
        enemyCount: 4,
        itemCount: 10
      },
      difficile: {
        playerSpeed: 150,
        enemySpeed: 140,
        enemyCount: 6,
        itemCount: 5
      }
    }
    return configs[this.difficulty]
  }
  
  createEnemies() {
    const config = this.getDifficultyConfig()
    for (let i = 0; i < config.enemyCount; i++) {
      const enemy = new Enemy(
        Math.random() * this.width,
        Math.random() * this.height,
        config.enemySpeed
      )
      this.enemies.push(enemy)
    }
  }
  
  createItems() {
    const config = this.getDifficultyConfig()
    for (let i = 0; i < config.itemCount; i++) {
      const item = new Item(
        Math.random() * this.width,
        Math.random() * this.height
      )
      this.items.push(item)
    }
  }
  
  update(deltaTime) {
    if (this.isGameOver || this.isWon) return
    
    this.time += deltaTime
    
    // Update player
    this.player.update(deltaTime)
    
    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(deltaTime, this.player)
      
      // Check collision with player
      if (this.checkCollision(this.player, enemy)) {
        this.health -= 10
        if (this.health <= 0) {
          this.isGameOver = true
        }
      }
    }
    
    // Check item collection
    const collectedItems = []
    for (let i = 0; i < this.items.length; i++) {
      if (this.checkCollision(this.player, this.items[i])) {
        this.score += 100
        collectedItems.push(i)
      }
    }
    
    // Remove collected items
    for (let i = collectedItems.length - 1; i >= 0; i--) {
      this.items.splice(collectedItems[i], 1)
    }
    
    // Win condition: collect all items and reach exit
    if (this.items.length === 0 && this.player.reachedExit()) {
      this.isWon = true
    }
  }
  
  checkCollision(obj1, obj2) {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    )
  }
}
```

### 3. Maze Generator (Seed-based)

```javascript
// routes/ingame/scene/Maze.js
export class Maze {
  constructor(width, height, seed) {
    this.width = width
    this.height = height
    this.seed = seed
    
    this.rng = new SeededRandom(seed)
    this.cellSize = 50
    this.cols = Math.floor(width / this.cellSize)
    this.rows = Math.floor(height / this.cellSize)
    
    this.grid = this.generateMaze()
  }
  
  generateMaze() {
    // Initialize grid (1 = wall, 0 = path)
    const grid = Array(this.rows)
      .fill(null)
      .map(() => Array(this.cols).fill(1))
    
    // Use recursive backtracking with seeded RNG
    const visited = Array(this.rows)
      .fill(null)
      .map(() => Array(this.cols).fill(false))
    
    const carve = (x, y) => {
      visited[y][x] = true
      grid[y][x] = 0
      
      // Shuffle directions
      const directions = [
        [0, -2], // up
        [2, 0],  // right
        [0, 2],  // down
        [-2, 0]  // left
      ]
      
      // Shuffle with seeded RNG
      for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]]
      }
      
      // Carve paths
      for (const [dx, dy] of directions) {
        const nx = x + dx
        const ny = y + dy
        
        if (nx > 0 && nx < this.cols && ny > 0 && ny < this.rows && !visited[ny][nx]) {
          grid[y + dy / 2][x + dx / 2] = 0
          carve(nx, ny)
        }
      }
    }
    
    carve(1, 1)
    return grid
  }
  
  isWalkable(x, y) {
    const col = Math.floor(x / this.cellSize)
    const row = Math.floor(y / this.cellSize)
    
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return false
    }
    
    return this.grid[row][col] === 0
  }
}

// Seeded RNG for reproducibility
class SeededRandom {
  constructor(seed) {
    this.seed = this.hashCode(seed)
  }
  
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
  
  hashCode(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash)
  }
}
```

### 4. Player Class

```javascript
// routes/ingame/scene/Player.js
export class Player {
  constructor(x, y, config) {
    this.x = x
    this.y = y
    this.width = 30
    this.height = 30
    
    this.speed = config.playerSpeed // pixels/sec
    this.velocityX = 0
    this.velocityY = 0
    
    this.health = 100
  }
  
  update(deltaTime) {
    // Apply velocity
    this.x += this.velocityX * this.speed * deltaTime
    this.y += this.velocityY * this.speed * deltaTime
    
    // Clamp to bounds
    this.x = Math.max(0, Math.min(this.x, 800 - this.width))
    this.y = Math.max(0, Math.min(this.y, 600 - this.height))
    
    // Reset velocity each frame (controlled by input)
    this.velocityX = 0
    this.velocityY = 0
  }
  
  moveUp() {
    this.velocityY = -1
  }
  
  moveDown() {
    this.velocityY = 1
  }
  
  moveLeft() {
    this.velocityX = -1
  }
  
  moveRight() {
    this.velocityX = 1
  }
  
  reachedExit() {
    // Exit is at bottom-right corner
    return this.x > 750 && this.y > 550
  }
}
```

---

## API & WebSocket Client {#client}

### 1. HTTP Client Wrapper

```javascript
// core/api.js
const API_URL = process.env.VITE_API_URL

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token')
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  })
  
  if (response.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('access_token')
    window.location.href = '/auth'
  }
  
  if (!response.ok) {
    throw new Error(
      `API Error ${response.status}: ${response.statusText}`
    )
  }
  
  return response.json()
}

// Helper functions
export const api = {
  // Auth
  signup: (email, username, password) =>
    apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, username, password })
    }),
  
  login: (email, password) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  
  getMe: () =>
    apiFetch('/api/auth/me'),
  
  // Friends
  sendFriendRequest: (user_id) =>
    apiFetch('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ user_id })
    }),
  
  acceptFriendRequest: (request_id) =>
    apiFetch('/api/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ request_id })
    }),
  
  getFriendsList: () =>
    apiFetch('/api/friends/list'),
  
  getFriendRequests: () =>
    apiFetch('/api/friends/requests'),
  
  // Messages
  sendMessage: (recipient_id, body) =>
    apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id, body })
    }),
  
  getConversations: () =>
    apiFetch('/api/messages/conversations'),
  
  getMessages: (conversation_id, limit = 50, offset = 0) =>
    apiFetch(`/api/messages/${conversation_id}?limit=${limit}&offset=${offset}`),
  
  // Progression
  startStage: (difficulty, stage) =>
    apiFetch('/api/progression/start_stage', {
      method: 'POST',
      body: JSON.stringify({ difficulty, stage })
    }),
  
  completeStage: (difficulty, stage, score, time_seconds) =>
    apiFetch('/api/progression/complete_stage', {
      method: 'POST',
      body: JSON.stringify({ difficulty, stage, score, time_seconds })
    }),
  
  getProgression: () =>
    apiFetch('/api/progression'),
  
  // Matchmaking
  joinMatchmaking: (difficulty) =>
    apiFetch('/api/matchmaking/join', {
      method: 'POST',
      body: JSON.stringify({ difficulty })
    }),
  
  leaveMatchmaking: () =>
    apiFetch('/api/matchmaking/leave', {
      method: 'POST'
    }),
  
  // Game Results
  saveGameResult: (score, time_seconds, difficulty, stage, is_multiplayer, winner_id) =>
    apiFetch('/api/game_results', {
      method: 'POST',
      body: JSON.stringify({
        score,
        time_seconds,
        difficulty,
        stage,
        is_multiplayer,
        winner_id
      })
    }),
  
  getGameHistory: (limit = 20, offset = 0) =>
    apiFetch(`/api/game_history?limit=${limit}&offset=${offset}`),
  
  // Leaderboard
  getLeaderboard: (difficulty, limit = 10) =>
    apiFetch(`/api/leaderboard?difficulty=${difficulty}&limit=${limit}`)
}
```

### 2. WebSocket Client

```javascript
// core/websocket.js
export class WebSocketClient {
  constructor(url, token, options = {}) {
    this.url = url
    this.token = token
    this.options = options
    
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
    
    this.listeners = new Map()
    this.isConnected = false
  }
  
  connect(roomId = null) {
    let url = `${this.url}?token=${this.token}`
    if (roomId) url += `&room=${roomId}`
    
    this.ws = new WebSocket(url)
    
    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connected')
    }
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    }
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.isConnected = false
      this.attemptReconnect()
    }
  }
  
  handleMessage(message) {
    const key = `${message.type}:${message.event}`
    
    if (this.listeners.has(key)) {
      for (const callback of this.listeners.get(key)) {
        callback(message.data)
      }
    }
  }
  
  on(type, event, callback) {
    const key = `${type}:${event}`
    if (!this.listeners.has(key)) {
      this.listeners.set(key, [])
    }
    this.listeners.get(key).push(callback)
  }
  
  emit(event, data = {}) {
    if (!this.isConnected) return
    
    this.ws.send(JSON.stringify({
      type: 'client',
      event,
      data
    }))
  }
  
  send(type, event, data) {
    if (!this.isConnected) {
      console.warn('WebSocket not connected')
      return
    }
    
    this.ws.send(JSON.stringify({
      type,
      event,
      data
    }))
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(
        `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      )
      setTimeout(() => this.connect(), this.reconnectDelay)
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}
```

---

## Exemples d'Utilisation {#exemples}

### Exemple 1: Login Complet

```javascript
// routes/auth/auth.js
import { api } from '../../core/api.js'

export async function handleLogin(email, password) {
  try {
    const response = await api.login(email, password)
    
    // Store token
    localStorage.setItem('access_token', response.access_token)
    localStorage.setItem('user_id', response.user_id)
    
    // Emit event for other components
    window.dispatchEvent(new CustomEvent('auth:updated', {
      detail: { user_id: response.user_id }
    }))
    
    // Redirect to menu
    window.location.href = '/menu'
    
  } catch (error) {
    console.error('Login failed:', error)
    alert('Invalid credentials')
  }
}
```

### Exemple 2: Démarrer Jeu Solo

```javascript
// routes/ingame/ingame.js
import { api } from '../../core/api.js'
import { Game } from './engine/game.js'
import { GameScene } from './scene/GameScene.js'

export async function initIngame() {
  // Get params from URL
  const params = new URLSearchParams(window.location.search)
  const difficulty = params.get('difficulty')
  const stage = parseInt(params.get('stage'))
  
  // Start stage (get seed)
  const gameConfig = await api.startStage(difficulty, stage)
  
  // Initialize game engine
  const canvas = document.getElementById('gameCanvas')
  const game = new Game(canvas)
  
  const scene = new GameScene({
    difficulty,
    stage,
    seed: gameConfig.seed
  })
  
  game.initialize(scene, inputHandler, renderer)
  game.start()
  
  // Listen for game end
  window.addEventListener('game:complete', async (e) => {
    const { score, time } = e.detail
    
    await api.completeStage(difficulty, stage, score, time)
    
    // Save result
    await api.saveGameResult(
      score,
      time,
      difficulty,
      stage,
      false // is_multiplayer
    )
    
    // Redirect
    window.location.href = '/victory'
  })
}
```

### Exemple 3: Matchmaking & Jeu Multijoueur

```javascript
// routes/menu/multiplayer_selector.js
import { api } from '../../core/api.js'
import { WebSocketClient } from '../../core/websocket.js'

export async function startMatchmaking(difficulty) {
  try {
    // Join queue
    const response = await api.joinMatchmaking(difficulty)
    
    if (response.status === 'matched') {
      // Match found!
      const roomId = response.room_id
      const seed = response.seed
      
      // Connect to game room
      const token = localStorage.getItem('access_token')
      const ws = new WebSocketClient(
        process.env.VITE_WS_URL,
        token
      )
      
      ws.connect(roomId)
      
      ws.on('game', 'matched', (data) => {
        console.log('Game started!')
        
        // Redirect to ingame with room info
        window.location.href = `
          /ingame?
          difficulty=${difficulty}&
          room=${roomId}&
          seed=${seed}&
          multiplayer=true
        `
      })
      
    } else {
      // Waiting in queue
      console.log(`Queue position: ${response.queue_position}`)
      
      // Poll until match
      const pollInterval = setInterval(async () => {
        const status = await api.checkMatchmaking()
        if (status.status === 'matched') {
          clearInterval(pollInterval)
          // Matched!
          startMatchmaking(difficulty)
        }
      }, 2000)
    }
    
  } catch (error) {
    console.error('Matchmaking failed:', error)
  }
}
```

---

## Tests {#tests}

### E2E Tests (Playwright)

```javascript
// tests/e2e/basic.spec.js
import { test, expect } from '@playwright/test'

test('Complete auth flow', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5173')
  
  // Should redirect to intro
  expect(page.url()).toContain('/intro')
  
  // Click login
  await page.click('button:has-text("Login")')
  
  // Fill form
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  
  // Should redirect to menu
  await page.waitForURL('**/menu', { timeout: 5000 })
  expect(page.url()).toContain('/menu')
  
  // Check for difficulty selector
  await expect(page.locator('text=Facile')).toBeVisible()
})

test('Play game solo', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:5173/auth')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/menu')
  
  // Select difficulty
  await page.click('text=Moyen')
  await page.click('text=Stage 1')
  
  // Game canvas should appear
  await expect(page.locator('#gameCanvas')).toBeVisible()
  
  // Simulate game input (arrow keys)
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowRight')
  
  // Wait for game to complete (or timeout after 30s)
  await page.waitForTimeout(5000)
})
```

### Unit Tests

```javascript
// tests/maze.test.js
import { Maze } from '../routes/ingame/scene/Maze.js'
import { expect, test } from 'vitest'

test('Maze generates consistently with same seed', () => {
  const maze1 = new Maze(800, 600, 'SEED1234')
  const maze2 = new Maze(800, 600, 'SEED1234')
  
  // Both mazes should be identical
  for (let y = 0; y < maze1.rows; y++) {
    for (let x = 0; x < maze1.cols; x++) {
      expect(maze1.grid[y][x]).toBe(maze2.grid[y][x])
    }
  }
})

test('Maze generates differently with different seeds', () => {
  const maze1 = new Maze(800, 600, 'SEED1234')
  const maze2 = new Maze(800, 600, 'SEED5678')
  
  // Mazes should be different
  let isDifferent = false
  for (let y = 0; y < maze1.rows; y++) {
    for (let x = 0; x < maze1.cols; x++) {
      if (maze1.grid[y][x] !== maze2.grid[y][x]) {
        isDifferent = true
        break
      }
    }
    if (isDifferent) break
  }
  
  expect(isDifferent).toBe(true)
})

test('Walkable positions return correct value', () => {
  const maze = new Maze(800, 600, 'TEST')
  
  // Center should be walkable (maze algorithm starts there)
  expect(maze.isWalkable(400, 300)).toBe(true)
  
  // Edges should likely be walls
  expect(maze.isWalkable(0, 0)).toBe(false)
})
```

---

## Performance & Optimization

### Canvas Optimization
- **Off-screen canvas**: Render complex scenes to off-screen canvas first
- **Dirty rectangle rendering**: Only redraw changed areas
- **Level of detail**: Reduce detail for distant objects

### Network Optimization
- **Message batching**: Batch game state updates
- **Compression**: Use compressed payloads for multiplayer sync
- **Throttling**: Throttle chat messages to avoid spam

### Memory Optimization
- **Object pooling**: Reuse objects instead of creating/destroying
- **Garbage collection**: Minimize allocations per frame
- **Lazy loading**: Load assets on demand

