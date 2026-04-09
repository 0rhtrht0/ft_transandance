# Guide Détaillé: Frontend - Fichiers & Composants

## Table des matières
1. [App.vue & Main Files](#app)
2. [Views (Écrans)](#views)
3. [Components (Composants Réutilisables)](#components)
4. [Game Engine (Moteur de Jeu)](#engine)
5. [Routing](#routing)
6. [WebSocket Integration](#ws)

---

## App.vue & Main Files {#app}

### src/views/App.vue (Root Component)

```vue
<!-- Root Vue component -->
<template>
  <div id="app" class="app-container">
    <!-- Navigation/Header -->
    <header v-if="isAuthenticated">
      <nav>
        <router-link to="/menu">Menu</router-link>
        <router-link to="/friends">Friends</router-link>
        <router-link to="/game">Game</router-link>
        <button @click="logout">Logout</button>
      </nav>
    </header>

    <!-- Main Content (Route-based) -->
    <main>
      <router-view v-slot="{ Component }">
        <transition name="fade">
          <component :is="Component" :key="$route.path" />
        </transition>
      </router-view>
    </main>

    <!-- Notifications Widget (Always visible) -->
    <NotificationsWidget v-if="isAuthenticated" />

    <!-- Chat Widget (Always visible) -->
    <ChatWidget v-if="isAuthenticated" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NotificationsWidget from '@/components/NotificationsWidget.vue'
import ChatWidget from '@/components/ChatWidget.vue'

const router = useRouter()
const isAuthenticated = ref(false)

// Load user on mount
onMounted(async () => {
  const token = localStorage.getItem('token')
  if (token) {
    try {
      // Verify token is still valid
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      isAuthenticated.value = res.ok
    } catch (e) {
      isAuthenticated.value = false
      localStorage.removeItem('token')
    }
  }
})

// Logout
const logout = () => {
  localStorage.removeItem('token')
  isAuthenticated.value = false
  router.push('/auth')
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  background: #333;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
}

nav {
  display: flex;
  gap: 1rem;
}

main {
  flex: 1;
  overflow: auto;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
```

**Explication:**
- `<router-view>` = Affiche composant basé sur route
- `<transition>` = Animation fade en changeant d'écran
- `NotificationsWidget` & `ChatWidget` = Toujours visibles
- `onMounted()` = Vérifie token au démarrage
- `logout()` = Efface token + redirige vers auth

### src/main.js (Application Entry)

```javascript
import { createApp } from 'vue'
import router from './router'
import store from './store'  // Pinia or Vuex
import App from './views/App.vue'

// Global styles
import './ui/styles.css'
import './ui/route-transition.css'

const app = createApp(App)

// Register plugins
app.use(router)
app.use(store)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err, info)
  // Send to logging service
}

app.mount('#app')
```

**Utilisation:**
```bash
npm run dev  # Starts Vite dev server on :5173
# Hot Module Replacement (HMS) reloads on file change
```

---

## Views (Écrans) {#views}

### Views Structure

```
src/views/
├── App.vue                 # Root
├── AuthView.vue            # Login/Signup screen
├── MenuView.vue            # Main menu
├── FriendsView.vue         # Friends list & requests
├── GameoverView.vue        # Game over screen
├── IngameView.vue          # In-game UI (HUD)
├── IntroView.vue           # Intro/splash
├── MazeView.vue            # Game area
├── VictoryView.vue         # Victory screen
└── victory/                # Victory animations
    └── confetti.js
```

### AuthView.vue (Login/Signup)

```vue
<template>
  <div class="auth-view">
    <div class="auth-container">
      <h1>Transcendence</h1>

      <!-- Login Form -->
      <form v-if="!isSignup" @submit.prevent="login">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          required
        />
        <button type="submit" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
        <p>
          Don't have account?
          <a href="#" @click.prevent="isSignup = true">Sign up</a>
        </p>
        <div v-if="error" class="error">{{ error }}</div>
      </form>

      <!-- Signup Form -->
      <form v-else @submit.prevent="signup">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          v-model="username"
          type="text"
          placeholder="Username"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          required
          minlength="8"
        />
        <input
          v-model="passwordConfirm"
          type="password"
          placeholder="Confirm Password"
          required
        />
        <button type="submit" :disabled="loading || password !== passwordConfirm">
          {{ loading ? 'Creating...' : 'Sign up' }}
        </button>
        <p>
          Already have account?
          <a href="#" @click.prevent="isSignup = false">Login</a>
        </p>
        <div v-if="error" class="error">{{ error }}</div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isSignup = ref(false)
const email = ref('')
const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref('')

// Login
const login = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value })
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail || 'Login failed')
    }

    const data = await res.json()
    localStorage.setItem('token', data.access_token)
    router.push('/menu')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Signup
const signup = async () => {
  if (password.value !== passwordConfirm.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        username: username.value,
        password: password.value
      })
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail || 'Signup failed')
    }

    // Auto-login after signup
    await login()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-container {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
}

button {
  padding: 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
}

button:hover:not(:disabled) {
  background: #5568d3;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  font-size: 0.9rem;
  text-align: center;
}

a {
  color: #667eea;
  text-decoration: none;
  cursor: pointer;
}

a:hover {
  text-decoration: underline;
}
</style>
```

**Explication:**
- `v-if="!isSignup"` = Affiche login ou signup
- `@submit.prevent="login"` = Empêche rechargement + appelle login()
- `v-model` = Two-way binding
- `localStorage.setItem('token', ...)` = Sauve token
- `router.push('/menu')` = Navigue vers menu

### MenuView.vue (Main Menu)

```vue
<template>
  <div class="menu-view">
    <div class="menu-container">
      <h1>Transcendence</h1>
      <p class="tagline">A multiplayer maze game</p>

      <nav class="main-menu">
        <router-link to="/game" class="btn btn-primary">
          Play Game
        </router-link>
        <router-link to="/friends" class="btn btn-secondary">
          Friends
        </router-link>
        <a href="#" @click.prevent="showStats" class="btn btn-secondary">
          Statistics
        </a>
      </nav>

      <div v-if="stats" class="stats">
        <h3>Your Stats</h3>
        <p>Games Played: {{ stats.games_played }}</p>
        <p>Win Rate: {{ stats.win_rate }}%</p>
        <p>Current Streak: {{ stats.current_streak }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const stats = ref(null)

onMounted(async () => {
  // Load stats from backend
  const token = localStorage.getItem('token')
  const res = await fetch('/api/users/me/stats', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) {
    stats.value = await res.json()
  }
})

const showStats = () => {
  // Toggle stats display
  console.log('Show detailed stats')
}
</script>

<style scoped>
.menu-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.menu-container {
  text-align: center;
  color: white;
}

h1 {
  font-size: 3rem;
  margin: 0 0 0.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.tagline {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.main-menu {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border-radius: 5px;
  text-decoration: none;
  transition: all 0.3s;
  display: inline-block;
}

.btn-primary {
  background: #4CAF50;
}

.btn-primary:hover {
  background: #45a049;
  transform: scale(1.05);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.stats {
  background: rgba(0, 0, 0, 0.2);
  padding: 1.5rem;
  border-radius: 10px;
  margin-top: 2rem;
}

.stats h3 {
  margin-top: 0;
}

.stats p {
  margin: 0.5rem 0;
}
</style>
```

### MazeView.vue (Game Area)

```vue
<template>
  <div class="maze-view">
    <!-- Canvas for game rendering -->
    <canvas
      ref="gameCanvas"
      :width="canvasWidth"
      :height="canvasHeight"
      class="game-canvas"
    />

    <!-- Overlay HUD -->
    <IngameView
      :player-stats="playerStats"
      :difficulty="difficulty"
      :stage="stage"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import IngameView from './IngameView.vue'
import Game from '@/game/main.js'

const gameCanvas = ref(null)
const canvasWidth = ref(window.innerWidth)
const canvasHeight = ref(window.innerHeight - 60)  // Subtract HUD
const game = ref(null)
const playerStats = ref({ health: 100, score: 0 })
const difficulty = ref(1)
const stage = ref(1)

onMounted(() => {
  // Initialize game engine
  const ctx = gameCanvas.value.getContext('2d')
  game.value = new Game(ctx, {
    width: canvasWidth.value,
    height: canvasHeight.value
  })

  // Start game loop
  game.value.start()

  // Listen for events
  game.value.on('playerUpdated', (stats) => {
    playerStats.value = stats
  })

  // Handle resize
  window.addEventListener('resize', () => {
    canvasWidth.value = window.innerWidth
    canvasHeight.value = window.innerHeight - 60
  })
})

onUnmounted(() => {
  game.value?.stop()
})
</script>

<style scoped>
.maze-view {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
```

---

## Components (Composants Réutilisables) {#components}

### ChatWidget.vue (Chat Floating)

```vue
<template>
  <div class="chat-widget">
    <!-- Minimized -->
    <div v-if="isMinimized" class="chat-header" @click="isMinimized = false">
      <span>Chat</span>
      <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
    </div>

    <!-- Expanded -->
    <div v-else class="chat-container">
      <div class="chat-header">
        <span>Chat</span>
        <button @click="isMinimized = true" class="minimize-btn">−</button>
      </div>

      <!-- Messages -->
      <div class="messages">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['message', msg.sender_id === currentUserId ? 'sent' : 'received']"
        >
          <strong>{{ msg.sender_username }}</strong>
          <p>{{ msg.body }}</p>
          <time>{{ formatTime(msg.created_at) }}</time>
        </div>
      </div>

      <!-- Input -->
      <form @submit.prevent="sendMessage">
        <input
          v-model="messageInput"
          type="text"
          placeholder="Type message..."
          @keyup.enter="sendMessage"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const isMinimized = ref(true)
const messages = ref([])
const messageInput = ref('')
const unreadCount = ref(0)
const currentUserId = ref(null)
const ws = ref(null)

onMounted(() => {
  // Get current user
  const token = localStorage.getItem('token')
  // Decode JWT to get user_id (simple decode)
  const payload = JSON.parse(atob(token.split('.')[1]))
  currentUserId.value = payload.sub

  // Connect to WebSocket
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
  ws.value = new WebSocket(`${wsUrl}/ws?token=${token}`)

  ws.value.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'message') {
      messages.value.push(data)
      if (data.sender_id !== currentUserId.value) {
        unreadCount.value++
      }
    }
  }

  // Load message history
  loadMessages()
})

onUnmounted(() => {
  ws.value?.close()
})

// Watch for minimized state
watch(() => isMinimized.value, (newVal) => {
  if (!newVal) {
    unreadCount.value = 0
  }
})

const loadMessages = async () => {
  const token = localStorage.getItem('token')
  const res = await fetch('/api/messages', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (res.ok) {
    const data = await res.json()
    messages.value = data.messages
  }
}

const sendMessage = async () => {
  if (!messageInput.value.trim()) return

  const token = localStorage.getItem('token')
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      to_user_id: 123,  // Target user
      body: messageInput.value
    })
  })

  if (res.ok) {
    messageInput.value = ''
  }
}

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString()
}
</script>

<style scoped>
.chat-widget {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px;
  max-height: 400px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  z-index: 1000;
}

.chat-header {
  background: #667eea;
  color: white;
  padding: 1rem;
  border-radius: 10px 10px 0 0;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.minimize-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.5rem;
  padding: 0;
}

.badge {
  background: #ff6b6b;
  padding: 0.25rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.message.sent {
  align-self: flex-end;
  background: #e8f5e9;
  padding: 0.5rem;
  border-radius: 5px;
}

.message.received {
  align-self: flex-start;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 5px;
}

.message strong {
  font-size: 0.85rem;
  color: #666;
}

.message p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.message time {
  font-size: 0.75rem;
  color: #999;
}

form {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #eee;
}

input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}

form button {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

form button:hover {
  background: #5568d3;
}
</style>
```

### NotificationsWidget.vue

```vue
<template>
  <div class="notifications-widget">
    <div
      v-for="notification in notifications"
      :key="notification.id"
      :class="['notification', notification.type]"
    >
      <div class="notification-content">
        <h4>{{ notification.title }}</h4>
        <p>{{ notification.message }}</p>
      </div>
      <button @click="dismissNotification(notification.id)" class="close-btn">
        ×
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const notifications = ref([])

onMounted(() => {
  const token = localStorage.getItem('token')
  const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`)

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'notification') {
      notifications.value.push({
        id: Date.now(),
        type: data.notification_type,
        title: data.title,
        message: data.message
      })

      // Auto-dismiss after 5s
      setTimeout(() => {
        dismissNotification(notifications.value[0].id)
      }, 5000)
    }
  }
})

const dismissNotification = (id) => {
  notifications.value = notifications.value.filter(n => n.id !== id)
}
</script>

<style scoped>
.notifications-widget {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
}

.notification {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification.success {
  border-left: 4px solid #4CAF50;
}

.notification.error {
  border-left: 4px solid #ff6b6b;
}

.notification.info {
  border-left: 4px solid #667eea;
}

.notification-content h4 {
  margin: 0 0 0.25rem;
}

.notification-content p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}
</style>
```

---

## Game Engine (Moteur de Jeu) {#engine}

### src/game/main.js (Game Controller)

```javascript
// Main game loop and controller
import GameScene from './GameScene.js'
import Player from './Player.js'
import Maze from './Maze.js'
import { generateMaze } from './level.js'

class Game {
  constructor(canvas, ctx, options = {}) {
    this.canvas = canvas
    this.ctx = ctx
    this.width = options.width || canvas.width
    this.height = options.height || canvas.height
    this.running = false

    // Game state
    this.difficulty = options.difficulty || 1
    this.stage = options.stage || 1
    this.seed = options.seed || 12345  // From backend

    // Initialize components
    this.maze = null
    this.player = null
    this.scene = new GameScene(this.ctx, this.width, this.height)

    // Game events
    this.listeners = {}
  }

  // Initialize and start game
  async start() {
    try {
      // Generate maze from seed
      const mazeData = generateMaze(
        this.seed,
        this.difficulty,
        this.width,
        this.height
      )
      this.maze = new Maze(mazeData)

      // Create player
      this.player = new Player(
        this.maze.startX,
        this.maze.startY,
        this.maze
      )

      // Setup event listeners
      this.setupInput()
      this.setupWebSocket()

      this.running = true
      this.gameLoop()
    } catch (e) {
      console.error('Failed to start game:', e)
      this.emit('error', e.message)
    }
  }

  // Main game loop (60 FPS)
  gameLoop() {
    if (!this.running) return

    // Update
    this.update()

    // Render
    this.render()

    requestAnimationFrame(() => this.gameLoop())
  }

  // Update game state
  update() {
    // Update player position
    this.player.update()

    // Check for collisions
    if (this.player.isCollidingWith(this.maze)) {
      this.player.revert()  // Undo movement
    }

    // Check win condition
    if (this.player.x === this.maze.endX && this.player.y === this.maze.endY) {
      this.completeLevel()
    }

    // Emit stats
    this.emit('playerUpdated', {
      health: this.player.health,
      score: this.player.score,
      x: this.player.x,
      y: this.player.y
    })
  }

  // Render to canvas
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.width, this.height)

    // Draw maze
    this.scene.drawMaze(this.maze)

    // Draw player
    this.scene.drawPlayer(this.player)

    // Draw HUD (separate component)
  }

  // Handle keyboard input
  setupInput() {
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          this.player.moveUp()
          break
        case 'ArrowDown':
        case 's':
          this.player.moveDown()
          break
        case 'ArrowLeft':
        case 'a':
          this.player.moveLeft()
          break
        case 'ArrowRight':
        case 'd':
          this.player.moveRight()
          break
      }
    })
  }

  // Connect to WebSocket for real-time multiplayer
  setupWebSocket() {
    const token = localStorage.getItem('token')
    const ws = new WebSocket(
      `${import.meta.env.VITE_WS_URL}/ws?token=${token}&room=${this.roomId}`
    )

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'player_moved') {
        // Update opponent position
        this.opponents = this.opponents || {}
        this.opponents[data.player_id] = {
          x: data.x,
          y: data.y
        }
      }
    }

    ws.send(JSON.stringify({
      type: 'player_joined',
      player_id: this.player.id
    }))

    this.ws = ws
  }

  // Complete level
  completeLevel() {
    this.running = false
    const endTime = Date.now()
    const timeTaken = Math.floor((endTime - this.startTime) / 1000)

    this.emit('levelComplete', {
      difficulty: this.difficulty,
      stage: this.stage,
      score: this.player.score,
      time_ms: timeTaken * 1000
    })

    // Send to backend
    this.sendResult()
  }

  // Send game result to backend
  async sendResult() {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/progression/complete_stage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        difficulty: this.difficulty,
        stage: this.stage,
        score: this.player.score,
        time_ms: Date.now() - this.startTime
      })
    })

    if (res.ok) {
      this.emit('resultSaved')
    }
  }

  // Stop game
  stop() {
    this.running = false
    if (this.ws) this.ws.close()
  }

  // Event system
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data))
    }
  }
}

export default Game
```

### src/game/GameScene.js (Rendering)

```javascript
// Canvas rendering

class GameScene {
  constructor(ctx, width, height) {
    this.ctx = ctx
    this.width = width
    this.height = height
    this.tileSize = 32
  }

  drawMaze(maze) {
    const tiles = maze.getTiles()

    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[row].length; col++) {
        const tile = tiles[row][col]
        const x = col * this.tileSize
        const y = row * this.tileSize

        if (tile === 'wall') {
          this.drawWall(x, y)
        } else if (tile === 'path') {
          this.drawPath(x, y)
        } else if (tile === 'exit') {
          this.drawExit(x, y)
        }
      }
    }
  }

  drawWall(x, y) {
    this.ctx.fillStyle = '#333'
    this.ctx.fillRect(x, y, this.tileSize, this.tileSize)
    this.ctx.strokeStyle = '#111'
    this.ctx.strokeRect(x, y, this.tileSize, this.tileSize)
  }

  drawPath(x, y) {
    this.ctx.fillStyle = '#222'
    this.ctx.fillRect(x, y, this.tileSize, this.tileSize)
  }

  drawExit(x, y) {
    this.ctx.fillStyle = '#FFD700'  // Gold
    this.ctx.fillRect(x, y, this.tileSize, this.tileSize)
  }

  drawPlayer(player) {
    const x = player.x * this.tileSize + this.tileSize / 2
    const y = player.y * this.tileSize + this.tileSize / 2
    const radius = this.tileSize / 3

    // Draw circle
    this.ctx.fillStyle = '#4CAF50'  // Green
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fill()

    // Draw direction indicator
    this.ctx.fillStyle = '#fff'
    const dirX = x + Math.cos(player.direction) * (radius * 0.6)
    const dirY = y + Math.sin(player.direction) * (radius * 0.6)
    this.ctx.fillRect(dirX - 2, dirY - 2, 4, 4)
  }

  drawHUD(stats) {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    this.ctx.fillRect(0, this.height - 60, this.width, 60)

    this.ctx.fillStyle = '#fff'
    this.ctx.font = '16px Arial'
    this.ctx.fillText(`Score: ${stats.score}`, 20, this.height - 30)
    this.ctx.fillText(`Health: ${stats.health}`, this.width / 2, this.height - 30)
  }
}

export default GameScene
```

### src/game/Maze.js (Maze Logic)

```javascript
// Maze representation and collision

class Maze {
  constructor(mazeData) {
    this.tiles = mazeData.tiles
    this.width = mazeData.width
    this.height = mazeData.height
    this.startX = mazeData.startX
    this.startY = mazeData.startY
    this.endX = mazeData.endX
    this.endY = mazeData.endY
    this.enemies = mazeData.enemies || []
  }

  getTiles() {
    return this.tiles
  }

  // Check if position is walkable
  isWalkable(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false
    }
    const tile = this.tiles[y][x]
    return tile !== 'wall'
  }

  // Check collision with walls
  hasWallAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return true
    }
    return this.tiles[y][x] === 'wall'
  }

  // Get distance to exit
  getDistanceToExit(x, y) {
    return Math.abs(x - this.endX) + Math.abs(y - this.endY)
  }
}

export default Maze
```

---

## Routing {#routing}

### src/router/index.js

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import App from '@/views/App.vue'
import AuthView from '@/views/AuthView.vue'
import MenuView from '@/views/MenuView.vue'
import FriendsView from '@/views/FriendsView.vue'
import MazeView from '@/views/MazeView.vue'
import IngameView from '@/views/IngameView.vue'
import GameoverView from '@/views/GameoverView.vue'
import VictoryView from '@/views/VictoryView.vue'

// Auth guard
const requireAuth = (to, from, next) => {
  const token = localStorage.getItem('token')
  if (token) {
    next()
  } else {
    next('/auth')
  }
}

const routes = [
  {
    path: '/',
    component: App,
    children: [
      {
        path: 'auth',
        component: AuthView
      },
      {
        path: 'menu',
        component: MenuView,
        beforeEnter: requireAuth
      },
      {
        path: 'friends',
        component: FriendsView,
        beforeEnter: requireAuth
      },
      {
        path: 'game',
        component: MazeView,
        beforeEnter: requireAuth,
        props: (route) => ({
          difficulty: route.query.difficulty,
          stage: route.query.stage
        })
      },
      {
        path: 'gameover',
        component: GameoverView
      },
      {
        path: 'victory',
        component: VictoryView
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

**Utilisation:**
```javascript
// Navigate
router.push('/menu')
router.push({ path: '/game', query: { difficulty: 1, stage: 1 } })
```

---

## WebSocket Integration {#ws}

### Real-time Features

```javascript
// Connect to WebSocket
const token = localStorage.getItem('token')
const ws = new WebSocket(
  `${import.meta.env.VITE_WS_URL}/ws?token=${token}`
)

// Listen for messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch (data.type) {
    // Friend requests
    case 'friend_request':
      console.log('New friend request from', data.from_user)
      // Show notification
      break
    
    // Messages
    case 'message':
      console.log('New message:', data.body)
      // Add to chat
      break
    
    // Game events
    case 'match_found':
      console.log('Match found!', data.room_id, data.opponent)
      router.push('/game')
      break
    
    case 'player_moved':
      console.log('Opponent moved to', data.x, data.y)
      // Update game
      break
  }
}

// Send messages
ws.send(JSON.stringify({
  type: 'join_queue',
  difficulty: 1
}))
```

