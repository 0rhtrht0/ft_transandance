import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  clearNotificationsRemote: vi.fn(),
  createNotification: vi.fn(),
  deleteNotification: vi.fn(),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}))

vi.mock('../routes/friends/services/notificationsService.js', () => serviceMocks)

import { useNotifications } from '../routes/friends/composables/useNotifications.js'

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the current notification list when a refresh fails', async () => {
    const store = useNotifications()

    await store.addTransientNotification({
      id: 7,
      type: 'friend_request_received',
      title: 'sandy',
      message: 'sandy sent you a friend request.',
      read: false,
      created_at: '2026-04-04T10:00:00Z',
    })

    serviceMocks.fetchNotifications.mockRejectedValueOnce(new Error('Unable to reach the server.'))

    await store.loadNotifications()

    expect(store.notifications.value).toEqual([
      expect.objectContaining({
        id: 7,
        title: 'sandy',
        message: 'sandy sent you a friend request.',
      }),
    ])
    expect(store.error.value).toBe('Unable to reach the server.')
  })

  it('upserts realtime notifications by id instead of duplicating them', async () => {
    const store = useNotifications()

    await store.addTransientNotification({
      id: 11,
      type: 'new_message',
      title: 'neo',
      message: 'hello',
      read: false,
      created_at: '2026-04-04T10:00:00Z',
    })

    await store.addTransientNotification({
      id: 11,
      type: 'new_message',
      title: 'neo',
      message: 'hello again',
      read: true,
      created_at: '2026-04-04T10:01:00Z',
    })

    expect(store.notifications.value).toHaveLength(1)
    expect(store.notifications.value[0]).toEqual(
      expect.objectContaining({
        id: 11,
        message: 'hello again',
        read: true,
      }),
    )
  })
})
