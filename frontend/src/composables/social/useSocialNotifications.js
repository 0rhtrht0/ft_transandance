import { computed, ref } from 'vue'

export function useSocialNotifications() {
  const notifications = ref([])

  const unreadCount = computed(() =>
    notifications.value.filter((notification) => !notification.read).length
  )

  const addNotification = (notification) => {
    notifications.value.unshift({
      id: notification.id || `social_notif_${Date.now()}_${Math.random()}`,
      title: notification.title || 'Notification',
      message: notification.message || '',
      read: Boolean(notification.read),
      createdAt: notification.createdAt || new Date().toISOString()
    })
  }

  const markAsRead = (id) => {
    const target = notifications.value.find((notification) => notification.id === id)
    if (target) target.read = true
  }

  const clearNotifications = () => {
    notifications.value = []
  }

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    clearNotifications
  }
}
