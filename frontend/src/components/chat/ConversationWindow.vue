<template>
  <div class="conversation-window">

    <div
      v-for="msg in messages"
      :key="msg.id"
      :class="messageClass(msg)"
    >
      <p>{{ msg.content }}</p>
      <small>{{ formatTime(msg.created_at) }}</small>
    </div>

  </div>
</template>

<script setup>
const props = defineProps({
  messages: Array,
  currentUserId: Number
})

const formatTime = (time) => {
  return new Date(time).toLocaleTimeString()
}

const isMine = (msg) => msg.sender_id === props.currentUserId

const messageClass = (msg) => {
  return isMine(msg) ? 'mine' : 'theirs'
}

const scrollToBottom = () => {}

const groupMessages = () => {}
</script>