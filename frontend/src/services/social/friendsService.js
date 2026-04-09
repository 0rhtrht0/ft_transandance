import { getApiBase } from '../../utils/runtimeEndpoints.js'

const apiBase = getApiBase()

const authHeaders = () => {
  const token = localStorage.getItem('accessToken') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
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

export async function fetchFriends() {
  const response = await safeFetch(`${apiBase}/api/friends`, {
    headers: authHeaders()
  })
  const data = await parseJsonOrThrow(response, 'Unable to load friends')
  if (Array.isArray(data)) return data
  return Array.isArray(data?.friends) ? data.friends : []
}

export async function deleteFriend(id) {
  const response = await safeFetch(`${apiBase}/api/friends/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  })
  await parseJsonOrThrow(response, 'Unable to remove friend')
}
