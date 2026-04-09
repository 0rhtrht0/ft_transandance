import { requestJson } from './httpClient'

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const fetchPendingRequests = async () => {
  const data = await requestJson('/api/friends/requests')
  const rows = Array.isArray(data?.requests) ? data.requests : []
  return rows.map((request) => ({
    ...request,
    id: Number(request?.id) || request?.id,
    requester_id: Number(request?.requester_id) || request?.requester_id,
    addressee_id: Number(request?.addressee_id) || request?.addressee_id
  }))
}

export const sendFriendRequest = async (userId) => {
  const data = await requestJson('/api/friends/request', {
    method: 'POST',
    body: { user_id: Number(userId) || userId }
  })

  const id = normalizeId(data?.id)
  const requesterId = normalizeId(data?.requester_id)
  const addresseeId = normalizeId(data?.addressee_id)

  if (id === null || requesterId === null || addresseeId === null) {
    throw new Error('Friend request could not be confirmed.')
  }

  return {
    ...data,
    id,
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: data?.status || 'pending'
  }
}

export const acceptFriendRequest = async (requestId) => {
  return requestJson(`/api/friends/accept/${encodeURIComponent(requestId)}`, {
    method: 'POST'
  })
}

export const rejectFriendRequest = async (requestId) => {
  return requestJson(`/api/friends/reject/${encodeURIComponent(requestId)}`, {
    method: 'POST'
  })
}

export const cancelFriendRequest = async (requestId) => {
  return requestJson(`/api/friends/cancel/${encodeURIComponent(requestId)}`, {
    method: 'POST'
  })
}
