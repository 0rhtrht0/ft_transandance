<template>
  <div
    class="notifications-container"
    role="region"
    aria-label="Notifications"
    aria-live="polite"
    aria-atomic="false"
  >
    <transition-group name="notification" tag="div">
      <div
        v-for="notification in visibleNotifications"
        :key="notification.id"
        class="notification-toast"
        :class="`notification-${resolveNotificationKind(notification)}`"
        role="status"
        aria-atomic="true"
      >
        <!-- Avatar / Icon area -->
        <div class="notification-avatar" :class="`avatar-${resolveNotificationKind(notification)}`">
          <AppIcon :name="getIconName(notification)" :size="18" />
        </div>

        <!-- Content -->
        <div class="notification-content">
          <div class="notification-sender">{{ getSenderName(notification) }}</div>
          <div class="notification-action">{{ getActionLabel(notification) }}</div>
          <div v-if="getPreviewText(notification)" class="notification-preview">
            {{ getPreviewText(notification) }}
          </div>
        </div>

        <button
          class="notification-close"
          type="button"
          aria-label="Dismiss notification"
          @click="removeNotification(notification.id)"
        >
          ✕
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'

export default {
  name: 'NotificationsWidget',
  components: { AppIcon },
  props: {
    maxNotifications: { type: Number, default: 5 },
    autoCloseDuration: { type: Number, default: 6000 }
  },
  emits: ['notification-click'],
  setup(props) {
    const notifications = ref([])
    const autoCloseTimers = ref({})

    const resolveNotificationKind = (notification) => {
      const event = notification?.event
      const type = notification?.type

      if (event === 'presence.online' || type === 'presence.online' || type === 'user_online') return 'presence.online'
      if (event === 'presence.offline' || type === 'presence.offline' || type === 'user_offline') return 'presence.offline'
      if (event === 'notification.created' && type) return type
      return type || 'info'
    }

    const visibleNotifications = computed(() =>
      notifications.value.slice(0, props.maxNotifications)
    )

    // Extract the sender name from the notification title
    // e.g. "New message from banga" → "banga"
    // e.g. "banga sent you a friend request." → "banga"
    const getSenderName = (notification) => {
      const title = notification?.title || ''
      const message = notification?.message || ''

      // Pattern: "... from <name>"
      let match = title.match(/from\s+(.+)$/i) || title.match(/de\s+(.+)$/i)
      if (match) return match[1].trim()

      // Pattern: "<name> sent you" from message body
      match = message.match(/^(.+?)\s+sent you/i) || message.match(/^(.+?)\s+vous a env/i)
      if (match) return match[1].trim()

      // Pattern: "<name> accepted" from message body
      match = message.match(/^(.+?)\s+accepted/i) || message.match(/^(.+?)\s+a accept/i)
      if (match) return match[1].trim()

      // Pattern: "Vous avez accepté <name> comme ami"
      match = message.match(/Vous avez accept[eé]\s+(.+?)\s+comme/i)
      if (match) return match[1].trim()

      // Pattern: "Vous avez envoyé une demande d'ami à <name>"
      match = message.match(/Vous avez envoy[eé] une demande d'ami à\s+(.+?)\./i)
      if (match) return match[1].trim()

      // Pattern: "Vous avez envoyé un message"
      match = message.match(/Vous avez envoy[eé] un message à\s+(.+?)\./i)
      if (match) return match[1].trim()

      // Exact match for "Notification" to prevent "Notification Notification"
      if (title.toLowerCase() === 'notification' && message) {
        // Try fallback parsing from message
        const parts = message.split(' ');
        if (parts.length > 2) return parts[0];
      }

      // Fallback: show truncated title
      return title.length > 20 ? title.slice(0, 20) + '…' : (title || 'System')
    }

    // Human-readable action label per notification type
    const getActionLabel = (notification) => {
      const kind = resolveNotificationKind(notification)
      if (kind === 'new_message' || kind === 'message') return 'sent you a message'
      if (kind === 'friend_request' || kind === 'friend_request_received') return 'sent you a friend request'
      if (kind === 'friend_request_sent_self') return 'received your friend request'
      if (kind === 'friend_request_accepted') return 'accepted your friend request'
      if (kind === 'friend_request_accepted_self') return 'was added to your friends'
      if (kind === 'message_sent_self') return 'received your message'
      if (kind === 'presence.online') return 'is online'
      if (kind === 'presence.offline') return 'went offline'
      if (kind === 'match_found') return 'Match found!'
      return notification?.title || 'New notification'
    }

    // Short preview of message content
    const getPreviewText = (notification) => {
      const kind = resolveNotificationKind(notification)
      if (kind === 'new_message') {
        return notification?.message || null
      }
      return null
    }

    const getIconName = (notification) => {
      const kind = resolveNotificationKind(notification)
      if (kind === 'presence.online' || kind === 'presence.offline') return 'users'
      if (kind === 'new_message') return 'message'
      if (kind === 'friend_request' || kind === 'friend_request_received') return 'user-plus'
      if (kind === 'friend_request_accepted') return 'check'
      if (kind === 'match_found') return 'activity'
      return 'bell'
    }

    const addNotification = (notification) => {
      const id = notification.id || `notif_${Date.now()}_${Math.random()}`
      notifications.value.unshift({
        ...notification,
        id,
        type: notification.type || 'info',
        event: notification.event || null,
      })
      if (props.autoCloseDuration > 0) {
        autoCloseTimers.value[id] = setTimeout(() => removeNotification(id), props.autoCloseDuration)
      }
    }

    const removeNotification = (notificationId) => {
      notifications.value = notifications.value.filter(n => n.id !== notificationId)
      if (autoCloseTimers.value[notificationId]) {
        clearTimeout(autoCloseTimers.value[notificationId])
        delete autoCloseTimers.value[notificationId]
      }
    }

    const clearAll = () => {
      notifications.value = []
      Object.values(autoCloseTimers.value).forEach(t => clearTimeout(t))
      autoCloseTimers.value = {}
    }

    return {
      visibleNotifications,
      resolveNotificationKind,
      getSenderName,
      getActionLabel,
      getPreviewText,
      getIconName,
      addNotification,
      removeNotification,
      clearAll
    }
  }
}
</script>

<style scoped>
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 320px;
  pointer-events: none;
}

.notification-toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(14, 14, 14, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 14px 16px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left-width: 4px;
  border-left-style: solid;
  border-left-color: #6366f1;
  animation: slideIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  pointer-events: auto;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
}

/* Type-specific left border colors */
.notification-new_message { border-left-color: #3b82f6; box-shadow: 0 8px 30px rgba(59, 130, 246, 0.25); }
.notification-friend_request,
.notification-friend_request_received { border-left-color: #10b981; box-shadow: 0 8px 30px rgba(16, 185, 129, 0.25); }
.notification-friend_request_accepted { border-left-color: #22c55e; box-shadow: 0 8px 30px rgba(34, 197, 94, 0.25); }
.notification-presence\.online { border-left-color: #22c55e; }
.notification-presence\.offline { border-left-color: #64748b; }
.notification-match_found { border-left-color: #f59e0b; box-shadow: 0 8px 30px rgba(245, 158, 11, 0.3); }
.notification-error { border-left-color: #ef4444; }

/* Avatar icon */
.notification-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
}

.avatar-new_message { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.avatar-friend_request,
.avatar-friend_request_received { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.avatar-friend_request_accepted { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.avatar-presence\.online { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.avatar-presence\.offline { background: rgba(100, 116, 139, 0.15); color: #94a3b8; }
.avatar-match_found { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.avatar-info { background: rgba(99, 102, 241, 0.15); color: #6366f1; }

/* Content layout */
.notification-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification-sender {
  font-weight: 700;
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
}

.notification-action {
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  font-weight: 400;
}

.notification-preview {
  font-size: 12px;
  color: rgba(255,255,255,0.75);
  margin-top: 4px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  padding: 4px 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  font-style: italic;
}

.notification-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  flex-shrink: 0;
  transition: color 0.2s;
  margin-top: 2px;
}

.notification-close:hover { color: #fff; }

@keyframes slideIn {
  from { transform: translateX(420px) scale(0.9); opacity: 0; }
  to   { transform: translateX(0) scale(1); opacity: 1; }
}

.notification-enter-active,
.notification-leave-active { transition: all 0.3s ease; }
.notification-enter-from { transform: translateX(420px); opacity: 0; }
.notification-leave-to   { transform: translateX(420px); opacity: 0; }
</style>
