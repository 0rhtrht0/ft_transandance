const normalizeString = (value) => String(value || '').toLowerCase()

export function normalizeSocialRealtimeKind(payload = {}) {
  const event = normalizeString(payload.event)
  const type = normalizeString(payload.type)
  const notificationType = normalizeString(payload.notification?.type)

  if (event === 'ws.connected' || event === 'ws.reconnected') return 'ws_sync'
  if (event === 'conversation.message_created' || type === 'message') return 'message'
  if (event === 'notification.created' || type === 'notification') return 'notification'
  if (event === 'presence.online' || type === 'presence.online' || type === 'user_online') {
    return 'presence_online'
  }
  if (event === 'presence.offline' || type === 'presence.offline' || type === 'user_offline') {
    return 'presence_offline'
  }
  if (notificationType.includes('friend')) return 'notification_friend'
  if (notificationType.includes('message')) return 'notification_message'
  return 'unknown'
}

export function shouldRefreshFriendsPanel(payload = {}) {
  const kind = normalizeSocialRealtimeKind(payload)
  const notificationType = normalizeString(payload.notification?.type)

  if (kind === 'ws_sync') return true
  if (kind === 'presence_online' || kind === 'presence_offline') return true
  if (kind === 'notification_friend') return true

  return notificationType.includes('friend_request') || notificationType.includes('friend')
}
