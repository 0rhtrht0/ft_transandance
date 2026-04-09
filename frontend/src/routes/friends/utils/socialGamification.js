const normalizeCount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const SOCIAL_RANKS = [
  {
    minLevel: 1,
    title: 'Social recruit',
    subtitle: 'Your network is starting to take shape.'
  },
  {
    minLevel: 3,
    title: 'Explorer',
    subtitle: 'You keep friends active and conversations open.'
  },
  {
    minLevel: 5,
    title: 'Messenger',
    subtitle: 'Your social space is becoming active and consistent.'
  },
  {
    minLevel: 8,
    title: 'Network captain',
    subtitle: 'Your network is active, stable, and well organized.'
  },
  {
    minLevel: 12,
    title: 'Social legend',
    subtitle: 'You bring the whole social hub to life.'
  }
]

const resolveNotificationKind = (notification) => {
  const kind = String(notification?.type || notification?.event || '').toLowerCase()

  if (kind.includes('message') || kind.includes('chat')) return 'chat'
  if (kind.includes('friend')) return 'friends'
  if (kind.includes('presence.online') || kind.includes('online')) return 'online'
  if (kind.includes('presence.offline') || kind.includes('offline')) return 'offline'
  if (kind.includes('error')) return 'warning'
  return 'general'
}

export function buildSocialMetrics(metrics = {}) {
  return {
    friendsCount: normalizeCount(metrics.friendsCount),
    onlineCount: normalizeCount(metrics.onlineCount),
    incomingRequestsCount: normalizeCount(metrics.incomingRequestsCount),
    outgoingRequestsCount: normalizeCount(metrics.outgoingRequestsCount),
    conversationsCount: normalizeCount(metrics.conversationsCount),
    unreadMessagesCount: normalizeCount(metrics.unreadMessagesCount),
    unreadNotificationsCount: normalizeCount(metrics.unreadNotificationsCount),
    notificationsCount: normalizeCount(metrics.notificationsCount)
  }
}

export function buildSocialRank(rawMetrics = {}) {
  const metrics = buildSocialMetrics(rawMetrics)
  const score =
    metrics.friendsCount * 18 +
    metrics.onlineCount * 24 +
    metrics.conversationsCount * 14 +
    metrics.incomingRequestsCount * 7 +
    metrics.outgoingRequestsCount * 5 +
    metrics.notificationsCount * 3 +
    metrics.unreadMessagesCount * 4
  const xpCap = 90
  const level = Math.max(1, Math.floor(score / xpCap) + 1)
  const currentXp = score % xpCap
  const progress = Math.max(8, Math.min(100, Math.round((currentXp / xpCap) * 100) || 8))
  const rank =
    [...SOCIAL_RANKS].reverse().find((candidate) => level >= candidate.minLevel) || SOCIAL_RANKS[0]

  return {
    level,
    score,
    xpCap,
    currentXp,
    progress,
    title: rank.title,
    subtitle: rank.subtitle
  }
}

export function buildOverviewCards(rawMetrics = {}) {
  const metrics = buildSocialMetrics(rawMetrics)
  const unreadSignals = metrics.unreadMessagesCount + metrics.unreadNotificationsCount

  return [
    {
      key: 'crew',
      label: 'Friends',
      value: metrics.friendsCount,
      hint: metrics.friendsCount === 1 ? '1 friend added' : `${metrics.friendsCount} friends added`
    },
    {
      key: 'live_orbit',
      label: 'Online',
      value: `${metrics.onlineCount}/${Math.max(metrics.friendsCount, 1)}`,
      hint: metrics.onlineCount > 0 ? 'Friends online right now' : 'No friends online'
    },
    {
      key: 'threads',
      label: 'Conversations',
      value: metrics.conversationsCount,
      hint: metrics.conversationsCount > 0 ? 'Available conversations' : 'No conversations yet'
    },
    {
      key: 'signals',
      label: 'Alerts',
      value: unreadSignals,
      hint: unreadSignals > 0 ? 'Items to review' : 'No pending alerts'
    }
  ]
}

export function buildAchievementBadges(rawMetrics = {}) {
  const metrics = buildSocialMetrics(rawMetrics)
  const badges = []

  if (metrics.friendsCount >= 1) badges.push('First contact')
  if (metrics.friendsCount >= 4) badges.push('Solid network')
  if (metrics.onlineCount >= 2) badges.push('Friends online')
  if (metrics.conversationsCount >= 3) badges.push('Active chat')
  if (
    metrics.friendsCount > 0 &&
    metrics.unreadMessagesCount + metrics.unreadNotificationsCount === 0
  ) {
    badges.push('Inbox clear')
  }
  if (metrics.incomingRequestsCount >= 2) badges.push('Popular profile')

  if (!badges.length) {
    return ['Getting started']
  }

  return badges.slice(0, 3)
}

export function buildActivityFeed(notifications = []) {
  return (Array.isArray(notifications) ? notifications : []).slice(0, 3).map((notification, index) => {
    const kind = resolveNotificationKind(notification)
    const chips = {
      chat: 'Message',
      friends: 'Friend',
      online: 'Online',
      offline: 'Offline',
      warning: 'Alert',
      general: 'Info'
    }

    return {
      id: notification?.id ?? `activity_${index}`,
      title: notification?.title || 'Notification',
      message: notification?.message || 'New activity in your social hub.',
      chip: chips[kind] || chips.general,
      tone: kind,
      createdAt: notification?.created_at || new Date().toISOString(),
      read: Boolean(notification?.read)
    }
  })
}
