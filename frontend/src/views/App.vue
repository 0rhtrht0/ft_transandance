<template>
  <div id="app">
    <template v-if="isIntroRoute">
      <RouterView />
    </template>
    <template v-else>
      <a class="skip-link" href="#app-main">Skip to main content</a>
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {{ liveAnnouncement }}
      </div>
      <div id="app-main" ref="mainRegion" tabindex="-1">
        <RouterView />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, provide, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getApiBase, getWsBase } from '../utils/runtimeEndpoints.js'

const readStoredUserId = () => {
  const raw = localStorage.getItem('userId')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const userId = ref(readStoredUserId())
const token = ref(localStorage.getItem('accessToken') || '')
const route = useRoute()
const mainRegion = ref(null)
const liveAnnouncement = ref('')
const isIntroRoute = computed(() => route.name === 'intro')

const apiUrl = getApiBase()
const wsBase = getWsBase()
const wsUrl = (() => {
  try {
    const parsed = new URL(wsBase)
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')
    return `${parsed.host}${path}`
  } catch {
    return String(wsBase).replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/+$/, '')
  }
})()

const onlineUsers = ref(new Set())

provide('currentUserId', userId)
provide('jwtToken', token)
provide('apiUrl', apiUrl)
provide('wsUrl', wsUrl)
provide('onlineUsers', onlineUsers)

onMounted(() => {
  if (import.meta.env.DEV) {
    console.log('[App] Initialized')
    console.log('[App] Current user:', userId.value)
    console.log('[App] API URL:', apiUrl)
  }
})

const refreshAuthState = () => {
  userId.value = readStoredUserId()
  token.value = localStorage.getItem('accessToken') || ''
}

onMounted(() => {
  window.addEventListener('auth:updated', refreshAuthState)
})

onUnmounted(() => {
  window.removeEventListener('auth:updated', refreshAuthState)
})

watch(
  () => route.fullPath,
  async () => {
    if (isIntroRoute.value) {
      liveAnnouncement.value = ''
      return
    }
    const label = String(route.meta?.title || route.name || 'current page').trim()
    liveAnnouncement.value = `Navigation complete: ${label}.`
    await nextTick()
    mainRegion.value?.focus?.()
  },
  { immediate: true }
)
</script>

<style scoped>
#app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

#app-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  outline: none;
}
</style>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 4000;
  transform: translateY(-140%);
  padding: 10px 14px;
  border-radius: 12px;
  background: #f5f5f5;
  color: #111111;
  text-decoration: none;
  font-weight: 700;
  transition: transform 0.2s ease;
}

.skip-link:focus {
  transform: translateY(0);
}
</style>
