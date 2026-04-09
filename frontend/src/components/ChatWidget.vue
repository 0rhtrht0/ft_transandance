<template>
  <div class="chat-container">
    <!-- Chat Header -->
    <div class="chat-header">
      <h3>Chat</h3>
      <div class="header-controls">
        <button @click="toggleMinimize" class="minimize-btn">
          {{ isMinimized ? '▲' : '▼' }}
        </button>
      </div>
    </div>

    <!-- Minimized View -->
    <div v-if="isMinimized" class="chat-minimized">
      <span class="unread-badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
      Click to expand
    </div>

    <!-- Full Chat -->
    <div v-else class="chat-content">
      <!-- Conversation List / Active Chat -->
      <div class="chat-main">
        <!-- Conversations List (sidebar) -->
        <div class="conversations-list">
          <div class="list-header">Messages</div>
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="conversation-item"
            :class="{ active: selectedConversation?.id === conv.id }"
            @click="selectConversation(conv)"
          >
            <div class="conv-name">{{ getConversationName(conv) }}</div>
            <div class="conv-meta">
              <span v-if="conv.unread_count > 0" class="unread">{{ conv.unread_count }}</span>
              <span class="time">{{ formatTime(conv.updated_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Messages Display -->
        <div class="messages-panel" v-if="selectedConversation">
          <div class="messages-header">
            <h4>{{ getConversationName(selectedConversation) }}</h4>
            <div class="participants-online">
              <span
                v-for="user in onlineParticipants"
                :key="user.id"
                class="online-indicator"
                :title="user.username"
              >
                ● {{ user.username }}
              </span>
            </div>
          </div>

          <!-- Messages List -->
          <div class="messages-list" ref="messagesList">
            <div
              v-for="msg in selectedMessages"
              :key="msg.id"
              class="message"
              :class="{ own: msg.sender_id === currentUserIdValue }"
            >
              <div class="message-sender" v-if="msg.sender_id !== currentUserIdValue">
                {{ msg.sender_name }}
              </div>
              <div class="message-bubble">{{ msg.content }}</div>
              <div class="message-time">{{ formatTime(msg.created_at) }}</div>
            </div>
          </div>

          <!-- Message Input -->
          <div class="message-input-area">
            <input
              v-model="newMessage"
              @keyup.enter="sendMessage"
              placeholder="Type a message..."
              class="message-input"
            />
            <button @click="sendMessage" class="send-btn">Send</button>
          </div>
        </div>

        <!-- No Conversation Selected -->
        <div v-else class="no-selection">
          Select a conversation to start chatting
        </div>
      </div>
    </div>

    <!-- Notifications Badge (top right) -->
    <div v-if="showNotificationsBadge" class="notifications-badge">
      <span v-if="notificationCount > 0" class="badge-count">{{ notificationCount }}</span>
      🔔
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

export default {
  name: 'ChatComponent',
  props: {
    currentUserId: {
      type: [String, Number],
      required: true
    },
    jwtToken: {
      type: String,
      required: true
    },
    apiUrl: {
      type: String,
      required: true
    },
    wsUrl: {
      type: String,
      required: true
    }
  },
  emits: ['notification', 'user-online', 'user-offline'],
  setup(props, { emit, expose }) {
    // State
    const conversations = ref([])
    const selectedConversation = ref(null)
    const newMessage = ref('')
    const isMinimized = ref(false)
    const unreadCount = ref(0)
    const notificationCount = ref(0)
    const showNotificationsBadge = ref(true)
    const messagesList = ref(null)
    const onlineUsers = ref(new Set())
    const ws = ref(null)
    const connectionRetries = ref(0)

    // Computed
    const selectedMessages = computed(() => {
      if (!selectedConversation.value) return []
      return selectedConversation.value.messages || []
    })

    const currentUserIdValue = computed(() => {
      const value = Number(props.currentUserId)
      return Number.isFinite(value) ? value : null
    })

    const onlineParticipants = computed(() => {
      if (!selectedConversation.value) return []
      return (selectedConversation.value.participants || []).filter(p =>
        onlineUsers.value.has(p.id)
      )
    })

    // Methods
    const connectWebSocket = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsEndpoint = `${wsProtocol}//${props.wsUrl}/ws?token=${props.jwtToken}`

        ws.value = new WebSocket(wsEndpoint)

        ws.value.onopen = () => {
          console.log('[Chat] WebSocket connected')
          connectionRetries.value = 0
          loadConversations()
        }

        ws.value.onmessage = (event) => {
          handleWebSocketMessage(JSON.parse(event.data))
        }

        ws.value.onerror = (error) => {
          console.error('[Chat] WebSocket error:', error)
        }

        ws.value.onclose = () => {
          console.log('[Chat] WebSocket closed')
          // Reconnect logic
          if (connectionRetries.value < 5) {
            connectionRetries.value++
            setTimeout(connectWebSocket, 3000 * connectionRetries.value)
          }
        }
      } catch (error) {
        console.error('[Chat] Failed to connect WebSocket:', error)
      }
    }

    const resolveMessageKind = (data) => {
      const event = data?.event
      const type = data?.type

      if (event === 'conversation.message_created' || type === 'message') {
        return 'message'
      }
      if (event === 'notification.created' || type === 'notification') {
        return 'notification'
      }
      if (event === 'presence.online' || type === 'user_online' || type === 'presence.online') {
        return 'presence_online'
      }
      if (event === 'presence.offline' || type === 'user_offline' || type === 'presence.offline') {
        return 'presence_offline'
      }
      return 'unknown'
    }

    const handleWebSocketMessage = (data) => {
      const kind = resolveMessageKind(data)

      if (kind === 'message') {
        handleIncomingMessage(data)
      } else if (kind === 'notification') {
        handleNotification(data.notification)
      } else if (kind === 'presence_online') {
        const userId = data.user_id
        const userName = data.user_name || data.username
        onlineUsers.value.add(userId)
        emit('user-online', { userId, userName })
      } else if (kind === 'presence_offline') {
        const userId = data.user_id
        const userName = data.user_name || data.username
        onlineUsers.value.delete(userId)
        emit('user-offline', { userId, userName })
      }
    }

    const handleIncomingMessage = (data) => {
      const conversation = conversations.value.find(c => c.id === data.conversation_id)
      if (!conversation) {
        loadConversations()
      } else {
        if (!conversation.messages) conversation.messages = []
        conversation.messages.push({
          id: data.id || `msg_${Date.now()}`,
          sender_id: data.sender_id,
          sender_name: data.sender_name,
          content: data.content,
          created_at: data.timestamp,
          is_read: true
        })

        // Scroll to bottom
        nextTick(() => {
          if (messagesList.value) {
            messagesList.value.scrollTop = messagesList.value.scrollHeight
          }
        })
      }

      // Notify
      if (data.sender_id !== currentUserIdValue.value) {
        playNotificationSound()
      }
    }

    const handleNotification = (notification) => {
      notificationCount.value++
      emit('notification', notification)
      playNotificationSound()

      // Auto-clear after 5s
      setTimeout(() => {
        if (notificationCount.value > 0) {
          notificationCount.value--
        }
      }, 5000)
    }

    const loadConversations = async () => {
      try {
        const response = await fetch(`${props.apiUrl}/api/messages/conversations`, {
          headers: { Authorization: `Bearer ${props.jwtToken}` }
        })
        const data = await response.json()
        conversations.value = data.conversations || []

        // Update unread count
        unreadCount.value = conversations.value.reduce(
          (sum, conv) => sum + (conv.unread_count || 0),
          0
        )
      } catch (error) {
        console.error('[Chat] Failed to load conversations:', error)
      }
    }

    const selectConversation = async (conversation) => {
      selectedConversation.value = conversation

      // Load full messages
      try {
        const response = await fetch(
          `${props.apiUrl}/api/messages/conversations/${conversation.id}/messages?limit=50`,
          { headers: { Authorization: `Bearer ${props.jwtToken}` } }
        )
        const data = await response.json()
        conversation.messages = data.messages || []

        // Mark as read
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
          ws.value.send(JSON.stringify({
            type: 'message_read',
            conversation_id: conversation.id
          }))
        }

        // Scroll to bottom
        nextTick(() => {
          if (messagesList.value) {
            messagesList.value.scrollTop = messagesList.value.scrollHeight
          }
        })
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error)
      }
    }

    const hasParticipant = (conversation, userId) => {
      if (!conversation || !Array.isArray(conversation.participants)) {
        return false
      }
      return conversation.participants.some((participant) => Number(participant?.id) === userId)
    }

    const openConversationWithUser = async (userId) => {
      const targetUserId = Number(userId)
      if (!Number.isFinite(targetUserId)) {
        return false
      }

      if (conversations.value.length === 0) {
        await loadConversations()
      }

      const targetConversation = conversations.value.find((conversation) =>
        hasParticipant(conversation, targetUserId)
      )
      if (!targetConversation) {
        isMinimized.value = false
        return false
      }

      isMinimized.value = false
      await selectConversation(targetConversation)
      return true
    }

    const sendMessage = async () => {
      if (!newMessage.value.trim() || !selectedConversation.value) return

      const payload = {
        type: 'chat',
        conversation_id: selectedConversation.value.id,
        content: newMessage.value
      }

      try {
        // Also save via REST API for persistence
        await fetch(`${props.apiUrl}/api/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${props.jwtToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversation_id: selectedConversation.value.id,
            content: newMessage.value
          })
        })

        // Send via WebSocket
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
          ws.value.send(JSON.stringify(payload))
        }

        newMessage.value = ''
      } catch (error) {
        console.error('[Chat] Failed to send message:', error)
      }
    }

    const toggleMinimize = () => {
      isMinimized.value = !isMinimized.value
    }

    const playNotificationSound = () => {
      // Play subtle notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gain.gain.setValueAtTime(0.3, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    }

    const getConversationName = (conversation) => {
      if (conversation.name) return conversation.name
      if (conversation.type === 'direct') {
        return conversation.participants?.[0]?.username || 'Unknown'
      }
      return 'Conversation'
    }

    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date

      if (diff < 60000) return 'now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
      return date.toLocaleDateString()
    }

    // Lifecycle
    onMounted(() => {
      connectWebSocket()
    })

    onUnmounted(() => {
      if (ws.value) {
        ws.value.close()
      }
    })

    expose({
      openConversationWithUser
    })

    return {
      conversations,
      selectedConversation,
      selectedMessages,
      newMessage,
      isMinimized,
      unreadCount,
      notificationCount,
      showNotificationsBadge,
      messagesList,
      onlineParticipants,
      currentUserIdValue,
      selectConversation,
      sendMessage,
      toggleMinimize,
      getConversationName,
      formatTime
    }
  }
}
</script>

<style scoped>
.chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 350px;
  max-height: 600px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  z-index: 1000;
}

.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  cursor: pointer;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
}

.header-controls button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
}

.header-controls button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.chat-minimized {
  padding: 16px;
  text-align: center;
  color: #667eea;
  font-weight: 500;
  cursor: pointer;
}

.unread-badge {
  display: inline-block;
  background: #f74c31;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  line-height: 24px;
  font-size: 12px;
  font-weight: bold;
  margin-right: 8px;
}

.chat-content {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.chat-main {
  display: flex;
  flex: 1;
  min-height: 0;
}

.conversations-list {
  width: 120px;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
  background: #f9f9f9;
}

.list-header {
  padding: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  border-bottom: 1px solid #e0e0e0;
}

.conversation-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 13px;
}

.conversation-item:hover {
  background: #efefef;
}

.conversation-item.active {
  background: #e3e7ff;
  font-weight: 600;
}

.conv-name {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.conv-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #999;
}

.unread {
  background: #f74c31;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  font-weight: bold;
  font-size: 10px;
}

.messages-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.messages-header {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
  background: #f9f9f9;
}

.messages-header h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.participants-online {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
}

.online-indicator {
  color: #4caf50;
  font-weight: 500;
  white-space: nowrap;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.message.own {
  align-items: flex-end;
}

.message-sender {
  font-size: 11px;
  color: #999;
  font-weight: 600;
}

.message-bubble {
  background: #e3e7ff;
  color: #333;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 80%;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.4;
}

.message.own .message-bubble {
  background: #667eea;
  color: white;
}

.message-time {
  font-size: 10px;
  color: #ccc;
}

.message-input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.message-input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.message-input:focus {
  outline: none;
  border-color: #667eea;
}

.send-btn {
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn:hover {
  background: #5568d3;
}

.send-btn:active {
  transform: scale(0.98);
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #999;
  font-size: 13px;
  text-align: center;
}

.notifications-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 20px;
  cursor: pointer;
}

.badge-count {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #f74c31;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  font-size: 11px;
  font-weight: bold;
}
</style>
