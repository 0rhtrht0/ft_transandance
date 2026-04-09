import { computed, ref } from 'vue'
import {
  clearNotificationsRemote,
  createNotification,
  deleteNotification,
  fetchNotifications,
  markNotificationRead
} from '../services/notificationsService'

export function useNotifications() {
  const notifications = ref([])
  const loading = ref(false)
  const error = ref('')

  const normalizeRecord = (notification) => ({
    id: notification?.id || `temp_${Date.now()}_${Math.random()}`,
    type: notification?.type || 'info',
    title: notification?.title || 'Notification',
    message: notification?.message || '',
    read: Boolean(notification?.read),
    created_at: notification?.created_at || new Date().toISOString()
  })

  const getTimestamp = (notification) => {
    const timestamp = Date.parse(notification?.created_at || '')
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  const sortNotifications = (items) =>
    [...items].sort((left, right) => {
      const timeDiff = getTimestamp(right) - getTimestamp(left)
      if (timeDiff !== 0) return timeDiff
      return String(right?.id || '').localeCompare(String(left?.id || ''))
    })

  const upsertNotification = (notification) => {
    const normalized = normalizeRecord(notification)
    const existingIndex = notifications.value.findIndex((item) => item.id === normalized.id)

    if (existingIndex === -1) {
      notifications.value = sortNotifications([normalized, ...notifications.value])
      return normalized
    }

    const updated = [...notifications.value]
    updated.splice(existingIndex, 1, {
      ...updated[existingIndex],
      ...normalized
    })
    notifications.value = sortNotifications(updated)
    return normalized
  }

  const replaceNotifications = (items) => {
    const next = Array.isArray(items) ? items.map(normalizeRecord) : []
    const deduped = next.filter(
      (notification, index) =>
        next.findIndex((candidate) => candidate.id === notification.id) === index
    )
    notifications.value = sortNotifications(deduped)
  }

  const unreadCount = computed(() =>
    notifications.value.filter((notification) => !notification.read).length
  )

  const loadNotifications = async () => {
    loading.value = true
    error.value = ''
    try {
      const data = await fetchNotifications()
      replaceNotifications(data.notifications)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load notifications.'
    } finally {
      loading.value = false
    }
  }

  const addNotification = async (notification, options = { persist: true }) => {
    const shouldPersist = options?.persist !== false
    const saved = shouldPersist
      ? await createNotification(notification)
      : normalizeRecord(notification)

    return upsertNotification(saved)
  }

  const markAsRead = async (id) => {
    const numericId = Number(id)
    const target = notifications.value.find((notification) => notification.id === id)
    if (!target) return

    if (Number.isFinite(numericId)) {
      const saved = await markNotificationRead(numericId)
      target.read = saved.read
      return
    }
    target.read = true
  }

  const markMatchingAsRead = async (predicate) => {
    if (typeof predicate !== 'function') return 0

    const targets = notifications.value.filter((notification) =>
      !notification.read && predicate(notification)
    )

    await Promise.all(targets.map((notification) => markAsRead(notification.id)))
    return targets.length
  }

  const removeNotification = async (id) => {
    const numericId = Number(id)
    if (Number.isFinite(numericId)) {
      await deleteNotification(numericId)
    }
    notifications.value = notifications.value.filter((notification) => notification.id !== id)
  }

  const clearNotifications = async () => {
    await clearNotificationsRemote()
    notifications.value = []
  }

  const addTransientNotification = async (notification) => {
    return upsertNotification(normalizeRecord(notification))
  }

  const replaceNotificationList = (items) => {
    replaceNotifications(items)
  }

  return {
    notifications,
    loading,
    error,
    unreadCount,
    loadNotifications,
    addNotification,
    addTransientNotification,
    markAsRead,
    markMatchingAsRead,
    removeNotification,
    clearNotifications,
    replaceNotificationList
  }
}
