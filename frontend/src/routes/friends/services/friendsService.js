import { requestJson } from './httpClient'

const normalizeFriend = (friend) => ({
  ...friend,
  id: Number(friend?.id) || friend?.id
})

const normalizeRequest = (request) => ({
  ...request,
  id: Number(request?.id) || request?.id,
  requester_id: Number(request?.requester_id) || request?.requester_id,
  addressee_id: Number(request?.addressee_id) || request?.addressee_id
})

export const fetchFriends = async () => {
  const data = await requestJson('/api/friends')
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.friends)
      ? data.friends
      : []
  return rows.map(normalizeFriend)
}

export const fetchFriendsSummary = async () => {
  const data = await requestJson('/api/friends/summary')
  return {
    friends: Array.isArray(data?.friends) ? data.friends.map(normalizeFriend) : [],
    requests: Array.isArray(data?.requests) ? data.requests.map(normalizeRequest) : [],
    counts: {
      friends: Number(data?.counts?.friends || 0),
      online: Number(data?.counts?.online || 0),
      pending_incoming: Number(data?.counts?.pending_incoming || 0),
      pending_outgoing: Number(data?.counts?.pending_outgoing || 0)
    }
  }
}

export const removeFriendById = async (friendId) => {
  return requestJson(`/api/friends/${encodeURIComponent(friendId)}`, {
    method: 'DELETE'
  })
}
