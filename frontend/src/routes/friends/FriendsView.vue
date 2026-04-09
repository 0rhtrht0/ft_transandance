<template>
  <main ref="sceneRef" class="friends-view" @pointermove="handleParallaxMove" @pointerleave="resetParallax">
    <canvas ref="galaxyCanvas" class="galaxy-canvas" aria-hidden="true"></canvas>
    <header class="view-header">
      <h1>
        <AppIcon name="blackhole" class="title-icon" :size="22" />
        Social
      </h1>
      <div class="header-actions">
        <nav class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'friends'"
            :class="{ active: activeTab === 'friends' }"
            @click="activeTab = 'friends'"
          >
            <AppIcon name="users" class="tab-icon" :size="16" />
            <span>Friends</span>
            <span v-if="pendingRequestsCount > 0" class="tab-badge">
              {{ pendingRequestsCount > 99 ? '99+' : pendingRequestsCount }}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'messages'"
            :class="{ active: activeTab === 'messages' }"
            @click="activeTab = 'messages'"
          >
            <span class="tab-icon-badge-wrap">
              <AppIcon name="message" class="tab-icon" :size="16" />
              <span v-if="unreadMessagesCount > 0" class="tab-icon-badge">
                {{ unreadMessagesCount > 99 ? '99+' : unreadMessagesCount }}
              </span>
            </span>
            <span>Chat</span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'notifications'"
            :class="{ active: activeTab === 'notifications' }"
            @click="activeTab = 'notifications'"
          >
            <span class="tab-icon-badge-wrap">
              <AppIcon name="bell" class="tab-icon" :size="16" />
              <span v-if="notificationBadgeCount > 0" class="tab-icon-badge">
                {{ notificationBadgeCount > 99 ? '99+' : notificationBadgeCount }}
              </span>
            </span>
            <span>Notifications</span>
          </button>
        </nav>

        <button
          type="button"
          class="close-btn"
          @click="goToMenu"
          title="Return to menu"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>
    </header>

    <SocialFriendsTab
      v-show="activeTab === 'friends'"
      :current-user-id="currentUserIdValue"
      :realtime-event="lastRealtimeEvent"
      @open-chat="handleOpenChat"
      @notify="handleNotify"
      @view-profile="handleViewProfile"
    />

    <SocialMessagesTab
      v-show="activeTab === 'messages'"
      :current-user-id="currentUserIdValue"
      :current-user-avatar="currentUserAvatar"
      :chat-target="chatTarget"
      :realtime-event="lastRealtimeEvent"
      :realtime-send="sendRealtimePayload"
      :is-active="activeTab === 'messages'"
      @message-sent="handleMessageSent"
      @notify="handleNotify"
      @unread-count-change="handleUnreadCountChange"
      @view-profile="handleViewProfile"
    />

    <SocialNotificationsTab
      v-show="activeTab === 'notifications'"
      :notifications="visibleNotifications"
      @mark-read="markAsRead"
      @remove="removeNotification"
      @clear-all="clearNotifications"
    />

    <UserProfileModal
      :open="profileOpen"
      :profile="selectedProfile"
      :loading="profileLoading"
      :error="profileError"
      @close="closeProfileModal"
    />
  </main>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'
import SocialFriendsTab from './components/SocialFriendsTab.vue'
import SocialMessagesTab from './components/SocialMessagesTab.vue'
import SocialNotificationsTab from './components/SocialNotificationsTab.vue'
import UserProfileModal from './components/UserProfileModal.vue'
import { useNotifications } from './composables/useNotifications'
import { fetchPendingRequests } from './services/requestsService'
import { fetchPublicProfile } from './services/profilesService'
import {
  buildSocialBadgeCounts,
  isIncomingFriendRequestNotificationType,
  isMessageNotificationType,
  isUnreadReceivedMessageNotification,
} from './utils/notificationBadges'
import { dispatchSocialNotification } from './utils/notificationDispatch'
import { clearSessionAndNotify } from '../auth/auth_storage.js'
import { getApiBase } from '../auth/auth_api.js'

const activeTab = ref('friends')
const chatTarget = ref(null)
const router = useRouter()

const currentUserId = inject('currentUserId', ref(null))
const jwtToken = inject('jwtToken', ref(''))
const wsUrl = inject('wsUrl', window.location.host)

const socialWs = ref(null)
const sceneRef = ref(null)
const reconnectTimer = ref(null)
const reconnectAttempts = ref(0)
const socialRefreshTimer = ref(null)
const isRefreshingSocialState = ref(false)
const manualClose = ref(false)
const lastRealtimeEvent = ref(null)
const wsEventSequence = ref(0)
const currentUserAvatar = ref(null)
const profileOpen = ref(false)
const profileLoading = ref(false)
const profileError = ref('')
const selectedProfile = ref(null)
const pendingRequestsCount = ref(0)
const unreadConversationCount = ref(0)
const galaxyCanvas = ref(null)
let stopGalaxySimulation = null

const setupGalaxySimulation = (canvas) => {
  if (!canvas) return () => {}
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) return () => {}

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const TAU = Math.PI * 2
  const armCount = 4
  const diskAxis = 0.57
  let backgroundStars = []
  let bulgeStars = []
  let diskStars = []
  let dustLanes = []
  let width = 0
  let height = 0
  let diskRadius = 0
  let bulgeRadius = 0
  let rafId = 0

  const randomBetween = (min, max) => min + Math.random() * (max - min)
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const randomNormal = () => {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
  }

  const getAngularVelocity = (radius) => {
    const normalized = radius / Math.max(diskRadius, 1)
    return 0.00018 / (0.22 + Math.sqrt(normalized + 0.02)) + 0.00002
  }

  const createGalaxyModel = () => {
    diskRadius = Math.min(width, height) * 0.48
    bulgeRadius = diskRadius * 0.2
    
    // Background
    backgroundStars = Array.from({ length: width < 760 ? 170 : 320 }, () => {
      const cool = Math.round(randomBetween(170, 240))
      return {
        alpha: randomBetween(0.14, 0.52),
        color: `rgb(${Math.round(cool * 0.78)}, ${cool}, ${Math.round(randomBetween(205, 255))})`,
        parallaxX: randomBetween(-28, 28),
        parallaxY: randomBetween(-18, 18),
        phase: randomBetween(0, TAU),
        size: randomBetween(0.18, 1.15),
        twinkle: randomBetween(0.00045, 0.0012),
        x: Math.random(),
        y: Math.random()
      }
    })

    // Bulge
    bulgeStars = Array.from({ length: width < 760 ? 240 : 420 }, () => {
      const spread = Math.pow(Math.random(), 1.9)
      const luminosity = clamp(0.45 + (1 - spread) * 0.55 + randomBetween(-0.08, 0.08), 0.25, 1)
      const gray = Math.round(80 + luminosity * 140)
      return {
        angle: randomBetween(0, TAU),
        color: `rgb(${gray}, ${gray}, ${gray})`,
        luminosity,
        phase: randomBetween(0, TAU),
        radialJitter: randomBetween(0.2, 3.4),
        radialOscillation: randomBetween(0.0008, 0.0018),
        radius: spread * bulgeRadius,
        size: randomBetween(0.22, 1.45) * (1.22 - spread * 0.48),
        spin: getAngularVelocity(spread * bulgeRadius * 0.8) * randomBetween(1.04, 1.35),
        twinkle: randomBetween(0.0015, 0.0033)
      }
    })

    // Disk
    diskStars = Array.from({ length: width < 760 ? 760 : 1420 }, () => {
      const spread = Math.pow(Math.random(), 0.72)
      const radius = spread * diskRadius
      const armBase = (Math.floor(Math.random() * armCount) / armCount) * TAU
      const spiralPhase = Math.log1p(spread * 7.2) * 3.1
      const luminosity = clamp(0.28 + (1 - spread) * 0.55 + randomBetween(-0.1, 0.08), 0.12, 0.95)
      const gray = Math.round(60 + luminosity * 150)
      return {
        angle: armBase + spiralPhase + randomNormal() * (0.045 + spread * 0.34),
        color: `rgb(${gray}, ${gray}, ${gray})`,
        luminosity,
        phase: randomBetween(0, TAU),
        radialJitter: randomBetween(0.5, 6.8) * (0.28 + spread),
        radialOscillation: randomBetween(0.00035, 0.0012),
        radius,
        size: randomBetween(0.14, 1.28) * (1.12 - spread * 0.54),
        spin: getAngularVelocity(radius) * randomBetween(0.86, 1.18),
        twinkle: randomBetween(0.0007, 0.002)
      }
    })

    // Dust
    dustLanes = Array.from({ length: width < 760 ? 120 : 220 }, () => {
      const spread = randomBetween(0.14, 0.74)
      const radius = spread * diskRadius
      const armBase = (Math.floor(Math.random() * armCount) / armCount) * TAU
      const spiralPhase = Math.log1p(spread * 7.2) * 3.1
      return {
        alpha: randomBetween(0.06, 0.2) * (1.1 - spread * 0.6),
        angle: armBase + spiralPhase + 0.26 + randomBetween(-0.08, 0.18) + randomNormal() * 0.13,
        length: randomBetween(12, 58) * (1.1 - spread * 0.36),
        phase: randomBetween(0, TAU),
        radialJitter: randomBetween(0.4, 5.4),
        radialOscillation: randomBetween(0.00028, 0.0011),
        radius,
        spin: getAngularVelocity(radius) * randomBetween(0.82, 1.08),
        thickness: randomBetween(1.2, 4.6) * (1.16 - spread * 0.42),
        twinkle: randomBetween(0.0005, 0.0016)
      }
    })
  }

  const drawGalaxy = (time) => {
    const mx = Number(sceneRef.value?.style.getPropertyValue('--mx')) || 0
    const my = Number(sceneRef.value?.style.getPropertyValue('--my')) || 0
    const centerX = width * 0.5 + mx * 44
    const centerY = height * 0.54 + my * 30

    context.clearRect(0, 0, width, height)

    // Bg stars
    backgroundStars.forEach(star => {
      const pulse = 0.65 + 0.35 * Math.sin(time * star.twinkle + star.phase)
      context.globalAlpha = star.alpha * pulse
      context.fillStyle = star.color
      context.beginPath()
      context.arc(star.x * width + mx * star.parallaxX, star.y * height + my * star.parallaxY, star.size * (0.82 + pulse * 0.35), 0, TAU)
      context.fill()
    })

    // Disk halo
    context.save()
    context.translate(centerX, centerY)
    context.scale(1, diskAxis)
    const halo = context.createRadialGradient(0, 0, 0, 0, 0, diskRadius * 1.16)
    halo.addColorStop(0, 'rgba(80, 80, 80, 0.24)')
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = halo
    context.beginPath()
    context.arc(0, 0, diskRadius * 1.16, 0, TAU)
    context.fill()
    context.restore()

    // Population stars
    const populations = [
      { stars: diskStars, axis: diskAxis },
      { stars: bulgeStars, axis: 0.84 }
    ]
    populations.forEach(p => {
      p.stars.forEach(star => {
        const radius = star.radius + Math.sin(time * star.radialOscillation + star.phase) * star.radialJitter
        const angle = star.angle + time * star.spin
        const pulse = 0.5 + 0.5 * Math.sin(time * star.twinkle + star.phase)
        context.globalAlpha = star.luminosity * (0.32 + pulse * 0.68)
        context.fillStyle = star.color
        context.beginPath()
        context.arc(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius * p.axis, star.size * (0.82 + pulse * 0.5), 0, TAU)
        context.fill()
      })
    })
    
    context.globalAlpha = 1
  }

  const resizeCanvas = () => {
    width = window.innerWidth
    height = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    createGalaxyModel()
  }

  const renderLoop = (time) => {
    drawGalaxy(time)
    rafId = requestAnimationFrame(renderLoop)
  }

  const startAnimation = () => {
    if (!reduceMotionQuery.matches) rafId = requestAnimationFrame(renderLoop)
  }

  resizeCanvas()
  startAnimation()
  window.addEventListener('resize', resizeCanvas)

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resizeCanvas)
  }
}

const handleParallaxMove = (e) => {
  const scene = sceneRef.value
  if (!scene) return
  const { left, top, width, height } = scene.getBoundingClientRect()
  const x = ((e.clientX - left) / width - 0.5) * 2
  const y = ((e.clientY - top) / height - 0.5) * 2
  scene.style.setProperty('--mx', x.toFixed(3))
  scene.style.setProperty('--my', y.toFixed(3))
}

const resetParallax = () => {
  const scene = sceneRef.value
  if (!scene) return
  scene.style.setProperty('--mx', '0')
  scene.style.setProperty('--my', '0')
}

const readStoredUserId = () => {
  const raw = localStorage.getItem('userId')
  if (raw === null || raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const currentUserIdValue = computed(() => {
  const value = normalizeId(currentUserId.value)
  if (value !== null) return value
  return readStoredUserId()
})

const {
  notifications,
  addNotification,
  addTransientNotification,
  loadNotifications,
  markAsRead,
  markMatchingAsRead,
  removeNotification,
  clearNotifications
} = useNotifications()

const socialBadgeCounts = computed(() =>
  buildSocialBadgeCounts({
    notifications: notifications.value,
    pendingRequestsCount: pendingRequestsCount.value,
    unreadConversationCount: unreadConversationCount.value
  })
)

const unreadMessagesCount = computed(() =>
  activeTab.value === 'messages' ? 0 : socialBadgeCounts.value.unreadMessages
)

const notificationBadgeCount = computed(() => socialBadgeCounts.value.unreadNotifications)
const visibleNotifications = computed(() =>
  Array.isArray(notifications.value) ? notifications.value : []
)

const resolveWsToken = () => {
  const raw = jwtToken?.value ?? jwtToken
  return raw || localStorage.getItem('accessToken') || ''
}

const resolveWsHost = () => {
  const raw = wsUrl?.value ?? wsUrl ?? window.location.host
  return String(raw)
    .replace(/^https?:\/\//, '')
    .replace(/^wss?:\/\//, '')
    .replace(/\/+$/, '')
}

const buildWsEndpoint = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = resolveWsHost()
  const token = resolveWsToken()
  const search = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${protocol}//${host}/ws${search}`
}

const hasSessionHint = () => Boolean(resolveWsToken()) || currentUserIdValue.value !== null

const clearReconnect = () => {
  if (reconnectTimer.value !== null) {
    window.clearTimeout(reconnectTimer.value)
    reconnectTimer.value = null
  }
}

const closeRealtimeSocket = () => {
  clearReconnect()
  const socket = socialWs.value
  socialWs.value = null
  if (socket) {
    socket.close()
  }
}

const handleExpiredSession = async () => {
  manualClose.value = true
  closeRealtimeSocket()
  clearSessionAndNotify()
  if (router.currentRoute.value.path !== '/auth') {
    await router.push('/auth')
  }
}

const sendRealtimePayload = (payload) => {
  const socket = socialWs.value
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false
  }

  try {
    socket.send(JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

const publishRealtimeEvent = (payload) => {
  wsEventSequence.value += 1
  lastRealtimeEvent.value = {
    id: wsEventSequence.value,
    payload
  }
}

const normalizeRealtimeEvent = (payload) => {
  const event = payload?.event
  const type = payload?.type

  if (event === 'conversation.message_created' || type === 'message') return 'message'
  if (event === 'notification.created' || type === 'notification') return 'notification'
  if (event === 'presence.online' || type === 'presence.online' || type === 'user_online') {
    return 'presence_online'
  }
  if (event === 'presence.offline' || type === 'presence.offline' || type === 'user_offline') {
    return 'presence_offline'
  }
  return 'unknown'
}

const refreshPendingRequestsCount = async () => {
  const currentId = currentUserIdValue.value
  if (!currentId) return

  try {
    const allRequests = await fetchPendingRequests()
    // Incoming requests: those where the current user is the addressee
    const incomingCount = allRequests.filter(req => {
      const targetId = Number(req?.addressee_id)
      return targetId === currentId
    }).length
    pendingRequestsCount.value = incomingCount
  } catch {
    // Silent refresh failure
  }
}

const refreshSocialState = async ({ silent = false } = {}) => {
  if (isRefreshingSocialState.value || !hasSessionHint()) {
    return false
  }

  isRefreshingSocialState.value = true
  try {
    await Promise.all([
      loadNotifications(),
      refreshPendingRequestsCount()
    ])
    return true
  } catch {
    if (!silent) {
      throw new Error('Unable to refresh social notifications.')
    }
    return false
  } finally {
    isRefreshingSocialState.value = false
  }
}

const startSocialRefreshLoop = () => {
  if (socialRefreshTimer.value !== null) {
    return
  }

  socialRefreshTimer.value = window.setInterval(() => {
    void refreshSocialState({ silent: true })
  }, 5000)
}

const stopSocialRefreshLoop = () => {
  if (socialRefreshTimer.value === null) {
    return
  }
  window.clearInterval(socialRefreshTimer.value)
  socialRefreshTimer.value = null
}

const handleVisibilityRefresh = () => {
  if (document.visibilityState === 'visible') {
    void refreshSocialState({ silent: true })
  }
}

const loadCurrentUserAvatar = async () => {
  const token = resolveWsToken()

  try {
    let response
    try {
      response = await fetch(`${getApiBase()}/users/profiles/me`, {
        credentials: 'include',
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      })
    } catch (err) {
      if (err.message && err.message.includes('NetworkError when attempting to fetch resource.')) {
        return
      }
      throw err
    }
    if (response.status === 401) {
      await handleExpiredSession()
      return
    }
    if (!response.ok) return
    const profile = await response.json()
    currentUserAvatar.value = profile?.avatar || null
  } catch {
    // Ignore silent avatar refresh errors.
  }
}

const connectRealtimeNotifications = () => {
  if (!hasSessionHint()) {
    return
  }
  clearReconnect()
  manualClose.value = false
  socialWs.value = new WebSocket(buildWsEndpoint())

  socialWs.value.onopen = async () => {
    const wasReconnect = reconnectAttempts.value > 0
    reconnectAttempts.value = 0
    if (wasReconnect) {
      await refreshSocialState({ silent: true })
      publishRealtimeEvent({ event: 'ws.reconnected' })
      return
    }
    await refreshSocialState({ silent: true })
    publishRealtimeEvent({ event: 'ws.connected' })
  }

  socialWs.value.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data)
      const kind = normalizeRealtimeEvent(payload)
      publishRealtimeEvent(payload)

      if (kind === 'notification' && payload.notification) {
        const notificationType = String(payload.notification.type || '').toLowerCase()
        await addTransientNotification(payload.notification)

        if (activeTab.value === 'messages' && isMessageNotificationType(notificationType)) {
          await markMatchingAsRead(isUnreadReceivedMessageNotification)
        }

        if (isIncomingFriendRequestNotificationType(notificationType) || notificationType.includes('friend_request')) {
          await refreshPendingRequestsCount()
        }

        void refreshSocialState({ silent: true })
      }
    } catch {
      // Ignore malformed WS payload
    }
  }

  socialWs.value.onclose = async (event) => {
    if (manualClose.value) return
    if (event.code === 1008) {
      await handleExpiredSession()
      return
    }
    reconnectAttempts.value += 1
    const delay = Math.min(15000, 1000 * 2 ** reconnectAttempts.value)
    reconnectTimer.value = window.setTimeout(() => {
      connectRealtimeNotifications()
    }, delay)
  }
}

const handleNotify = async (notification) => {
  await dispatchSocialNotification(notification, {
    refreshSocialState: () => refreshSocialState({ silent: true }),
    addNotification,
    addTransientNotification,
  })
}

const handleMessageSent = async () => {
  await loadNotifications()
}

const handleUnreadCountChange = (count) => {
  unreadConversationCount.value = Math.max(0, Math.trunc(Number(count) || 0))
}

const handleOpenChat = async (target) => {
  const resolvedId = Number(target?.userId ?? target?.id ?? target)
  if (!Number.isFinite(resolvedId)) return

  chatTarget.value = {
    userId: resolvedId,
    username: target?.username || 'User',
    avatar: target?.avatar || null,
    requestId: Date.now()
  }
  activeTab.value = 'messages'
  await handleNotify({
    type: 'chat',
    title: 'Chat',
    message: `Conversation with ${chatTarget.value.username} opened.`,
    read: false
  })
}

const closeProfileModal = () => {
  profileOpen.value = false
}

const handleViewProfile = async (target) => {
  const resolvedId = Number(target?.userId ?? target?.id ?? target)
  if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
    return
  }

  profileOpen.value = true
  profileLoading.value = true
  profileError.value = ''
  selectedProfile.value = null

  try {
    selectedProfile.value = await fetchPublicProfile(resolvedId)
  } catch (err) {
    profileError.value = err instanceof Error ? err.message : 'Unable to load this profile.'
  } finally {
    profileLoading.value = false
  }
}

const goToMenu = () => {
  router.push('/menu')
}

const ensureCurrentUserId = async () => {
  if (currentUserIdValue.value !== null) return
  const token = resolveWsToken()

  try {
    let response
    try {
      response = await fetch(`${getApiBase()}/auth/me`, {
        credentials: 'include',
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      })
    } catch (err) {
      if (err.message && err.message.includes('NetworkError when attempting to fetch resource.')) {
        return
      }
      throw err
    }
    if (response.status === 401) {
      await handleExpiredSession()
      return
    }
    if (!response.ok) return
    const me = await response.json()
    const resolved = Number(me?.id)
    if (!Number.isFinite(resolved)) return
    localStorage.setItem('userId', String(resolved))
    if (currentUserId?.value !== undefined) {
      currentUserId.value = resolved
    }
    window.dispatchEvent(new CustomEvent('auth:updated'))
  } catch {
    // Ignore silent refresh errors.
  }
}

onMounted(async () => {
  await ensureCurrentUserId()
  await Promise.all([
    loadCurrentUserAvatar(),
    refreshSocialState({ silent: true })
  ])
  if (hasSessionHint()) {
    connectRealtimeNotifications()
  }
  startSocialRefreshLoop()
  document.addEventListener('visibilitychange', handleVisibilityRefresh)
  if (galaxyCanvas.value) {
    stopGalaxySimulation = setupGalaxySimulation(galaxyCanvas.value)
  }
})

watch(
  () => activeTab.value,
  async (tab) => {
    if (tab === 'messages') {
      await markMatchingAsRead(isUnreadReceivedMessageNotification)
    }
  }
)

watch(
  () => jwtToken?.value ?? jwtToken,
  (value) => {
    if (value) {
      return
    }
    manualClose.value = true
    closeRealtimeSocket()
  }
)

onUnmounted(() => {
  manualClose.value = true
  closeRealtimeSocket()
  stopSocialRefreshLoop()
  document.removeEventListener('visibilitychange', handleVisibilityRefresh)
  if (stopGalaxySimulation) stopGalaxySimulation()
})
</script>

<style scoped>
.friends-view {
  --social-accent: #ffffff;
  --social-accent-glow: rgba(255, 255, 255, 0.2);
  --social-bg-0: #0a0a0a;
  --social-bg-1: #1a1a1a;
  --social-border: #333;
  --social-text: #fff;
  --social-muted: #888;
  --social-glass: #111;

  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  height: 100vh;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--social-bg-0);
  color: var(--social-text);
  position: relative;
  overflow: hidden;
  z-index: 1;
}

/* Parallax Canvas */
.galaxy-canvas {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: var(--social-glass);
  border: 1px solid var(--social-border);
  border-radius: 12px;
}

.view-header h1 {
  margin: 0;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tabs {
  display: flex;
  background: #000;
  padding: 4px;
  border-radius: 8px;
}

.tabs button {
  border: 1px solid transparent;
  background: transparent;
  color: var(--social-muted);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.tabs button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.tabs button:active {
  transform: scale(0.96);
}

.tabs button.active {
  background: #333333;
  color: #ffffff;
  font-weight: 700;
  border: 1px solid #444;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
}

.tab-badge {
  margin-left: 8px;
  background: #fff;
  color: #000;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #222;
  border: 1px solid var(--social-border);
  color: #fff;
  cursor: pointer;
}

.close-btn:hover {
  background: #c00;
  border-color: #f00;
}

.title-icon {
  color: var(--social-accent);
  filter: drop-shadow(0 0 12px var(--social-accent-glow));
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: 16px;
  border: 1px solid var(--social-border-glass);
}

.tabs button {
  position: relative;
  border: none;
  background: transparent;
  color: var(--social-muted);
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tabs button:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

/* Unified tab styles moved up */

.tab-icon {
  opacity: 0.8;
}

.tab-icon-badge-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tab-icon-badge {
  position: absolute;
  top: -8px;
  right: -10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #111;
  background: #f5f5f5;
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.14);
}

.tabs button.active .tab-icon {
  opacity: 1;
}

.tab-badge {
  background: #000;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 4px;
  min-width: 18px;
  text-align: center;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--social-border-glass);
  color: var(--social-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
  transform: scale(1.05);
}

.social-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 16px;
}

.social-hero,
.social-activity {
  border: 1px solid var(--social-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.08), transparent 44%),
    linear-gradient(158deg, rgba(24, 24, 24, 0.92), rgba(6, 6, 6, 0.96));
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.social-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.88fr);
  gap: 16px;
  padding: clamp(16px, 2vw, 22px);
  transform: translate(calc(var(--mx) * 4px), calc(var(--my) * 3px));
}

.social-hero__copy {
  display: grid;
  gap: 14px;
  align-content: start;
}

.social-kicker {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(231, 231, 231, 0.72);
}

.social-hero__copy h2 {
  margin: 0;
  font-size: clamp(1.5rem, 2.6vw, 2.2rem);
  letter-spacing: 0.03em;
}

.social-hero__copy p {
  margin: 0;
  max-width: 56ch;
  color: var(--social-muted);
  line-height: 1.6;
}

.social-progress {
  display: grid;
  gap: 8px;
}

.social-progress__track {
  width: 100%;
  height: 12px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  overflow: hidden;
}

.social-progress__bar {
  display: block;
  height: 100%;
  border-radius: 999px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0.9)),
    linear-gradient(90deg, #808080, #f4f4f4);
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.22);
}

.social-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.84rem;
  color: rgba(236, 236, 236, 0.82);
}

.social-achievements {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.social-achievement {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f4;
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.social-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.social-metric-card {
  display: grid;
  gap: 6px;
  align-content: start;
  min-height: 122px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background:
    radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.08), transparent 42%),
    linear-gradient(160deg, rgba(38, 38, 38, 0.86), rgba(10, 10, 10, 0.92));
}

.social-metric-card span {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(226, 226, 226, 0.76);
}

.social-metric-card strong {
  font-size: clamp(1.35rem, 2.2vw, 1.8rem);
  line-height: 1;
}

.social-metric-card p {
  margin: 0;
  color: var(--social-muted);
  line-height: 1.5;
  font-size: 0.84rem;
}

.social-activity {
  display: grid;
  gap: 10px;
  align-content: start;
  padding: clamp(16px, 2vw, 20px);
  transform: translate(calc(var(--mx) * -4px), calc(var(--my) * -3px));
}

.social-activity__header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.social-activity__header h3 {
  margin: 6px 0 0;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
}

.social-activity__badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.social-activity__empty {
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: var(--social-muted);
  line-height: 1.5;
}

.social-activity__item {
  display: grid;
  gap: 6px;
  padding: 12px 13px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
}

.social-activity__topline {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.social-activity__chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.social-activity__item strong {
  font-size: 0.95rem;
}

.social-activity__item p,
.social-activity__item time {
  margin: 0;
  color: var(--social-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.social-activity__item.tone-chat {
  border-color: rgba(255, 255, 255, 0.26);
}

.social-activity__item.tone-online .social-activity__chip,
.social-activity__item.tone-friends .social-activity__chip {
  border-color: rgba(255, 255, 255, 0.28);
}

.close-social-btn {
  border-radius: 999px;
  padding: 10px 18px;
  text-transform: none;
  letter-spacing: 0.08em;
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(30, 30, 30, 0.72);
  box-shadow:
    0 3px 0 rgba(0, 0, 0, 0.76),
    0 10px 16px rgba(0, 0, 0, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -2px 0 rgba(0, 0, 0, 0.45);
}

.close-social-btn:hover {
  border-color: rgba(255, 255, 255, 0.56);
  background: rgba(50, 50, 50, 0.84);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: #0f0f0f;
  background: #f3f3f3;
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.28);
}

@media (max-width: 860px) {
  .social-overview,
  .social-hero {
    grid-template-columns: 1fr;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
  }

  .tabs {
    justify-content: stretch;
  }

  .tabs button {
    flex: 1 1 calc(50% - 8px);
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .social-metric-grid {
    grid-template-columns: 1fr;
  }

  .social-progress__meta,
  .social-activity__header,
  .social-activity__topline {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
