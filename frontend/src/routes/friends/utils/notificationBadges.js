const normalizeCount = (value) => Math.max(0, Math.trunc(Number(value) || 0))

export const normalizeNotificationType = (type) => String(type || '').trim().toLowerCase()

export const isSelfNotificationType = (type) => {
  const normalized = normalizeNotificationType(type)
  return normalized.endsWith('_self') || normalized.includes('sent_self')
}

export const isIncomingFriendRequestNotificationType = (type) => {
  const normalized = normalizeNotificationType(type)
  return normalized === 'friend_request' || normalized === 'friend_request_received'
}

export const isPresenceNotificationType = (type) => {
  const normalized = normalizeNotificationType(type)
  return normalized === 'presence.online' || normalized === 'presence.offline' || normalized.startsWith('presence.')
}

export const isMessageNotificationType = (type) => {
  const normalized = normalizeNotificationType(type)
  return normalized === 'new_message' || normalized === 'message' || normalized.startsWith('message_')
}

export const isServerPersistedNotificationType = (type) => {
  const normalized = normalizeNotificationType(type)
  return (
    normalized === 'match_found' ||
    normalized.startsWith('friend_request') ||
    normalized.startsWith('friend_removed') ||
    normalized.startsWith('game_') ||
    isPresenceNotificationType(normalized) ||
    isMessageNotificationType(normalized)
  )
}

export const shouldPersistLocalNotification = (notification) => {
  const normalized = normalizeNotificationType(notification?.type)
  if (!normalized || normalized === 'error') {
    return false
  }
  return !isServerPersistedNotificationType(normalized)
}

export const isUnreadNotification = (notification) => Boolean(notification) && !notification.read

export const isUnreadReceivedMessageNotification = (notification) =>
  isUnreadNotification(notification) &&
  isMessageNotificationType(notification?.type) &&
  !isSelfNotificationType(notification?.type)

export const isUnreadGeneralNotification = (notification) => {
  const normalized = normalizeNotificationType(notification?.type)
  return (
    isUnreadNotification(notification) &&
    !isPresenceNotificationType(normalized) &&
    !isUnreadReceivedMessageNotification(notification) &&
    !isIncomingFriendRequestNotificationType(normalized)
  )
}

export const shouldDisplayNotificationInFeed = (notification) => {
  const normalized = normalizeNotificationType(notification?.type)
  return normalized !== 'chat' && !isPresenceNotificationType(normalized)
}

export const countUnreadMessageNotifications = (notifications = []) =>
  (Array.isArray(notifications) ? notifications : []).filter(isUnreadReceivedMessageNotification).length

export const countUnreadGeneralNotifications = (notifications = []) =>
  (Array.isArray(notifications) ? notifications : []).filter(isUnreadGeneralNotification).length

export const buildSocialBadgeCounts = ({
  notifications = [],
  pendingRequestsCount = 0,
  unreadConversationCount = 0,
} = {}) => {
  const pendingRequests = normalizeCount(pendingRequestsCount)
  const unreadMessages = Math.max(
    normalizeCount(unreadConversationCount),
    countUnreadMessageNotifications(notifications)
  )
  const unreadNotifications = countUnreadGeneralNotifications(notifications)

  return {
    pendingRequests,
    unreadMessages,
    unreadNotifications,
    total: pendingRequests + unreadMessages + unreadNotifications,
  }
}
