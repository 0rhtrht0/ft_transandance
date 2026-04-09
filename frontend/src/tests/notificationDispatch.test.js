import { describe, expect, it, vi } from 'vitest'

import {
  buildNotificationPayload,
  dispatchSocialNotification,
  resolveNotificationDispatchMode,
} from '../routes/friends/utils/notificationDispatch.js'

describe('notificationDispatch', () => {
  it('builds a normalized payload for valid notifications', () => {
    const payload = buildNotificationPayload({
      type: ' INFO ',
      title: 'Friends',
      message: 'You are already friends.',
      read: 0,
      created_at: '2026-04-04T12:00:00Z'
    })

    expect(payload).toEqual({
      type: 'info',
      title: 'Friends',
      message: 'You are already friends.',
      read: false,
      created_at: '2026-04-04T12:00:00Z'
    })
  })

  it('classifies server-persisted notification types as refresh', () => {
    expect(resolveNotificationDispatchMode({ type: 'friend_request_received' })).toBe('refresh')
  })

  it('classifies error notifications as transient', () => {
    expect(resolveNotificationDispatchMode({ type: 'error' })).toBe('transient')
  })

  it('dispatches transient notifications without trying persistence', async () => {
    const addTransientNotification = vi.fn().mockResolvedValue(undefined)
    const addNotification = vi.fn().mockResolvedValue(undefined)
    const refreshSocialState = vi.fn().mockResolvedValue(undefined)

    const result = await dispatchSocialNotification(
      {
        type: 'error',
        title: 'Friends',
        message: 'Unable to search.'
      },
      {
        addTransientNotification,
        addNotification,
        refreshSocialState
      }
    )

    expect(result).toBe('transient')
    expect(addTransientNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Friends',
        message: 'Unable to search.'
      })
    )
    expect(addNotification).not.toHaveBeenCalled()
    expect(refreshSocialState).not.toHaveBeenCalled()
  })

  it('falls back to transient when persistence fails', async () => {
    const addTransientNotification = vi.fn().mockResolvedValue(undefined)
    const addNotification = vi.fn().mockRejectedValue(new Error('Unable to reach the server.'))

    const result = await dispatchSocialNotification(
      {
        type: 'info',
        title: 'Friends',
        message: 'Refresh failed.'
      },
      {
        addTransientNotification,
        addNotification
      }
    )

    expect(result).toBe('persist_fallback')
    expect(addNotification).toHaveBeenCalledTimes(1)
    expect(addTransientNotification).toHaveBeenCalledTimes(1)
  })

  it('falls back to transient when server refresh fails for persisted-server types', async () => {
    const addTransientNotification = vi.fn().mockResolvedValue(undefined)
    const refreshSocialState = vi.fn().mockResolvedValue(false)

    const result = await dispatchSocialNotification(
      {
        type: 'friend_request_sent_self',
        title: 'neo42',
        message: 'Friend request sent to neo42.'
      },
      {
        addTransientNotification,
        refreshSocialState
      }
    )

    expect(result).toBe('refresh_fallback_transient')
    expect(refreshSocialState).toHaveBeenCalledTimes(1)
    expect(addTransientNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'friend_request_sent_self',
        title: 'neo42'
      })
    )
  })
})
