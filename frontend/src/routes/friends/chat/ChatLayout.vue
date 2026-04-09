<template>
  <div class="chat-layout">
    <ConversationList
      :conversations="conversations"
      :active-conversation-id="selectedConversationId"
      @select="handleSelectConversation"
    />

    <div class="chat-main">
      <ConversationWindow
        :conversation="selectedConversation"
        :messages="messages"
        :current-user-id="currentUserId"
        :current-user-avatar="currentUserAvatar"
        :pending-recipient-id="pendingRecipientId"
        :pending-recipient="pendingRecipient"
        :loading-history="loadingMessages"
        :has-more="hasMoreMessages"
        @view-profile="emit('view-profile', $event)"
        @load-more="loadMoreMessages"
      >
        <template #composer>
          <MessageInput
            :disabled="sending || (!selectedConversationId && !pendingRecipientId)"
            :placeholder="inputPlaceholder"
            @send="handleSendMessage"
          />
        </template>
      </ConversationWindow>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ConversationList from './ConversationList.vue'
import ConversationWindow from './ConversationWindow.vue'
import MessageInput from './MessageInput.vue'
import { useChat } from '../composables/useChat'
import { uploadMessageImage } from '../services/chatService'
import { normalizeSocialRealtimeKind } from '../utils/socialRealtime'

const props = defineProps({
  currentUserId: {
    type: Number,
    default: null
  },
  currentUserAvatar: {
    type: String,
    default: null
  },
  chatTarget: {
    type: Object,
    default: null
  },
  realtimeEvent: {
    type: Object,
    default: null
  },
  realtimeSend: {
    type: Function,
    default: null
  },
  isActive: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['message-sent', 'notify', 'view-profile', 'unread-count-change'])
const refreshTimerId = ref(null)
const isRefreshing = ref(false)
const subscribedConversationIds = new Set()

const normalizeId = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const {
  conversations,
  totalUnreadMessages,
  selectedConversation,
  selectedConversationId,
  pendingRecipientId,
  messages,
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
  loadMoreMessages,
} = useChat()

const inputPlaceholder = computed(() => {
  if (pendingRecipientId.value && !selectedConversationId.value) {
    return 'Send a first message to create the conversation...'
  }
  if (!selectedConversationId.value) {
    return 'Choose a conversation or open a chat from the Friends tab.'
  }
  return 'Write a message...'
})

const resolveChatTargetId = (target) => {
  const parsed = Number(target?.userId ?? target?.id)
  return Number.isFinite(parsed) ? parsed : null
}

const pendingRecipient = computed(() => {
  if (!pendingRecipientId.value) return null

  if (resolveChatTargetId(props.chatTarget) === normalizeId(pendingRecipientId.value)) {
    return props.chatTarget
  }

  return {
    userId: pendingRecipientId.value,
    username: `User #${pendingRecipientId.value}`,
    avatar: null
  }
})

const selectFirstConversationIfNeeded = async (options = {}) => {
  if (selectedConversationId.value) return
  if (pendingRecipientId.value) return
  const firstConversation = conversations.value?.[0]
  if (!firstConversation?.id) return
  await selectConversation(firstConversation.id)
  if (options?.markRead) {
    await markConversationRead(firstConversation.id)
  }
}

const markSelectedConversationReadIfVisible = async () => {
  if (!props.isActive || !selectedConversationId.value) return
  const currentConversation = conversations.value.find(
    (conversation) => normalizeId(conversation?.id) === normalizeId(selectedConversationId.value)
  )
  if (!currentConversation || Number(currentConversation.unread_count || 0) <= 0) return
  try {
    await markConversationRead(selectedConversationId.value)
  } catch {
    // Keep the conversation usable even if the read-state sync fails.
  }
}

const subscribeConversation = (conversationId) => {
  const normalizedId = normalizeId(conversationId)
  if (normalizedId === null || subscribedConversationIds.has(normalizedId) || !props.realtimeSend) {
    return
  }

  const sent = props.realtimeSend({
    type: 'subscribe_conversation',
    conversation_id: normalizedId
  })

  if (sent) {
    subscribedConversationIds.add(normalizedId)
  }
}

const syncConversationSubscriptions = () => {
  for (const conversation of conversations.value) {
    subscribeConversation(conversation?.id)
  }
}

const handleRealtimeMessage = async (payload) => {
  const kind = normalizeSocialRealtimeKind(payload)

  if (kind === 'ws_sync') {
    await loadConversations()
    syncConversationSubscriptions()
    await selectFirstConversationIfNeeded({ markRead: props.isActive })
    if (selectedConversationId.value) {
      await loadConversationMessages(selectedConversationId.value, 100, true)
      await markSelectedConversationReadIfVisible()
    }
    return
  }

  if (kind === 'message') {
    const messageConversationId = Number(payload.conversation_id)
    const selectedId = Number(selectedConversationId.value)
    if (Number.isFinite(messageConversationId) && messageConversationId === selectedId) {
      await loadConversationMessages(selectedConversationId.value, 20, true)
      await markSelectedConversationReadIfVisible()
    }
    await loadConversations()
    syncConversationSubscriptions()
    await selectFirstConversationIfNeeded({ markRead: props.isActive })
    await markSelectedConversationReadIfVisible()
    return
  }

  if (kind === 'notification' && payload.notification) {
    const notificationType = String(payload.notification.type || '').toLowerCase()
    if (notificationType.includes('message')) {
      await loadConversations()
      syncConversationSubscriptions()
      if (selectedConversationId.value) {
        await loadConversationMessages(selectedConversationId.value, 20, true)
        await markSelectedConversationReadIfVisible()
      }
    }
    return
  }

  if (kind === 'presence_online' || kind === 'presence_offline') {
    await loadConversations()
    syncConversationSubscriptions()
    await selectFirstConversationIfNeeded({ markRead: props.isActive })
  }
}

const handleSelectConversation = async (conversationId) => {
  await selectConversation(conversationId)
  await markSelectedConversationReadIfVisible()
}

const handleSendMessage = async ({ content, imageFile }) => {
  try {
    let imageUrl = ''
    if (imageFile) {
      imageUrl = await uploadMessageImage(imageFile)
    }
    await sendMessage({ content, imageUrl })
    emit('message-sent', { content, imageUrl })
  } catch (err) {
    emit('notify', {
      type: 'error',
      title: 'Messages',
      message: err instanceof Error ? err.message : 'Unable to send the message.'
    })
  }
}

const refreshConversationsSilently = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await loadConversations()
    syncConversationSubscriptions()
    if (selectedConversationId.value) {
      await loadConversationMessages(selectedConversationId.value, 20, true)
    }
  } catch {
    // Silent background refresh failure.
  } finally {
    isRefreshing.value = false
  }
}

const startAutoRefresh = () => {
  if (refreshTimerId.value) return
  refreshTimerId.value = window.setInterval(() => {
    void refreshConversationsSilently()
  }, 5000)
}

const stopAutoRefresh = () => {
  if (!refreshTimerId.value) return
  window.clearInterval(refreshTimerId.value)
  refreshTimerId.value = null
}

watch(
  () => props.chatTarget?.requestId,
  async () => {
    const targetId = resolveChatTargetId(props.chatTarget)
    if (!targetId) return

    try {
      const opened = await openConversationWithUser(targetId)
      if (!opened) {
        emit('notify', {
          type: 'info',
          title: 'Chat',
          message: `No existing conversation with ${props.chatTarget?.username || 'this user'}. Send a first message to create it.`
        })
      } else {
        await markSelectedConversationReadIfVisible()
      }
    } catch (err) {
      emit('notify', {
        type: 'error',
        title: 'Chat',
        message: err instanceof Error ? err.message : 'Unable to open this conversation.'
      })
    }
  },
  { immediate: true }
)

onMounted(async () => {
  try {
    await loadConversations()
    syncConversationSubscriptions()
    await selectFirstConversationIfNeeded({ markRead: props.isActive })
    await markSelectedConversationReadIfVisible()
  } catch (err) {
    emit('notify', {
      type: 'error',
      title: 'Messages',
      message: err instanceof Error ? err.message : 'Unable to load conversations.'
    })
  }
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

watch(
  () => props.realtimeEvent?.id,
  async () => {
    const payload = props.realtimeEvent?.payload
    if (!payload) return
    await handleRealtimeMessage(payload)
  }
)

watch(
  () => props.isActive,
  async (isActive) => {
    if (!isActive) return
    await markSelectedConversationReadIfVisible()
    emit('unread-count-change', totalUnreadMessages.value)
  },
  { immediate: true }
)

watch(
  () => selectedConversationId.value,
  (conversationId) => {
    subscribeConversation(conversationId)
  },
  { immediate: true }
)

watch(
  () => totalUnreadMessages.value,
  (count) => {
    emit('unread-count-change', count)
  },
  { immediate: true }
)
</script>

<style scoped>
.chat-layout {
  display: flex;
  gap: 14px;
  min-height: 420px;
  min-width: 0;
  overflow: hidden;
}

.chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.error {
  margin: 0;
  color: #efefef;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 13px;
}

@media (max-width: 900px) {
  .chat-layout {
    flex-direction: column;
    min-height: 0;
  }

  .chat-main {
    min-height: 360px;
  }
}
</style>
