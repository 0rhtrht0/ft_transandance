# Guide Complet: Frontend Routing & Navigation

## Table des matières
1. [Vue Router Setup](#setup)
2. [Route Guards](#guards)
3. [Route Structure](#structure)
4. [Navigation Patterns](#patterns)
5. [State Persistence](#persistence)

---

## Vue Router Setup {#setup}

### router/index.js

```javascript
// frontend/src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import App from '@/views/App.vue'
import AuthView from '@/views/AuthView.vue'
import MenuView from '@/views/MenuView.vue'
import FriendsView from '@/views/FriendsView.vue'
import MazeView from '@/views/MazeView.vue'
import IngameView from '@/views/IngameView.vue'
import GameoverView from '@/views/GameoverView.vue'
import VictoryView from '@/views/VictoryView.vue'

// Define routes
const routes = [
  {
    path: '/',
    component: App,
    redirect: '/menu',
    children: [
      // Auth routes (no guard, public)
      {
        path: 'auth',
        name: 'auth',
        component: AuthView,
        meta: { requiresAuth: false }
      },

      // Protected routes (require authentication)
      {
        path: 'menu',
        name: 'menu',
        component: MenuView,
        meta: { requiresAuth: true, title: 'Main Menu' }
      },

      {
        path: 'friends',
        name: 'friends',
        component: FriendsView,
        meta: { requiresAuth: true, title: 'Friends' }
      },

      // Game routes
      {
        path: 'game',
        name: 'game',
        component: MazeView,
        meta: { requiresAuth: true, title: 'Game' },
        props: route => ({
          difficulty: parseInt(route.query.difficulty) || 1,
          stage: parseInt(route.query.stage) || 1,
          roomId: route.query.roomId,
          opponent: route.query.opponent,
          seed: parseInt(route.query.seed)
        })
      },

      {
        path: 'ingame',
        name: 'ingame',
        component: IngameView,
        meta: { requiresAuth: true }
      },

      // End game routes
      {
        path: 'gameover',
        name: 'gameover',
        component: GameoverView,
        meta: { requiresAuth: true },
        props: route => ({
          score: route.query.score,
          reason: route.query.reason
        })
      },

      {
        path: 'victory',
        name: 'victory',
        component: VictoryView,
        meta: { requiresAuth: true },
        props: route => ({
          difficulty: parseInt(route.query.difficulty),
          stage: parseInt(route.query.stage),
          score: parseInt(route.query.score),
          time: parseInt(route.query.time)
        })
      }
    ]
  },

  // Catch-all 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

// Create router instance
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Global navigation guard (before each route)
router.beforeEach((to, from, next) => {
  // Check authentication
  const token = localStorage.getItem('token')
  const isAuthenticated = !!token

  // Route requires auth but user not authenticated
  if (to.meta.requiresAuth && !isAuthenticated) {
    console.warn('Redirecting to auth: route requires authentication')
    next({ name: 'auth', query: { redirect: to.fullPath } })
    return
  }

  // User authenticated but going to auth page → redirect to menu
  if (to.name === 'auth' && isAuthenticated) {
    console.log('User already authenticated, redirecting to menu')
    next({ name: 'menu' })
    return
  }

  // Allow navigation
  next()
})

// After each route navigation
router.afterEach((to, from) => {
  // Update document title
  const title = to.meta.title || 'Transcendence'
  document.title = `${title} - Transcendence Labyrinth`

  // Track page view (for analytics)
  console.log('Navigated to:', to.path)
})

export default router
```

### Error Handling

```javascript
// Handle navigation errors
router.onError((error) => {
  console.error('Router error:', error)
  
  if (error.type === 4) {  // Navigation cancelled
    console.log('Navigation cancelled')
  }
})
```

---

## Route Guards {#guards}

### Authentication Guard

```javascript
// Guards/requireAuth.js

export function useAuthGuard() {
  const isAuthenticated = () => {
    const token = localStorage.getItem('token')
    return !!token && isTokenValid(token)
  }

  const isTokenValid = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000  // Convert to ms
      return Date.now() < exp
    } catch {
      return false
    }
  }

  const redirectToLogin = (router, currentPath) => {
    router.push({
      name: 'auth',
      query: { redirect: currentPath }
    })
  }

  return {
    isAuthenticated,
    isTokenValid,
    redirectToLogin
  }
}
```

### Admin Guard (Example)

```javascript
// Guards/requireAdmin.js

export function requireAdmin(to, from, next) {
  const token = localStorage.getItem('token')
  
  if (!token) {
    next('/auth')
    return
  }

  // Decode and check role
  const payload = JSON.parse(atob(token.split('.')[1]))
  
  if (payload.role === 'admin') {
    next()
  } else {
    console.warn('Insufficient permissions')
    next('/menu')
  }
}
```

### Role-Based Access Control

```javascript
// Guards/rbac.js

const ROLE_PERMISSIONS = {
  user: ['play', 'chat', 'friends'],
  moderator: ['play', 'chat', 'friends', 'ban_users'],
  admin: ['play', 'chat', 'friends', 'ban_users', 'manage_system']
}

export function checkPermission(requiredPermission) {
  return (to, from, next) => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      next('/auth')
      return
    }

    const payload = JSON.parse(atob(token.split('.')[1]))
    const userRole = payload.role || 'user'
    const permissions = ROLE_PERMISSIONS[userRole] || []

    if (permissions.includes(requiredPermission)) {
      next()
    } else {
      next('/menu')
    }
  }
}
```

---

## Route Structure {#structure}

### Nested Routes Example

```javascript
// Hierarchical route structure
{
  path: 'dashboard',
  component: DashboardLayout,
  children: [
    {
      path: 'profile',
      component: ProfilePage
    },
    {
      path: 'settings',
      component: SettingsPage
    },
    {
      path: 'statistics',
      component: StatisticsPage
    }
  ]
}

// URL structure:
// /dashboard/profile
// /dashboard/settings
// /dashboard/statistics
```

### Dynamic Routes

```javascript
// routes/[id].js pattern (like Next.js)
{
  path: 'user/:id',
  name: 'user',
  component: UserProfile,
  props: true  // Pass route params as props
}

// Usage:
router.push({ name: 'user', params: { id: 123 } })
// URL: /user/123

// In component:
export default {
  props: ['id'],
  mounted() {
    console.log('User ID:', this.id)
  }
}
```

### Query Parameters

```javascript
// Use for filters, pagination, state

// Navigate with query
router.push({
  path: '/game',
  query: {
    difficulty: 2,
    stage: 3,
    mode: 'pvp'
  }
})
// URL: /game?difficulty=2&stage=3&mode=pvp

// In component, access via $route
export default {
  computed: {
    difficulty() {
      return this.$route.query.difficulty || 1
    }
  }
}
```

---

## Navigation Patterns {#patterns}

### Programmatic Navigation

```javascript
import { useRouter } from 'vue-router'

export default {
  setup() {
    const router = useRouter()

    const goToMenu = () => {
      router.push({ name: 'menu' })
    }

    const goToGame = (difficulty, stage) => {
      router.push({
        name: 'game',
        query: { difficulty, stage }
      })
    }

    const goBack = () => {
      router.back()  // Like browser back button
    }

    const replaceRoute = () => {
      router.replace({ name: 'menu' })  // Replace, not push
    }

    return { goToMenu, goToGame, goBack, replaceRoute }
  }
}
```

### Router Links

```vue
<!-- Use <router-link> for navigation (better than <a>) -->

<template>
  <!-- Simple link -->
  <router-link to="/menu">Menu</router-link>

  <!-- Link to named route -->
  <router-link :to="{ name: 'game', query: { difficulty: 1 } }">
    Play
  </router-link>

  <!-- Link with active class -->
  <router-link to="/friends" active-class="active">
    Friends
  </router-link>

  <!-- Lazy link (vue-link-active) -->
  <router-link to="/settings" v-slot="{ isActive }">
    <span :class="{ active: isActive }">Settings</span>
  </router-link>
</template>
```

### Transition Between Routes

```vue
<template>
  <div>
    <!-- Use transition for route animations -->
    <Transition name="fade" mode="out-in">
      <router-view :key="$route.path" />
    </Transition>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
```

### Back Navigation with State

```javascript
// Save state before navigating
router.push({
  name: 'game',
  query: { returnTo: router.currentRoute.value.path }
})

// Later, use returnTo to go back
const returnPath = route.query.returnTo || '/menu'
router.push(returnPath)
```

---

## State Persistence {#persistence}

### Persist Navigation State

```javascript
// services/navigationState.js

class NavigationStateService {
  saveState(routeName, state) {
    const key = `nav_state_${routeName}`
    sessionStorage.setItem(key, JSON.stringify(state))
  }

  loadState(routeName) {
    const key = `nav_state_${routeName}`
    const data = sessionStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }

  clearState(routeName) {
    const key = `nav_state_${routeName}`
    sessionStorage.removeItem(key)
  }
}

export const navStateService = new NavigationStateService()
```

### Scroll Position Restoration

```javascript
// router/index.js

// Save scroll position before leaving
router.beforeEach((to, from, next) => {
  // Save current scroll
  if (from.name) {
    sessionStorage.setItem(
      `scroll_${from.name}`,
      window.scrollY
    )
  }
  next()
})

// Restore scroll position after navigation
router.afterEach((to, from) => {
  // Restore scroll from before
  setTimeout(() => {
    const savedScroll = sessionStorage.getItem(`scroll_${to.name}`)
    if (savedScroll) {
      window.scrollTo(0, parseInt(savedScroll))
    } else {
      window.scrollTo(0, 0)
    }
  }, 0)
})
```

### Route History Stack

```javascript
// services/routeHistory.js

class RouteHistoryService {
  constructor() {
    this.stack = []
    this.maxDepth = 10
  }

  push(route) {
    this.stack.push(route)
    
    // Limit stack size
    if (this.stack.length > this.maxDepth) {
      this.stack.shift()
    }
  }

  pop() {
    return this.stack.pop()
  }

  peek() {
    return this.stack[this.stack.length - 1]
  }

  clear() {
    this.stack = []
  }

  getStack() {
    return [...this.stack]
  }
}

export const routeHistory = new RouteHistoryService()

// Use in router
router.afterEach((to) => {
  routeHistory.push(to.path)
})
```

### Deep Linking (Restore App State from URL)

```javascript
// Reconstruct app state from URL on page load

export default {
  name: 'Game',
  props: ['difficulty', 'stage', 'roomId', 'opponent', 'seed'],

  mounted() {
    // Restore game state from URL
    this.initializeGame({
      difficulty: this.difficulty,
      stage: this.stage,
      roomId: this.roomId,
      opponent: this.opponent,
      seed: this.seed
    })
  },

  methods: {
    initializeGame(state) {
      // Reconstruct game from params
      console.log('Initializing game with state:', state)
      
      // User can now share this URL and others will join same game!
      // Example: /game?roomId=game_abc&opponent=player1&seed=12345
    }
  }
}
```

### URL-Based Filters (Search/Lists)

```vue
<template>
  <div>
    <!-- Filter results by difficulty -->
    <select v-model="selectedDifficulty" @change="updateFilter">
      <option value="">All Difficulties</option>
      <option value="1">Easy</option>
      <option value="2">Medium</option>
      <option value="3">Hard</option>
    </select>

    <!-- Pagination -->
    <div>
      <button @click="previousPage" :disabled="currentPage === 1">
        Previous
      </button>
      <span>Page {{ currentPage }}</span>
      <button @click="nextPage">Next</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const selectedDifficulty = ref(route.query.difficulty || '')
const currentPage = ref(parseInt(route.query.page) || 1)

// Sync to URL
const updateFilter = () => {
  router.push({
    query: {
      difficulty: selectedDifficulty.value,
      page: currentPage.value
    }
  })
}

const previousPage = () => {
  currentPage.value = Math.max(1, currentPage.value - 1)
  updateFilter()
}

const nextPage = () => {
  currentPage.value++
  updateFilter()
}

// Watch for URL changes
watch(() => route.query, (newQuery) => {
  selectedDifficulty.value = newQuery.difficulty || ''
  currentPage.value = parseInt(newQuery.page) || 1
})
</script>
```

