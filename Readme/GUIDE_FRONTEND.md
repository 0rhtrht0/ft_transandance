# 🎨 Guide Complet Frontend - Étapes par Étapes

**Table des matières**
1. [Setup & Installation](#setup)
2. [Vue 3 Basics](#vue-basics)
3. [Structure du Projet](#structure)
4. [Vue Router](#router)
5. [Components](#components)
6. [Game Engine Canvas](#game)
7. [API Communication](#api)
8. [Démarrage du Frontend](#start)

---

## 1. Setup & Installation {#setup}

### Étape 1.1: Node.js & npm

```bash
# Vérifier Node.js 18+
node --version  # v18+ requis
npm --version   # v9+

# Naviguer au frontend
cd frontend
```

### Étape 1.2: Installer Dépendances

```bash
# Installer tous les packages
npm install

# Vérifier installation
npm list vue vue-router vite

# Output attendu:
# frontend@1.0.0
# ├── vue@3.5.28
# ├── vue-router@5.0.3
# └── vite@7.1.12
```

### Étape 1.3: Configuration Vite

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  
  server: {
    host: 'localhost',
    port: 5173,
    hmr: {
      host: 'localhost',
      port: 5173
    }
  },
  
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false
  }
})
```

---

## 2. Vue 3 Basics {#vue-basics}

### Étape 2.1: Vue 3 Composition API

```vue
<!-- Example Component -->
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p>Count: {{ count }}</p>
    
    <button @click="increment">Increment</button>
    <button @click="decrement">Decrement</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// État réactif
const count = ref(0)
const title = 'Counter App'

// Computed (dérivé)
const doubled = computed(() => count.value * 2)

// Fonctions
const increment = () => count.value++
const decrement = () => count.value--

// Lifecycle
onMounted(() => console.log('Component mounted'))
onUnmounted(() => console.log('Component unmounted'))
</script>

<style scoped>
.container {
  padding: 20px;
  background: #f0f0f0;
  border-radius: 8px;
}

button {
  margin: 5px;
  padding: 10px 20px;
  cursor: pointer;
}
</style>
```

### Étape 2.2: Réactivité

```javascript
// Reactivity Examples

// ref() - Valeur primitive réactive
const count = ref(0)
count.value++  // Augmente

// reactive() - Objet réactif
const user = reactive({
  name: 'John',
  email: 'john@test.com'
})
user.name = 'Jane'  // Mise à jour

// computed() - Valeur dérivée réactive
const fullName = computed(() => 
  `${user.firstName} ${user.lastName}`
)

// watch() - Observer un changement
watch(count, (newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`)
})

// watchEffect() - Observer automatiquement
watchEffect(() => {
  console.log(`Count is now ${count.value}`)
})
```

### Étape 2.3: Lifecycle Hooks

```javascript
import { onMounted, onUnmounted, onUpdated } from 'vue'

export default {
  setup() {
    onMounted(() => {
      console.log('Component mounted')
      // Fetch data, init listeners
    })
    
    onUpdated(() => {
      console.log('Component updated')
      // Respond to changes
    })
    
    onUnmounted(() => {
      console.log('Component unmounted')
      // Cleanup listeners, timers
    })
    
    return {}
  }
}
```

---

## 3. Structure du Projet {#structure}

### Étape 3.1: Arborescence

```
frontend/
├── src/
│   ├── App.vue                 ← Root component
│   ├── main.js                 ← Entry point
│   ├── router/
│   │   └── index.js           ← Vue Router config
│   ├── views/                 ← Pages (route components)
│   │   ├── App.vue
│   │   ├── AuthView.vue
│   │   ├── MenuView.vue
│   │   ├── MazeView.vue
│   │   └── ...
│   ├── components/            ← Reusable components
│   │   ├── ChatWidget.vue
│   │   ├── NotificationsWidget.vue
│   │   └── ...
│   ├── composables/           ← Vue composables (hooks)
│   │   ├── useAuth.js
│   │   ├── useFetch.js
│   │   └── ...
│   ├── game/                  ← Game engine (vanilla JS)
│   │   ├── main.js
│   │   ├── affichage.js
│   │   ├── deplacement.js
│   │   ├── level.js
│   │   └── historique.js
│   ├── assets/                ← Static files
│   │   ├── fonts/
│   │   ├── images/
│   │   └── sounds/
│   └── ui/                    ← Global styles
│       └── styles.css
├── index.html                 ← HTML template
├── package.json
├── vite.config.js
└── vitest.config.js
```

### Étape 3.2: main.js - Entry Point

```javascript
// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Global styles
import './ui/styles.css'

const app = createApp(App)

// Register plugins
app.use(router)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error(`Error: ${info}`, err)
  // Send to error tracking service
}

// Mount
app.mount('#app')
```

### Étape 3.3: App.vue - Root Component

```vue
<!-- src/App.vue -->
<template>
  <div id="app">
    <!-- Main router view -->
    <RouterView />
    
    <!-- Global components (visible partout) -->
    <ChatWidget 
      v-if="isAuthenticated"
      :current-user-id="userId"
      :jwt-token="token"
    />
    
    <NotificationsWidget ref="notificationsWidget" />
  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue'
import { useRouter } from 'vue-router'
import ChatWidget from '@/components/ChatWidget.vue'
import NotificationsWidget from '@/components/NotificationsWidget.vue'

const router = useRouter()

// Auth state
const userId = ref(localStorage.getItem('userId'))
const token = ref(localStorage.getItem('accessToken'))

const isAuthenticated = computed(() => userId.value && token.value)

// Provide to all child components
provide('userId', userId)
provide('token', token)
provide('isAuthenticated', isAuthenticated)

// Methods
const handleLogout = () => {
  localStorage.clear()
  router.push('/auth')
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  background: #1a1a1a;
  color: #fff;
}

#app {
  min-height: 100vh;
}
</style>
```

---

## 4. Vue Router {#router}

### Étape 4.1: Router Configuration

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

// Views
import AuthView from '@/views/AuthView.vue'
import MenuView from '@/views/MenuView.vue'
import MazeView from '@/views/MazeView.vue'
import FriendsView from '@/views/FriendsView.vue'

// Check if user is authenticated
const isAuthenticated = () => {
  return !!localStorage.getItem('accessToken')
}

// Routes
const routes = [
  {
    path: '/auth',
    name: 'Auth',
    component: AuthView,
    meta: { layout: 'blank' }
  },
  {
    path: '/menu',
    name: 'Menu',
    component: MenuView,
    meta: { requiresAuth: true }
  },
  {
    path: '/maze',
    name: 'Maze',
    component: MazeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/friends',
    name: 'Friends',
    component: FriendsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    redirect: () => isAuthenticated() ? '/menu' : '/auth'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guard global pour authentication
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuth = isAuthenticated()
  
  if (requiresAuth && !isAuth) {
    next('/auth')
  } else if (to.path === '/auth' && isAuth) {
    next('/menu')
  } else {
    next()
  }
})

// Hook après navigation
router.afterEach((to) => {
  document.title = `Transcendence - ${to.name}`
})

export default router
```

### Étape 4.2: Navigation Programmatique

```javascript
// Navigation
import { useRouter } from 'vue-router'

const router = useRouter()

// Aller à une route
router.push('/menu')

// Aller avec params
router.push({
  name: 'UserProfile',
  params: { userId: 123 }
})

// Aller avec query params
router.push({
  path: '/maze',
  query: { difficulty: 'hard', stage: 5 }
})

// Remplacer l'historique
router.replace('/menu')

// Retour
router.back()
```

### Étape 4.3: Route Parameters

```javascript
// Route définition
{
  path: '/user/:id',
  name: 'UserProfile',
  component: UserProfileView
}

// Component - Accéder au param
<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const userId = route.params.id  // Récupère /:id

// Query params
const difficulty = route.query.difficulty  // ?difficulty=hard
</script>
```

---

## 5. Components {#components}

### Étape 5.1: Créer un Component Réutilisable

```vue
<!-- src/components/UserCard.vue -->
<template>
  <div class="user-card">
    <img :src="user.avatar" :alt="user.username" class="avatar">
    
    <div class="info">
      <h3>{{ user.username }}</h3>
      <p>{{ user.email }}</p>
      <p class="status" :class="user.isOnline ? 'online' : 'offline'">
        {{ user.isOnline ? '🟢 Online' : '🔴 Offline' }}
      </p>
    </div>
    
    <div class="actions">
      <button @click="$emit('add-friend')">Add Friend</button>
      <button @click="$emit('message')">Message</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  user: {
    type: Object,
    required: true,
    validator: (obj) => 'username' in obj && 'email' in obj
  }
})

defineEmits(['add-friend', 'message'])
</script>

<style scoped>
.user-card {
  display: flex;
  gap: 15px;
  padding: 15px;
  background: #2a2a2a;
  border-radius: 8px;
  align-items: center;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.info {
  flex: 1;
}

.info h3 {
  margin-bottom: 5px;
}

.status {
  font-size: 12px;
}

.status.online {
  color: #0f0;
}

.status.offline {
  color: #f00;
}

.actions button {
  margin-right: 10px;
  padding: 8px 15px;
  background: #0066cc;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #fff;
}

.actions button:hover {
  background: #0052a3;
}
</style>
```

### Étape 5.2: Utiliser le Component

```vue
<!-- src/views/FriendsView.vue -->
<template>
  <div class="friends-view">
    <h1>My Friends</h1>
    
    <div class="friends-list">
      <UserCard 
        v-for="friend in friends" 
        :key="friend.id"
        :user="friend"
        @add-friend="handleAddFriend"
        @message="handleMessage"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import UserCard from '@/components/UserCard.vue'

const friends = ref([])

onMounted(async () => {
  // Fetch friends
  const response = await fetch('/api/friends', {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
  })
  friends.value = await response.json()
})

const handleAddFriend = (friend) => {
  console.log('Add friend:', friend)
}

const handleMessage = (friend) => {
  console.log('Message:', friend)
}
</script>
```

### Étape 5.3: Slots pour Flexibilité

```vue
<!-- src/components/Card.vue -->
<template>
  <div class="card">
    <div class="card-header">
      <slot name="header">Default Header</slot>
    </div>
    
    <div class="card-body">
      <slot>Default Content</slot>
    </div>
    
    <div class="card-footer">
      <slot name="footer">Default Footer</slot>
    </div>
  </div>
</template>

<script setup>
// Pas besoin de script si juste des slots
</script>

<style scoped>
.card {
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  padding: 15px;
  border-bottom: 1px solid #444;
  font-weight: bold;
}

.card-body {
  padding: 15px;
}

.card-footer {
  padding: 15px;
  border-top: 1px solid #444;
  text-align: right;
}
</style>

<!-- Utilisation -->
<Card>
  <template #header>
    My Custom Header
  </template>
  
  <p>Custom content here</p>
  
  <template #footer>
    <button>Save</button>
  </template>
</Card>
```

---

## 6. Game Engine Canvas {#game}

### Étape 6.1: Canvas Setup

```vue
<!-- src/views/MazeView.vue -->
<template>
  <div class="maze-container">
    <canvas 
      ref="gameCanvas"
      width="1200"
      height="800"
      class="game-canvas"
    ></canvas>
    
    <div class="hud">
      <div class="score">Score: {{ score }}</div>
      <div class="time">Time: {{ formatTime(time) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import GameEngine from '@/game/main.js'

const gameCanvas = ref(null)
const score = ref(0)
const time = ref(0)

let gameEngine = null
let timerInterval = null

onMounted(() => {
  // Initialize game
  gameEngine = new GameEngine(gameCanvas.value)
  gameEngine.onScoreChange = (newScore) => {
    score.value = newScore
  }
  
  // Start game loop
  gameEngine.start()
  
  // Timer
  timerInterval = setInterval(() => {
    time.value++
  }, 1000)
})

onUnmounted(() => {
  // Cleanup
  if (gameEngine) gameEngine.stop()
  if (timerInterval) clearInterval(timerInterval)
})

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.maze-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  top: 20px;
  left: 20px;
  color: #fff;
  font-size: 18px;
  z-index: 10;
}

.score, .time {
  margin-bottom: 10px;
}
</style>
```

### Étape 6.2: Vanilla JS Game Engine

```javascript
// src/game/main.js
export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.running = false
    
    // Game state
    this.player = { x: 100, y: 100, size: 20 }
    this.maze = []
    this.score = 0
  }
  
  start() {
    this.running = true
    this.generateMaze()
    this.gameLoop()
  }
  
  stop() {
    this.running = false
  }
  
  generateMaze() {
    // Generate maze grid
    const gridSize = 20
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      for (let x = 0; x < this.canvas.width; x += gridSize) {
        this.maze.push({
          x, y,
          width: gridSize,
          height: gridSize,
          walkable: Math.random() > 0.3
        })
      }
    }
  }
  
  gameLoop = () => {
    this.update()
    this.render()
    
    if (this.running) {
      requestAnimationFrame(this.gameLoop)
    }
  }
  
  update() {
    // Update game state
    // Handle collisions, movement, etc
  }
  
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    // Draw maze
    this.ctx.fillStyle = '#444'
    for (const cell of this.maze) {
      if (!cell.walkable) {
        this.ctx.fillRect(cell.x, cell.y, cell.width, cell.height)
      }
    }
    
    // Draw player
    this.ctx.fillStyle = '#00ff00'
    this.ctx.fillRect(
      this.player.x,
      this.player.y,
      this.player.size,
      this.player.size
    )
  }
}
```

---

## 7. API Communication {#api}

### Étape 7.1: Composable useFetch

```javascript
// src/composables/useFetch.js
import { ref } from 'vue'

export function useFetch(url, options = {}) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  
  const execute = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          ...options.headers
        },
        ...options
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      data.value = await response.json()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  
  return { data, loading, error, execute }
}
```

### Étape 7.2: Utiliser useFetch

```vue
<!-- src/views/MenuView.vue -->
<template>
  <div class="menu">
    <h1>Menu</h1>
    
    <div v-if="loading" class="loading">Loading...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div v-if="data" class="stats">
      <p>Score: {{ data.score }}</p>
      <p>Level: {{ data.level }}</p>
    </div>
    
    <button @click="fetchStats">Refresh</button>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useFetch } from '@/composables/useFetch'

const { data, loading, error, execute } = useFetch('/api/users/me')

onMounted(() => {
  execute()
})

const fetchStats = () => {
  execute()
}
</script>
```

### Étape 7.3: WebSocket Connection

```javascript
// src/composables/useWebSocket.js
import { ref } from 'vue'

export function useWebSocket(url) {
  const connected = ref(false)
  const messages = ref([])
  let ws = null
  
  const connect = () => {
    const token = localStorage.getItem('accessToken')
    const wsUrl = `${url}?token=${token}`
    
    ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      connected.value = true
      console.log('WebSocket connected')
    }
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      messages.value.push(data)
    }
    
    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }
    
    ws.onclose = () => {
      connected.value = false
      console.log('WebSocket closed')
    }
  }
  
  const send = (data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }
  
  const disconnect = () => {
    if (ws) ws.close()
  }
  
  return { connected, messages, connect, send, disconnect }
}
```

---

## 8. Démarrage du Frontend {#start}

### Étape 8.1: Démarrer le Dev Server

```bash
# Depuis frontend/
npm run dev

# Output attendu:
# VITE v7.1.12  ready in 345 ms
# 
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

### Étape 8.2: Build pour Production

```bash
# Build optimisé
npm run build

# Preview du build
npm run preview

# Output:
# ➜  Local:   http://localhost:4173/
```

### Étape 8.3: Tester Components

```bash
# Lancer les tests unitaires
npm run test:unit

# Watch mode
npm run test:unit:watch

# E2E tests
npm run test:e2e

# E2E UI
npm run test:e2e:ui
```

---

## Résumé des Étapes

```
✅ 1. Setup: Node + npm install
✅ 2. Vue 3: Composition API basics
✅ 3. Structure: Dossiers et organisation
✅ 4. Router: Navigation et guards
✅ 5. Components: Réutilisables et slots
✅ 6. Canvas: Game engine intégration
✅ 7. API: Communication avec backend
✅ 8. Startup: Dev server et tests
```

**Frontend prêt! ✅**
