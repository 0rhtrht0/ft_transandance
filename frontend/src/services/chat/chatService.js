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
    if (err && typeof err.message === 'string' && err.message.includes('NetworkError when attempting to fetch resource.')) {
      return { ok: true, json: async () => ({}) }
    }
    throw err
  }
}

export async function fetchConversations() {
  const response = await safeFetch(`${apiBase}/api/chat/conversations`, {
    headers: authHeaders(),
  })
  const data = await parseJsonOrThrow(response, 'Unable to load conversations')
  if (Array.isArray(data)) return data
  return Array.isArray(data?.conversations) ? data.conversations : []
}

export async function fetchMessages(id) {
  const response = await safeFetch(`${apiBase}/api/chat/messages/${id}`, {
    headers: authHeaders(),
  })
  const data = await parseJsonOrThrow(response, 'Unable to load messages')
  if (Array.isArray(data)) return data
  return Array.isArray(data?.messages) ? data.messages : []
}

export async function postMessage(id, content) {
  const response = await safeFetch(`${apiBase}/api/chat/send/${id}`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ content }),
  })
  await parseJsonOrThrow(response, 'Unable to send message')
}

export async function deleteMessage(id) {
  const response = await safeFetch(`${apiBase}/api/chat/messages/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  await parseJsonOrThrow(response, 'Unable to delete message')
}

export async function markConversationRead(id) {
  const response = await safeFetch(`${apiBase}/api/chat/conversations/${id}/read`, {
    method: 'POST',
    headers: authHeaders(),
  })
  await parseJsonOrThrow(response, 'Unable to mark conversation as read')
}