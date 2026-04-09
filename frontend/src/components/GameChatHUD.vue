<template>
  <div class="game-chat-hud">
    <!-- Chat Messages Display -->
    <div class="chat-messages" ref="messagesContainer">
      <transition-group name="message" tag="div">
        <div
          v-for="msg in recentMessages"
          :key="msg.id"
          class="chat-message"
          :class="{ own: msg.sender_id === currentUserIdValue }"
        >
          <span class="sender">{{ msg.sender_name }}</span>
          <span class="content">{{ msg.content }}</span>
        </div>
      </transition-group>
    </div>

    <!-- Chat Input (Toggleable) -->
    <div v-if="showInput" class="chat-input">
      <input
        v-model="newMessage"
        @keyup.enter="sendMessage"
        @keyup.escape="showInput = false"
        placeholder="Say something..."
        class="input-field"
        autofocus
      />
      <button @click="sendMessage" class="send-btn">Send</button>
    </div>


    <button v-else @click="showInput = true" class="toggle-btn">
      💬 Chat
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, inject, onUnmounted } from 'vue'

const props = defineProps({
  matchId: {
    type: String,
    required: true
  },
  players: {
    type: Array,
    default: () => []
  },
  wsClient: {
    type: Object,
    default: null
  }
})

const currentUserId = inject('currentUserId')
const apiUrl = inject('apiUrl')
const jwtToken = inject('jwtToken')
const injectedGameClient = inject('gameClient', null)

const activeWsClient = computed(() => props.wsClient || injectedGameClient)
const canUseRestApi = computed(() => {
  const numeric = Number(props.matchId)
  return Number.isFinite(numeric)
})

const messages = ref([])
const newMessage = ref('')
const showInput = ref(false)
const messagesContainer = ref(null)

const currentUserIdValue = computed(() => {
  const wsUserId = activeWsClient.value?.userId
  if (wsUserId !== undefined && wsUserId !== null) {
    return wsUserId
  }
  const raw = currentUserId?.value ?? currentUserId
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : raw
})

// Show last 5 messages
const recentMessages = computed(() => {
  return messages.value.slice(-5)
})

let previousRoomHandler = null
let roomMessageWrapper = null

const resolveSenderName = (senderId) => {
  const player = props.players.find(p =>
    p?.id === senderId ||
    p?.user_id === senderId ||
    p?.player_id === senderId
  )
  return player?.name || player?.username || `Player ${senderId}`
}

const handleRoomMessage = (message) => {
  const senderId = message.user_id ?? message.sender_id
  messages.value.push({
    id: message.id || `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    sender_id: senderId,
    sender_name: resolveSenderName(senderId),
    content: message.content
  })
}

const sendMessage = async () => {
  if (!newMessage.value.trim()) return

  if (activeWsClient.value && typeof activeWsClient.value.sendRoomMessage === 'function') {
    activeWsClient.value.sendRoomMessage(newMessage.value)
    newMessage.value = ''
    return
  }

  if (!canUseRestApi.value) {
    console.warn('[GameChat] No WebSocket client and matchId is not numeric.')
    return
  }

  try {
    // Send via REST API (will also broadcast via WebSocket)
    const response = await fetch(`${apiUrl}/api/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversation_id: props.matchId,
        content: newMessage.value
      })
    })

    if (response.ok) {
      const message = await response.json()
      messages.value.push({
        id: message.id,
        sender_id: currentUserId.value,
        sender_name: 'You',
        content: newMessage.value
      })

      newMessage.value = ''

      // Auto-close input after sending
      setTimeout(() => {
        showInput.value = false
      }, 1000)
    }
  } catch (error) {
    console.error('[GameChat] Failed to send message:', error)
  }
}

// Listen for incoming messages via WebSocket
const addMessage = (message) => {
  messages.value.push(message)

  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Auto-scroll to latest message
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
)

// Expose method for parent component to add messages
defineExpose({ addMessage })

watch(
  () => activeWsClient.value,
  (client) => {
    if (!client) {
      return
    }
    previousRoomHandler = client.onRoomMessage
    roomMessageWrapper = (message) => {
      if (typeof previousRoomHandler === 'function') {
        previousRoomHandler(message)
      }
      handleRoomMessage(message)
    }
    client.onRoomMessage = roomMessageWrapper
  },
  { immediate: true }
)

onUnmounted(() => {
  const client = activeWsClient.value
  if (client && roomMessageWrapper && client.onRoomMessage === roomMessageWrapper) {
    client.onRoomMessage = previousRoomHandler
  }
})
</script>

<style scoped>
.game-chat-hud {
  position: relative;
  width: 100%;
  max-width: 260px;
  background: linear-gradient(155deg, rgba(10, 14, 20, 0.92), rgba(2, 4, 6, 0.85));
  border: 1px solid rgba(94, 200, 255, 0.35);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.6),
    0 0 18px rgba(70, 170, 255, 0.16);
  z-index: 500;
  font-family: "Space Grotesk", "Rajdhani", "Trebuchet MS", sans-serif;
}

.chat-messages {
  max-height: 120px;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-message {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #e6f0ff;
  animation: slideIn 0.3s ease-out;
}

.chat-message.own {
  justify-content: flex-end;
}

.sender {
  color: #7fd4ff;
  font-weight: bold;
  min-width: 50px;
}

.chat-message.own .sender {
  color: #86ffcf;
  text-align: right;
  min-width: auto;
}

.content {
  color: #d9e6ff;
  word-wrap: break-word;
  max-width: 180px;
}

.chat-message.own .content {
  color: #f7fbff;
  background: rgba(94, 200, 255, 0.18);
  padding: 2px 6px;
  border-radius: 4px;
}

.chat-input {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-top: 1px solid rgba(94, 200, 255, 0.2);
}

.input-field {
  flex: 1;
  background: rgba(10, 18, 28, 0.8);
  border: 1px solid rgba(94, 200, 255, 0.28);
  color: #f1f6ff;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: "Space Grotesk", "Rajdhani", "Trebuchet MS", sans-serif;
}

.input-field::placeholder {
  color: rgba(230, 240, 255, 0.5);
}

.input-field:focus {
  outline: none;
  background: rgba(12, 22, 34, 0.95);
  border-color: rgba(134, 255, 207, 0.6);
}

.send-btn {
  background: linear-gradient(140deg, rgba(80, 158, 255, 0.9), rgba(48, 90, 156, 0.9));
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn:hover {
  background: linear-gradient(140deg, rgba(92, 176, 255, 0.95), rgba(60, 112, 190, 0.95));
}

.toggle-btn {
  width: 100%;
  background: linear-gradient(150deg, rgba(22, 34, 54, 0.95), rgba(8, 12, 20, 0.9));
  color: #d9e6ff;
  border: none;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(94, 200, 255, 0.3);
  box-shadow: 0 0 12px rgba(70, 170, 255, 0.2);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.toggle-btn:hover {
  background: #5568d3;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.message-enter-active {
  animation: slideIn 0.3s ease-out;
}

/* Scrollbar styling */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #667eea;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #5568d3;
}
</style>
