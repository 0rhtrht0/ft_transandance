<template>
  <section class="social-messages-tab">
    <header class="messages-header">
      <div class="messages-header__copy">
        <h2>Messages</h2>
        <p>{{ messagesSubtitle }}</p>
      </div>
    </header>

    <ChatLayout
      :current-user-id="currentUserId"
      :current-user-avatar="currentUserAvatar"
      :chat-target="chatTarget"
      :realtime-event="realtimeEvent"
      :realtime-send="realtimeSend"
      :is-active="isActive"
      @message-sent="$emit('message-sent', $event)"
      @notify="$emit('notify', $event)"
      @unread-count-change="$emit('unread-count-change', $event)"
      @view-profile="$emit('view-profile', $event)"
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import ChatLayout from '../chat/ChatLayout.vue'

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

defineEmits(['message-sent', 'notify', 'view-profile', 'unread-count-change'])

const messagesSubtitle = computed(() => {
  if (props.chatTarget?.username) {
    return `Conversation with ${props.chatTarget.username}`
  }
  return 'Your private conversations'
})
</script>

<style scoped>
.social-messages-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  min-height: 0;
}

.messages-header {
  padding: 20px;
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
}

.messages-header h2 { margin: 0; font-size: 18px; }
.messages-header__copy p { margin: 4px 0 0; color: #888; font-size: 14px; }
</style>
