import { getApiBase } from '../../auth/auth_api.js'
import { clearSessionAndNotify } from '../../auth/auth_storage.js'

const parseJsonSafe = async (response) => response.json().catch(() => ({}))

const resolveToken = () => localStorage.getItem('accessToken') || ''

export const requestJson = async (path, options = {}) => {
  const {
    method = 'GET',
    body,
    json = true,
    headers = {}
  } = options

  const token = resolveToken()
  const requestHeaders = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  }

  if (json && body !== undefined && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: body === undefined ? undefined : json ? JSON.stringify(body) : body
    })
  } catch (err) {
    const message = String(err?.message || '')
    if (message.includes('NetworkError when attempting to fetch resource.') || message.includes('Failed to fetch')) {
      throw new Error('Unable to reach the server.')
    }
    throw err
  }

  const data = await parseJsonSafe(response)

  if (!response.ok) {
    if (response.status === 401) {
      clearSessionAndNotify()
    }
    const detail = typeof data?.detail === 'string' ? data.detail : `Request failed (${response.status})`
    throw new Error(detail)
  }

  return data
}
