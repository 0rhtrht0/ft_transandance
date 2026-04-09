<template>
  <div class="conversation-list">

    <div
      v-for="conv in conversations"
      :key="conv.id"
      @click="$emit('select', conv)"
      class="conversation-item"
      :class="{ active: activeConversation?.id === conv.id }"
    >
      <img :src="conv.avatar" class="avatar" />

      <div>
        <div>{{ conv.username }}</div>
        <div>{{ formatLastMessage(conv.last_message) }}</div>
      </div>

      <span v-if="conv.unread_count > 0">
        {{ conv.unread_count }}
      </span>
    </div>

  </div>
</template>

<script setup>
defineProps({
  conversations: Array,
  activeConversation: Object
})

const formatLastMessage = (msg) => {
  return msg?.slice(0, 30)
}

const formatTime = (time) => {
  return new Date(time).toLocaleTimeString()
}

const isUnread = (conv) => conv.unread_count > 0

const isOnline = (conv) => conv.is_online

const getPreview = (conv) => conv.last_message
</script>