<template>
  <div class="chat-layout">

    <ConversationList
      :conversations="conversations"
      :activeConversation="activeConversation"
      @select="selectConversation"
    />

    <div class="chat-main" v-if="activeConversation">

      <ConversationWindow
        :messages="messages"
        :current-user-id="currentUserId"
      />

      <MessageInput
        @send="sendMessage"
      />

    </div>

  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import ConversationList from './ConversationList.vue'
import ConversationWindow from './ConversationWindow.vue'
import MessageInput from './MessageInput.vue'
import { useChat } from '@/composables/chat/useChat'

const currentUserId = 1

const {
  conversations,
  activeConversation,
  messages,
  loadConversations,
  selectConversation,
  sendMessage
} = useChat()

onMounted(() => {
  loadConversations()
  initChatSocket()
})
</script>