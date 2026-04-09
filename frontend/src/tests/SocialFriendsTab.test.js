import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestServiceMocks = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  fetchPendingRequests: vi.fn(),
  rejectFriendRequest: vi.fn(),
  sendFriendRequest: vi.fn()
}))

const friendsServiceMocks = vi.hoisted(() => ({
  fetchFriendsSummary: vi.fn(),
  fetchFriends: vi.fn(),
  removeFriendById: vi.fn()
}))

const searchServiceMocks = vi.hoisted(() => ({
  searchUsers: vi.fn()
}))

vi.mock('../routes/friends/services/requestsService.js', () => requestServiceMocks)
vi.mock('../routes/friends/services/friendsService.js', () => friendsServiceMocks)
vi.mock('../routes/friends/services/searchService.js', () => searchServiceMocks)

import SocialFriendsTab from '../routes/friends/components/SocialFriendsTab.vue'

const flushUi = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

const getLastNotify = (wrapper) => {
  const rows = wrapper.emitted('notify') || []
  if (rows.length === 0) return null
  return rows[rows.length - 1][0]
}

const createDeferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('SocialFriendsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    friendsServiceMocks.fetchFriendsSummary.mockResolvedValue({
      friends: [],
      requests: [],
      counts: {
        friends: 0,
        online: 0,
        pending_incoming: 0,
        pending_outgoing: 0
      }
    })
    friendsServiceMocks.fetchFriends.mockResolvedValue([])
    requestServiceMocks.fetchPendingRequests.mockResolvedValue([])
    searchServiceMocks.searchUsers.mockResolvedValue([
      {
        id: 9,
        username: 'Nova',
        points: 120
      }
    ])
  })

  it('replaces Add Friend with Message and Cancel after sending a request', async () => {
    requestServiceMocks.sendFriendRequest.mockResolvedValue({
      id: 42,
      requester_id: 7,
      addressee_id: 9,
      status: 'pending'
    })

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: null,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.search-input').setValue('Nova')
    await flushUi()

    expect(wrapper.text()).toContain('Add Friend')

    await wrapper.get('.btn-accent').trigger('click')
    await flushUi()

    const actions = wrapper.get('.search-result .result-actions').text()
    expect(actions).toContain('Profile')
    expect(actions).toContain('Message')
    expect(actions).toContain('Cancel')
    expect(actions).not.toContain('Add Friend')

    expect(getLastNotify(wrapper)).toEqual(
      expect.objectContaining({
        type: 'friend_request_sent_self',
        title: 'Nova',
        message: 'Friend request sent to Nova.'
      })
    )
  })

  it('resyncs to Message and Cancel when the request already exists on the backend', async () => {
    requestServiceMocks.sendFriendRequest.mockRejectedValue(new Error('Friend request already exists'))
    requestServiceMocks.fetchPendingRequests
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 42,
          requester_id: 7,
          addressee_id: 9,
          status: 'pending',
          addressee: {
            id: 9,
            username: 'Nova'
          }
        }
      ])

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.search-input').setValue('Nova')
    await flushUi()

    await wrapper.get('.btn-accent').trigger('click')
    await flushUi()

    const actions = wrapper.get('.search-result .result-actions').text()
    expect(actions).toContain('Profile')
    expect(actions).toContain('Message')
    expect(actions).toContain('Cancel')
    expect(actions).not.toContain('Add Friend')
  })

  it('shows Message instead of Add Friend when the searched user is already a friend', async () => {
    friendsServiceMocks.fetchFriends.mockResolvedValue([])
    searchServiceMocks.searchUsers.mockResolvedValue([
      {
        id: 9,
        username: 'Nova',
        is_friend: true,
        points: 120
      }
    ])

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.search-input').setValue('Nova')
    await flushUi()

    const actions = wrapper.get('.search-result .result-actions').text()
    expect(actions).toContain('Profile')
    expect(actions).toContain('Message')
    expect(actions).not.toContain('Add Friend')
    expect(actions).not.toContain('Friend')
  })

  it('keeps the friends list visible while searching for another player', async () => {
    friendsServiceMocks.fetchFriendsSummary.mockResolvedValue({
      friends: [
        {
          id: 5,
          username: 'Sandy',
          is_online: true
        }
      ],
      requests: [],
      counts: {
        friends: 1,
        online: 1,
        pending_incoming: 0,
        pending_outgoing: 0
      }
    })
    searchServiceMocks.searchUsers.mockResolvedValue([
      {
        id: 9,
        username: 'Nova',
        points: 120
      }
    ])

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    expect(wrapper.text()).toContain('Sandy')

    await wrapper.get('.search-input').setValue('Nova')
    await flushUi()

    expect(wrapper.text()).toContain('Sandy')
    expect(wrapper.text()).toContain('Nova')
    expect(wrapper.find('.search-modal').exists()).toBe(false)
    expect(wrapper.find('.panel-search-results').exists()).toBe(true)
  })

  it('shows evaluation points from search results', async () => {
    searchServiceMocks.searchUsers.mockResolvedValue([
      {
        id: 9,
        username: 'Nova',
        evaluation_points: 120
      }
    ])

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.search-input').setValue('Nova')
    await flushUi()

    expect(wrapper.text()).toContain('120 pts')
  })

  it('removes a friend from the list immediately after clicking Remove', async () => {
    const deferred = createDeferred()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    friendsServiceMocks.fetchFriendsSummary.mockResolvedValue({
      friends: [
        {
          id: 5,
          username: 'Sandy',
          is_online: true
        }
      ],
      requests: [],
      counts: {
        friends: 1,
        online: 1,
        pending_incoming: 0,
        pending_outgoing: 0
      }
    })
    friendsServiceMocks.removeFriendById.mockReturnValue(deferred.promise)

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    expect(wrapper.text()).toContain('Friends (1)')
    expect(wrapper.text()).toContain('Sandy')

    await wrapper.get('.friend-card .btn-danger').trigger('click')
    await flushUi()

    expect(wrapper.text()).toContain('Friends (0)')
    expect(wrapper.text()).toContain('No friends found.')
    expect(wrapper.text()).not.toContain('Sandy')

    deferred.resolve({ detail: 'Friend removed' })
    await flushUi()
  })

  it('moves an accepted request into the friends list immediately after clicking Accept', async () => {
    const deferred = createDeferred()
    friendsServiceMocks.fetchFriendsSummary.mockResolvedValue({
      friends: [],
      requests: [
        {
          id: 42,
          requester_id: 9,
          addressee_id: 7,
          status: 'pending',
          requester: {
            id: 9,
            username: 'Nova',
            is_online: true
          },
          addressee: {
            id: 7,
            username: 'Player'
          }
        }
      ],
      counts: {
        friends: 0,
        online: 0,
        pending_incoming: 1,
        pending_outgoing: 0
      }
    })
    requestServiceMocks.acceptFriendRequest.mockReturnValue(deferred.promise)

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    expect(wrapper.text()).toContain('Requests (1)')
    expect(wrapper.text()).toContain('Friends (0)')

    await wrapper.get('.request-card .btn-success').trigger('click')
    await flushUi()

    expect(wrapper.text()).toContain('Requests (0)')
    expect(wrapper.text()).toContain('No requests.')
    expect(wrapper.text()).toContain('Friends (1)')
    expect(wrapper.text()).toContain('Nova')

    deferred.resolve({
      id: 42,
      requester_id: 9,
      addressee_id: 7,
      status: 'accepted'
    })
    await flushUi()

    expect(getLastNotify(wrapper)).toEqual(
      expect.objectContaining({
        type: 'friend_request_accepted_self',
        title: 'Nova',
        message: 'Nova is now your friend.'
      })
    )
  })

  it('notifies when a request is rejected', async () => {
    friendsServiceMocks.fetchFriendsSummary
      .mockResolvedValueOnce({
        friends: [],
        requests: [
          {
            id: 42,
            requester_id: 9,
            addressee_id: 7,
            status: 'pending',
            requester: {
              id: 9,
              username: 'Nova',
              is_online: true
            },
            addressee: {
              id: 7,
              username: 'Player'
            }
          }
        ],
        counts: {
          friends: 0,
          online: 0,
          pending_incoming: 1,
          pending_outgoing: 0
        }
      })
      .mockResolvedValueOnce({
        friends: [],
        requests: [],
        counts: {
          friends: 0,
          online: 0,
          pending_incoming: 0,
          pending_outgoing: 0
        }
      })
    requestServiceMocks.rejectFriendRequest.mockResolvedValue({
      detail: 'Friend request rejected'
    })

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.request-card .btn-danger').trigger('click')
    await flushUi()

    expect(getLastNotify(wrapper)).toEqual(
      expect.objectContaining({
        type: 'friend_request_rejected_self',
        title: 'Nova',
        message: "You rejected Nova's friend request."
      })
    )
  })

  it('notifies when an outgoing request is cancelled', async () => {
    friendsServiceMocks.fetchFriendsSummary
      .mockResolvedValueOnce({
        friends: [],
        requests: [
          {
            id: 51,
            requester_id: 7,
            addressee_id: 9,
            status: 'pending',
            requester: {
              id: 7,
              username: 'Player'
            },
            addressee: {
              id: 9,
              username: 'Nova'
            }
          }
        ],
        counts: {
          friends: 0,
          online: 0,
          pending_incoming: 0,
          pending_outgoing: 1
        }
      })
      .mockResolvedValueOnce({
        friends: [],
        requests: [],
        counts: {
          friends: 0,
          online: 0,
          pending_incoming: 0,
          pending_outgoing: 0
        }
      })
    requestServiceMocks.cancelFriendRequest.mockResolvedValue({
      detail: 'Friend request cancelled'
    })

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.request-card .btn-danger').trigger('click')
    await flushUi()

    expect(getLastNotify(wrapper)).toEqual(
      expect.objectContaining({
        type: 'friend_request_cancelled_self',
        title: 'Nova',
        message: 'Friend request to Nova cancelled.'
      })
    )
  })

  it('notifies when a friend is removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    friendsServiceMocks.fetchFriendsSummary
      .mockResolvedValueOnce({
        friends: [
          {
            id: 5,
            username: 'Sandy',
            is_online: true
          }
        ],
        requests: [],
        counts: {
          friends: 1,
          online: 1,
          pending_incoming: 0,
          pending_outgoing: 0
        }
      })
      .mockResolvedValueOnce({
        friends: [],
        requests: [],
        counts: {
          friends: 0,
          online: 0,
          pending_incoming: 0,
          pending_outgoing: 0
        }
      })
    friendsServiceMocks.removeFriendById.mockResolvedValue({
      detail: 'Friend removed'
    })

    const wrapper = mount(SocialFriendsTab, {
      props: {
        currentUserId: 7,
        realtimeEvent: null
      }
    })

    await flushUi()
    await wrapper.get('.friend-card .btn-danger').trigger('click')
    await flushUi()

    expect(getLastNotify(wrapper)).toEqual(
      expect.objectContaining({
        type: 'friend_removed_self',
        title: 'Sandy',
        message: 'You removed Sandy from your friends.'
      })
    )
  })
})
