import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const serviceMocks = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  fetchPendingRequests: vi.fn(),
  rejectFriendRequest: vi.fn(),
  sendFriendRequest: vi.fn(),
}))

vi.mock('../routes/friends/services/requestsService.js', () => serviceMocks)

import { useFriendRequests } from '../routes/friends/composables/useFriendRequests.js'

describe('useFriendRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('keeps an optimistic outgoing request when the refresh fails after creation', async () => {
    serviceMocks.sendFriendRequest.mockResolvedValue({
      id: 42,
      requester_id: 7,
      addressee_id: 9,
      status: 'pending'
    })
    serviceMocks.fetchPendingRequests.mockRejectedValue(new Error('refresh failed'))

    const currentUserId = ref(null)
    const { requests, outgoingRequests, sendRequest } = useFriendRequests(currentUserId)

    const created = await sendRequest(9)

    expect(created.id).toBe(42)
    expect(requests.value).toEqual([
      expect.objectContaining({
        id: 42,
        requester_id: 7,
        addressee_id: 9,
        status: 'pending'
      })
    ])
    expect(outgoingRequests.value).toHaveLength(1)
  })

  it('keeps an optimistic outgoing request when the refresh succeeds without the new request yet', async () => {
    serviceMocks.sendFriendRequest.mockResolvedValue({
      id: 43,
      requester_id: 7,
      addressee_id: 11,
      status: 'pending'
    })
    serviceMocks.fetchPendingRequests.mockResolvedValue([])

    const currentUserId = ref(null)
    const { requests, outgoingRequests, sendRequest } = useFriendRequests(currentUserId)

    const created = await sendRequest(11)

    expect(created.id).toBe(43)
    expect(requests.value).toEqual([
      expect.objectContaining({
        id: 43,
        requester_id: 7,
        addressee_id: 11,
        status: 'pending'
      })
    ])
    expect(outgoingRequests.value).toHaveLength(1)
  })
})
