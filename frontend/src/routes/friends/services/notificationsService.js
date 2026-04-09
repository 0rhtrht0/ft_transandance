import { requestJson } from './httpClient'

const normalizeNotification = (payload) => ({
  id: payload.id,
  type: payload.type || 'info',
  title: payload.title || 'Notification',
  message: payload.message || '',
  read: Boolean(payload.read),
  created_at: payload.created_at || new Date().toISOString()
})

export const fetchNotifications = async () => {
  const data = await requestJson('/api/notifications/')
  return {
    notifications: Array.isArray(data.notifications)
      ? data.notifications.map(normalizeNotification)
      : [],
    unread_count: Number(data.unread_count || 0),
    total_count: Number(data.total_count || 0)
  }
}

export const createNotification = async (notification) => {
  const data = await requestJson('/api/notifications/', {
    method: 'POST',
    body: {
      type: notification.type || 'info',
      title: notification.title || 'Notification',
      message: notification.message || ''
    }
  })
  return normalizeNotification(data)
}

export const markNotificationRead = async (id) => {
  const data = await requestJson(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  })
  return normalizeNotification(data)
}

export const deleteNotification = async (id) => {
  await requestJson(`/api/notifications/${id}`, {
    method: 'DELETE'
  })
}

export const clearNotificationsRemote = async () => {
  await requestJson('/api/notifications/', {
    method: 'DELETE'
  })
}
