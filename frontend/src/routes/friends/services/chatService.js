import { requestJson } from './httpClient'

export const fetchConversations = async () => {
  const data = await requestJson('/api/messages/conversations')
  return Array.isArray(data?.conversations) ? data.conversations : []
}

export const fetchUnreadMessagesCount = async () => {
  const data = await requestJson('/api/messages/unread-count')
  return Number(data?.unread_count || 0)
}

export const fetchMessages = async (conversationId, limit = 100, beforeId = null) => {
  let url = `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`
  if (beforeId) {
    url += `&before_id=${beforeId}`
  }
  const data = await requestJson(url)
  return Array.isArray(data?.messages) ? data.messages : []
}

export const sendMessageToConversation = async (conversationId, payload) => {
  return requestJson('/api/messages', {
    method: 'POST',
    body: {
      conversation_id: Number(conversationId) || conversationId,
      content: payload?.content ?? '',
      image_url: payload?.imageUrl ?? null,
    }
  })
}

export const sendMessageToRecipient = async (recipientId, payload) => {
  return requestJson('/api/messages', {
    method: 'POST',
    body: {
      recipient_id: Number(recipientId) || recipientId,
      content: payload?.content ?? '',
      image_url: payload?.imageUrl ?? null,
    }
  })
}

export const uploadMessageImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const data = await requestJson('/api/messages/uploads', {
    method: 'POST',
    body: formData,
    json: false
  })
  return data?.image_url || ''
}

export const markConversationRead = async (conversationId) => {
  return requestJson(`/api/messages/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'PATCH'
  })
}
