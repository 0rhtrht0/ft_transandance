import { computed, ref } from 'vue'
import {
  fetchConversations,
  fetchMessages,
  markConversationRead as markConversationReadRemote,
  sendMessageToConversation,
  sendMessageToRecipient
} from '../services/chatService'

export function useChat() {
  const conversations = ref([])
  const selectedConversationId = ref(null)
  const pendingRecipientId = ref(null)
  const messages = ref([])
  const loadingConversations = ref(false)
  const loadingMessages = ref(false)
  const hasMoreMessages = ref(true)
  const sending = ref(false)
  const error = ref('')

  const normalizeId = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const normalizeConversation = (conversation) => ({
    ...conversation,
    id: normalizeId(conversation?.id) ?? conversation?.id,
    unread_count: Math.max(0, Math.trunc(Number(conversation?.unread_count) || 0)),
  })

  const replaceConversations = (items) => {
    conversations.value = Array.isArray(items) ? items.map(normalizeConversation) : []
  }

  const setConversationUnreadCount = (conversationId, unreadCount) => {
    const normalizedConversationId = normalizeId(conversationId)
    if (normalizedConversationId === null) return

    conversations.value = conversations.value.map((conversation) => {
      if (normalizeId(conversation?.id) !== normalizedConversationId) {
        return conversation
      }
      return {
        ...conversation,
        unread_count: Math.max(0, Math.trunc(Number(unreadCount) || 0)),
      }
    })
  }

  const selectedConversation = computed(() =>
    conversations.value.find(
      (conversation) => normalizeId(conversation.id) === normalizeId(selectedConversationId.value)
    ) || null
  )

  const loadConversations = async () => {
    loadingConversations.value = true
    error.value = ''
    try {
      replaceConversations(await fetchConversations())
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load conversations.'
      throw err
    } finally {
      loadingConversations.value = false
    }
  }

  const loadConversationMessages = async (conversationId, limit = 100, silent = false) => {
    if (!silent) loadingMessages.value = true
    error.value = ''
    try {
      const result = await fetchMessages(conversationId, limit)
      
      if (silent && messages.value.length > 0) {
        // Smart merge: only add messages we don't have yet
        const existingIds = new Set(messages.value.map(m => m.id))
        const news = result.filter(m => !existingIds.has(m.id))
        if (news.length > 0) {
          messages.value = [...messages.value, ...news]
        }
      } else {
        messages.value = result
        // Initial load: if we got exactly the limit, there's likely more to load.
        hasMoreMessages.value = result.length >= limit
      }
    } catch (err) {
      if (!silent) {
        error.value = err instanceof Error ? err.message : 'Unable to load messages.'
        throw err
      }
    } finally {
      if (!silent) loadingMessages.value = false
    }
  }

  const loadMoreMessages = async () => {
    if (!selectedConversationId.value || loadingMessages.value || !hasMoreMessages.value) return
    
    const oldestMessage = messages.value[0]
    if (!oldestMessage?.id) return

    loadingMessages.value = true
    try {
      const limit = 50
      const older = await fetchMessages(selectedConversationId.value, limit, oldestMessage.id)
      
      if (older.length > 0) {
        messages.value = [...older, ...messages.value]
      }
      
      if (older.length < limit) {
        hasMoreMessages.value = false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load more messages.'
    } finally {
      loadingMessages.value = false
    }
  }

  const selectConversation = async (conversationId) => {
    const normalized = normalizeId(conversationId)
    if (normalized === null) return
    selectedConversationId.value = normalized
    pendingRecipientId.value = null
    hasMoreMessages.value = true
    await loadConversationMessages(normalized)
  }

  const markConversationRead = async (conversationId, options = {}) => {
    const normalized = normalizeId(conversationId)
    if (normalized === null) return null

    const previousConversation = conversations.value.find(
      (conversation) => normalizeId(conversation?.id) === normalized
    ) || null
    const previousUnreadCount = previousConversation?.unread_count ?? 0

    if (options?.optimistic !== false) {
      setConversationUnreadCount(normalized, 0)
    }

    try {
      const result = await markConversationReadRemote(normalized)
      setConversationUnreadCount(normalized, result?.unread_count ?? 0)
      return result
    } catch (err) {
      setConversationUnreadCount(normalized, previousUnreadCount)
      throw err
    }
  }

  const findDirectConversationWithUser = (userId) =>
    conversations.value.find((conversation) => {
      const normalizedUserId = normalizeId(userId)
      if (normalizedUserId === null) return false
      return (conversation.participants || []).some(
        (participant) => normalizeId(participant.id) === normalizedUserId
      )
    })

  const openConversationWithUser = async (userId) => {
    const normalizedUserId = normalizeId(userId)
    if (normalizedUserId === null) return false

    if (!conversations.value.length) {
      await loadConversations()
    }

    const existing = findDirectConversationWithUser(normalizedUserId)
    if (existing) {
      await selectConversation(existing.id)
      return true
    }

    // No existing conversation yet: keep recipient target and let first message create it.
    selectedConversationId.value = null
    pendingRecipientId.value = normalizedUserId
    messages.value = []
    hasMoreMessages.value = false
    return false
  }

  const sendMessage = async (payload) => {
    let rawContent = ''
    let rawImageUrl = ''

    if (payload !== null && typeof payload === 'object') {
      rawContent = payload.content ?? ''
      rawImageUrl = payload.imageUrl ?? ''
    } else {
      rawContent = payload ?? ''
    }

    const normalizedContent = String(rawContent).trim()
    const normalizedImageUrl = String(rawImageUrl).trim()
    if (!normalizedContent && !normalizedImageUrl) return

    sending.value = true
    error.value = ''

    try {
      if (selectedConversationId.value) {
        await sendMessageToConversation(selectedConversationId.value, {
          content: normalizedContent,
          imageUrl: normalizedImageUrl || null
        })
      } else if (pendingRecipientId.value) {
        await sendMessageToRecipient(pendingRecipientId.value, {
          content: normalizedContent,
          imageUrl: normalizedImageUrl || null
        })
      } else {
        return
      }

      await loadConversations()

      if (!selectedConversationId.value && pendingRecipientId.value) {
        const created = findDirectConversationWithUser(pendingRecipientId.value)
        if (created) {
          selectedConversationId.value = created.id
          pendingRecipientId.value = null
        }
      }

      if (selectedConversationId.value) {
        // When sending, just refresh the list. We don't want to lose history we loaded.
        const currentSelectedId = selectedConversationId.value
        setTimeout(async () => {
          if (selectedConversationId.value === currentSelectedId) {
            const latest = await fetchMessages(currentSelectedId, 20)
            const existingIds = new Set(messages.value.map(m => m.id))
            const news = latest.filter(m => !existingIds.has(m.id))
            if (news.length > 0) {
              messages.value = [...messages.value, ...news]
            }
          }
        }, 300)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to send the message.'
      throw err
    } finally {
      sending.value = false
    }
  }

  return {
    conversations,
    totalUnreadMessages: computed(() =>
      conversations.value.reduce(
        (sum, conversation) => sum + Math.max(0, Math.trunc(Number(conversation?.unread_count) || 0)),
        0
      )
    ),
    selectedConversation,
    selectedConversationId,
    pendingRecipientId,
    messages,
    loadingConversations,
    loadingMessages,
    hasMoreMessages,
    sending,
    error,
    loadConversations,
    selectConversation,
    markConversationRead,
    openConversationWithUser,
    sendMessage,
    loadConversationMessages,
    loadMoreMessages
  }
}
