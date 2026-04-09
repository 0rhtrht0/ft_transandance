import {
  isServerPersistedNotificationType,
  normalizeNotificationType,
  shouldPersistLocalNotification,
} from './notificationBadges'

export const buildNotificationPayload = (notification) => {
  const type = normalizeNotificationType(notification?.type)
  if (!type) {
    return null
  }

  return {
    type,
    title: notification?.title || 'Notification',
    message: notification?.message || '',
    read: Boolean(notification?.read),
    created_at: notification?.created_at || new Date().toISOString()
  }
}

export const resolveNotificationDispatchMode = (notification) => {
  const type = normalizeNotificationType(notification?.type)
  if (!type) {
    return 'skip'
  }
  if (isServerPersistedNotificationType(type)) {
    return 'refresh'
  }
  if (!shouldPersistLocalNotification({ ...notification, type })) {
    return 'transient'
  }
  return 'persist'
}

export const dispatchSocialNotification = async (notification, handlers = {}) => {
  const payload = buildNotificationPayload(notification)
  if (!payload) {
    return 'skip'
  }

  const mode = resolveNotificationDispatchMode(payload)

  if (mode === 'refresh') {
    let refreshed = true
    if (typeof handlers.refreshSocialState === 'function') {
      try {
        const result = await handlers.refreshSocialState()
        refreshed = result !== false
      } catch {
        refreshed = false
      }
    }

    if (!refreshed && typeof handlers.addTransientNotification === 'function') {
      await handlers.addTransientNotification(payload)
      return 'refresh_fallback_transient'
    }
    return 'refresh'
  }

  if (mode === 'transient') {
    if (typeof handlers.addTransientNotification === 'function') {
      await handlers.addTransientNotification(payload)
    }
    return 'transient'
  }

  if (typeof handlers.addNotification !== 'function') {
    if (typeof handlers.addTransientNotification === 'function') {
      await handlers.addTransientNotification(payload)
    }
    return 'transient'
  }

  try {
    await handlers.addNotification(payload)
    return 'persist'
  } catch {
    if (typeof handlers.addTransientNotification === 'function') {
      await handlers.addTransientNotification(payload)
    }
    return 'persist_fallback'
  }
}
