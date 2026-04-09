import { inject, ref } from 'vue'
import {
  fetchConversations,
  fetchMessages,
  postMessage
} from '@/services/chat/chatService'
import { useWebSocket } from '../core/useWebSocket'

export function useChat() {
  const conversations = ref([])
  const activeConversation = ref(null)
  const messages = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const { connect, disconnect, subscribe, isConnected } = useWebSocket()
  const wsHost = inject('wsUrl', null)

  const buildWsUrl = () => {
    if (!wsHost) return null
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // wsHost is typically like "example.com" or "example.com/ws"
    const normalizedHost = String(wsHost).replace(/^wss?:\/\//, '')
    return `${protocol}://${normalizedHost.replace(/\/+$/, '')}/chat`
  }

  const loadConversations = async () => {
    isLoading.value = true
    error.value = null
    try {
      conversations.value = await fetchConversations()
    } catch (err) {
      console.error('[Chat] Failed to load conversations:', err)
      error.value = err instanceof Error ? err.message : 'Failed to load conversations'
      conversations.value = []
    } finally {
      isLoading.value = false
    }
  }

  const selectConversation = async (conv) => {
    if (!conv) {
      activeConversation.value = null
      messages.value = []
      return
    }
    isLoading.value = true
    error.value = null
    activeConversation.value = conv
    try {
      messages.value = await fetchMessages(conv.id)
    } catch (err) {
      console.error('[Chat] Failed to load messages:', err)
      error.value = err instanceof Error ? err.message : 'Failed to load messages'
      messages.value = []
    } finally {
      isLoading.value = false
    }
  }

  const sendMessage = async (content) => {
    if (!activeConversation.value) return
    const trimmed = String(content ?? '').trim()
    if (!trimmed) return

    error.value = null
    try {
      await postMessage(activeConversation.value.id, trimmed)
      messages.value.push({
        id: Date.now(),
        conversation_id: activeConversation.value.id,
        sender_id: activeConversation.value.current_user_id ?? null,
        content: trimmed,
        created_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('[Chat] Failed to send message:', err)
      error.value = err instanceof Error ? err.message : 'Failed to send message'
    }
  }

  const receiveMessage = (msg) => {
    if (!msg) return
    // Optionnel : filtrer par conversation active
    if (activeConversation.value && msg.conversation_id === activeConversation.value.id) {
      messages.value.push(msg)
    }
  }

  const markAsRead = () => {
    // TODO: brancher sur une API de read-status si disponible
  }

  const initChatSocket = () => {
    const url = buildWsUrl()
    if (!url) {
      return
    }
    connect(url)
    subscribe((data) => {
      receiveMessage(data)
    })
  }

  const disposeChatSocket = () => {
    disconnect()
  }

  const refreshConversations = (msg) => {
    if (!msg) return
    const conv = conversations.value.find((c) => c.id === msg.conversation_id)
    if (conv) {
      conv.last_message = msg.content
    }
    if (activeConversation.value && activeConversation.value.id === msg.conversation_id) {
      markAsRead()
    }
    receiveMessage(msg)
  }

  return {
    conversations,
    activeConversation,
    messages,
    isLoading,
    error,
    isConnected,
    loadConversations,
    selectConversation,
    sendMessage,
    receiveMessage,
    markAsRead,
    initChatSocket,
    disposeChatSocket,
    refreshConversations,
  }
}