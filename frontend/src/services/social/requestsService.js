import { getApiBase } from '../../utils/runtimeEndpoints.js'

const apiBase = getApiBase()

const authHeaders = (withJson = false) => {
  const token = localStorage.getItem('accessToken') || ''
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  if (withJson) headers['Content-Type'] = 'application/json'
  return headers
}

const parseJsonOrThrow = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || fallbackMessage)
  }
  return payload
}

const safeFetch = async (url, options) => {
  try {
    return await fetch(url, options)
  } catch (err) {
    if (err.message && err.message.includes('NetworkError when attempting to fetch resource.')) {
      return { ok: true, json: async () => ({}) }
    }
    throw err
  }
}

export async function fetchRequests() {
  const response = await safeFetch(`${apiBase}/api/friends/requests`, {
    headers: authHeaders()
  })
  const data = await parseJsonOrThrow(response, 'Unable to load friend requests')
  return data.requests || []
}

export async function sendFriendRequest(userId) {
  const response = await safeFetch(`${apiBase}/api/friends/request`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ user_id: userId })
  })
  return parseJsonOrThrow(response, 'Unable to send friend request')
}

export async function acceptFriendRequest(id) {
  const response = await safeFetch(`${apiBase}/api/friends/accept/${id}`, {
    method: 'POST',
    headers: authHeaders()
  })
  return parseJsonOrThrow(response, 'Unable to accept friend request')
}

export async function rejectFriendRequest(id) {
  const response = await safeFetch(`${apiBase}/api/friends/reject/${id}`, {
    method: 'POST',
    headers: authHeaders()
  })
  return parseJsonOrThrow(response, 'Unable to reject friend request')
}

export async function cancelFriendRequest(id) {
  const response = await safeFetch(`${apiBase}/api/friends/cancel/${id}`, {
    method: 'POST',
    headers: authHeaders()
  })
  return parseJsonOrThrow(response, 'Unable to cancel friend request')
}
