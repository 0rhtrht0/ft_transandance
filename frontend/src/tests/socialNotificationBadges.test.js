import { describe, expect, it } from 'vitest'

import {
  buildSocialBadgeCounts,
  countUnreadGeneralNotifications,
  countUnreadMessageNotifications,
  shouldPersistLocalNotification,
} from '../routes/friends/utils/notificationBadges.js'

describe('socialNotificationBadges', () => {
  it('counts only received message notifications for the messages badge', () => {
    const notifications = [
      { type: 'new_message', read: false },
      { type: 'message_sent_self', read: false },
      { type: 'chat', read: false },
      { type: 'new_message', read: true },
    ]

    expect(countUnreadMessageNotifications(notifications)).toBe(1)
  })

  it('keeps pending friend requests out of the generic notifications badge', () => {
    const notifications = [
      { type: 'friend_request_received', read: false },
      { type: 'friend_request_accepted', read: false },
      { type: 'presence.online', read: false },
      { type: 'friend_request_accepted_self', read: false },
    ]

    expect(countUnreadGeneralNotifications(notifications)).toBe(2)
  })

  it('counts outgoing self notifications in the generic badge but not in chat', () => {
    const notifications = [
      { type: 'message_sent_self', read: false },
      { type: 'friend_request_sent_self', read: false },
      { type: 'game_victory_self', read: false },
      { type: 'new_message', read: false },
    ]

    expect(countUnreadMessageNotifications(notifications)).toBe(1)
    expect(countUnreadGeneralNotifications(notifications)).toBe(3)
  })

  it('builds the total social badge from requests, messages, and notifications', () => {
    const counts = buildSocialBadgeCounts({
      pendingRequestsCount: 2,
      unreadConversationCount: 1,
      notifications: [
        { type: 'new_message', read: false },
        { type: 'friend_request_accepted', read: false },
        { type: 'friend_request_received', read: false },
      ]
    })

    expect(counts).toEqual({
      pendingRequests: 2,
      unreadMessages: 1,
      unreadNotifications: 1,
      total: 4,
    })
  })

  it('counts persisted local chat updates in the notifications badge, not the chat badge', () => {
    const notifications = [
      { type: 'chat', read: false },
      { type: 'info', read: false },
      { type: 'new_message', read: false },
    ]

    expect(countUnreadMessageNotifications(notifications)).toBe(1)
    expect(countUnreadGeneralNotifications(notifications)).toBe(2)
  })

  it('persists useful local notifications but keeps errors transient', () => {
    expect(shouldPersistLocalNotification({ type: 'chat' })).toBe(true)
    expect(shouldPersistLocalNotification({ type: 'info' })).toBe(true)
    expect(shouldPersistLocalNotification({ type: 'success' })).toBe(true)
    expect(shouldPersistLocalNotification({ type: 'friend_request_sent_self' })).toBe(false)
    expect(shouldPersistLocalNotification({ type: 'error' })).toBe(false)
  })
})
