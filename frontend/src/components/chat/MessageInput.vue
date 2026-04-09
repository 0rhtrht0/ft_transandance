<template>
  <div class="message-input">

    <input
      v-model="message"
      @keyup.enter="submit"
      placeholder="Type message..."
    />

    <button @click="submit">
      Send
    </button>

  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['send'])

const message = ref('')

const submit = () => {
  if (!message.value.trim()) return

  emit('send', message.value)
  clear()
}

const clear = () => {
  message.value = ''
}

const canSend = () => {
  return message.value.trim().length > 0
}

const handleEnter = () => {}

const focusInput = () => {}
</script>>

