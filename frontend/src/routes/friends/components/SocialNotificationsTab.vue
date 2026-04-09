<template>
  <section class="social-notifications-tab">
    <header class="notifications-header">
      <div class="notifications-header__copy">
        <h2>Notifications</h2>
        <p>Your recent interactions and alerts.</p>
      </div>
      <button v-if="notifications.length > 0" type="button" class="clear-all-btn" @click="$emit('clear-all')">
        Clear All
      </button>
    </header>

    <div v-if="notifications.length === 0" class="empty">
      <span class="empty-icon">🔔</span>
      <p>No notifications yet.</p>
      <small>All your social activity notifications will appear here.</small>
    </div>

    <article
      v-for="notification in notifications"
      :key="notification.id"
      class="notification-card"
      :class="[
        { unread: !notification.read },
        getTypeClass(notification.type)
      ]"
    >
      <!-- Typed Icon -->
      <div class="notif-avatar" :class="getTypeClass(notification.type)">
        <AppIcon :name="getIcon(notification.type)" :size="18" class="notif-icon" />
      </div>

      <!-- Rich Content -->
      <div class="notification-content">
        <div class="notification-top">
          <div class="notification-who">
            <span class="sender-name">{{ getSenderName(notification) }}</span>
            <span class="action-label">{{ getActionLabel(notification.type) }}</span>
          </div>
          <span class="notification-time">{{ formatRelativeTime(notification.created_at) }}</span>
        </div>
        <p v-if="getPreview(notification)" class="notification-preview">
          {{ getPreview(notification) }}
        </p>

        <!-- Unread dot -->
        <span v-if="!notification.read" class="unread-dot" aria-label="Unread"></span>
      </div>

      <!-- Actions -->
      <div class="notification-actions">
        <button
          v-if="!notification.read"
          type="button"
          class="btn-sm"
          title="Mark as read"
          @click="$emit('mark-read', notification.id)"
        >
          ✓
        </button>
        <button
          type="button"
          class="btn-sm btn-danger"
          title="Delete"
          @click="$emit('remove', notification.id)"
        >
          ✕
        </button>
      </div>
    </article>
  </section>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue'
import { formatRelativeTime } from '../utils/timeFormatter'

const props = defineProps({
  notifications: { type: Array, default: () => [] }
})

defineEmits(['mark-read', 'remove', 'clear-all'])

const trimTrailingPeriod = (value) => String(value || '').trim().replace(/[.]+$/, '')
const normalizeType = (type) => String(type || '').trim().toLowerCase()
const GENERIC_TITLES = new Set(['notification', 'friend request', 'friend removed', 'victory', 'defeat'])
const isGameNotificationType = (type) => normalizeType(type).startsWith('game_')

// Extract actor name from notification payload
const getSenderName = (notification) => {
  const title = notification?.title || ''
  const message = notification?.message || ''
  const normalizedTitle = trimTrailingPeriod(title)
  const normalizedMessage = trimTrailingPeriod(message)
  const type = normalizeType(notification?.type)

  if (isGameNotificationType(type)) {
    return 'Game'
  }

  if (normalizedTitle && !GENERIC_TITLES.has(normalizedTitle.toLowerCase())) {
    return normalizedTitle
  }

  let match = normalizedMessage.match(/^(.+?)\s+(sent you|accepted|is now|went|rejected|cancelled|removed)/i)
  if (match) return trimTrailingPeriod(match[1])

  match = normalizedMessage.match(/^Message from\s+(.+)$/i)
  if (match) return trimTrailingPeriod(match[1])

  if (type.includes('friend')) {
    return 'Friends'
  }

  return 'System'
}

const getActionLabel = (type) => {
  const t = normalizeType(type)
  if (t === 'chat') return 'shared a chat update'
  if (t === 'info') return 'shared an update'
  if (t === 'success') return 'completed an action'
  if (t === 'message_sent_self') return 'received your message'
  if (t.includes('new_message') || t === 'message' || t.includes('chat')) return 'sent you a message'
  if (t === 'friend_request' || t === 'friend_request_received') return 'sent you a friend request'
  if (t === 'friend_request_accepted') return 'accepted your friend request'
  if (t === 'friend_request_accepted_self') return 'is now your friend'
  if (t === 'friend_request_sent_self') return 'received your friend request'
  if (t === 'friend_request_rejected') return 'rejected your friend request'
  if (t === 'friend_request_rejected_self') return 'friend request rejected'
  if (t === 'friend_request_cancelled') return 'cancelled the friend request'
  if (t === 'friend_request_cancelled_self') return 'friend request cancelled'
  if (t === 'friend_removed') return 'removed you from friends'
  if (t === 'friend_removed_self') return 'was removed from your friends'
  if (t === 'game_victory_self') return 'you won a match'
  if (t === 'game_defeat_self') return 'you lost a match'
  if (t === 'presence.online') return 'is now online'
  if (t === 'presence.offline') return 'went offline'
  if (t.includes('presence')) return 'changed status'
  if (t === 'match_found') return 'found a match'
  return 'sent a notification'
}

const getPreview = (notification) => {
  return trimTrailingPeriod(notification?.message || '') || null
}

const getIcon = (type) => {
  const t = normalizeType(type)
  if (t === 'success') return 'check'
  if (t === 'message_sent_self') return 'send'
  if (t.includes('message') || t.includes('chat')) return 'message'
  if (t === 'friend_request' || t === 'friend_request_received') return 'user-plus'
  if (t === 'friend_request_sent_self') return 'send'
  if (t.includes('friend_request_accepted')) return 'user-check'
  if (t.includes('friend_request_rejected')) return 'user-x'
  if (t.includes('friend_request_cancelled')) return 'x'
  if (t.includes('friend_removed')) return 'user-minus'
  if (t === 'game_victory_self') return 'award'
  if (t === 'game_defeat_self') return 'warning'
  if (t.includes('presence')) return 'users'
  if (t === 'match_found') return 'zap'
  return 'bell'
}

const getTypeClass = (type) => {
  const t = normalizeType(type)
  if (t.includes('message') || t.includes('chat')) return 'type-message'
  if (t.includes('friend_request_rejected')) return 'type-rejected'
  if (t.includes('friend_request_cancelled')) return 'type-cancelled'
  if (t.includes('friend_removed')) return 'type-removed'
  if (t.includes('friend_request_accepted')) return 'type-accepted'
  if (t.includes('game_victory')) return 'type-game-win'
  if (t.includes('game_defeat')) return 'type-game-loss'
  if (t.includes('friend')) return 'type-friend'
  if (t.includes('presence')) return 'type-presence'
  if (t === 'match_found') return 'type-match'
  return 'type-info'
}
</script>

<style scoped>
.social-notifications-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 24px;
}

/* ── Header ─────────────────────────────────────── */
.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  background: rgba(18, 18, 18, 0.6);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  backdrop-filter: blur(8px);
}

.notifications-header h2 { margin: 0; font-size: 17px; letter-spacing: 0.5px; }
.notifications-header__copy p { margin: 4px 0 0; color: #888; font-size: 13px; }

.clear-all-btn {
  background: transparent;
  border: 1px solid rgba(239,68,68,0.4);
  color: #ef4444;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.clear-all-btn:hover {
  background: rgba(239,68,68,0.1);
  border-color: #ef4444;
}

/* ── Empty State ────────────────────────────────── */
.empty {
  padding: 48px 20px;
  text-align: center;
  color: #555;
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.empty-icon { font-size: 2rem; filter: grayscale(1); opacity: 0.4; }
.empty p { margin: 0; font-size: 15px; color: #666; }
.empty small { font-size: 12px; color: #444; }

/* ── Notification Card ──────────────────────────── */
.notification-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(18, 18, 18, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-left: 4px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.notification-card:not(.unread) {
  opacity: 0.55;
  filter: grayscale(0.25);
}

.notification-card.unread {
  background: rgba(35, 35, 35, 0.7);
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}

.notification-card:hover {
  transform: translateX(3px);
  opacity: 1 !important;
  filter: none !important;
  border-color: rgba(255,255,255,0.25);
}

/* Type-specific left borders */
.type-message.unread    { border-left-color: #3b82f6; }
.type-friend.unread     { border-left-color: #10b981; }
.type-accepted.unread   { border-left-color: #22c55e; }
.type-presence.unread   { border-left-color: #6366f1; }
.type-match.unread      { border-left-color: #f59e0b; }
.type-rejected.unread   { border-left-color: #ef4444; }
.type-cancelled.unread  { border-left-color: #f97316; }
.type-removed.unread    { border-left-color: #f43f5e; }
.type-game-win.unread   { border-left-color: #eab308; }
.type-game-loss.unread  { border-left-color: #fb7185; }
.type-info.unread       { border-left-color: #8b5cf6; }

/* ── Icon Avatar ────────────────────────────────── */
.notif-avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
}

.type-message .notif-icon   { color: #3b82f6; }
.type-friend .notif-icon    { color: #10b981; }
.type-accepted .notif-icon  { color: #22c55e; }
.type-presence .notif-icon  { color: #6366f1; }
.type-match .notif-icon     { color: #f59e0b; }
.type-info .notif-icon      { color: #8b5cf6; }

/* ── Content ────────────────────────────────────── */
.notification-content {
  flex: 1;
  min-width: 0;
  position: relative;
}

.notification-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.notification-who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sender-name {
  font-size: 14px;
  font-weight: 700;
  color: #f0f0f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.action-label {
  font-size: 12px;
  color: rgba(255,255,255,0.45);
  margin-top: 1px;
  line-height: 1.3;
}

.notification-time {
  font-size: 11px;
  color: #444;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification-preview {
  margin: 6px 0 0;
  font-size: 12px;
  color: rgba(255,255,255,0.65);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(255,255,255,0.04);
  padding: 4px 8px;
  border-radius: 6px;
}

.unread-dot {
  position: absolute;
  top: 0;
  right: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 6px rgba(59,130,246,0.8);
}

/* ── Actions ────────────────────────────────────── */
.notification-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.btn-sm {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: #ccc;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
}

.btn-sm:hover { background: rgba(255,255,255,0.12); color: #fff; }
.btn-danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
.btn-danger:hover { background: rgba(239,68,68,0.1); }
</style>
