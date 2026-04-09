import { getApiBase } from '../../utils/runtimeEndpoints.js'

const apiBase = getApiBase()

const authHeaders = () => {
  const token = localStorage.getItem('accessToken') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
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

export async function searchUsers(query) {
  const normalized = query.trim()
  if (normalized.length < 2) return []

  const response = await safeFetch(
    `${apiBase}/api/users/search?q=${encodeURIComponent(normalized)}`,
    {
      headers: authHeaders()
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Unable to search users')
  }

  return data.users || []
}
