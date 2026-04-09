import { onUnmounted, ref } from 'vue'

export function useWebSocket() {
  const socket = ref(null)
  const isOpen = ref(false)

  const cleanup = () => {
    if (socket.value) {
      socket.value.onopen = null
      socket.value.onclose = null
      socket.value.onerror = null
      socket.value.onmessage = null
      if (socket.value.readyState === WebSocket.OPEN || socket.value.readyState === WebSocket.CONNECTING) {
        try {
          socket.value.close()
        } catch {
          // ignore
        }
      }
      socket.value = null
    }
    isOpen.value = false
  }

  const connect = (url) => {
    cleanup()
    try {
      socket.value = new WebSocket(url)
    } catch (error) {
      console.error('[WebSocket] Failed to construct WebSocket:', error)
      socket.value = null
      isOpen.value = false
      return
    }

    socket.value.onopen = () => {
      isOpen.value = true
    }

    socket.value.onclose = () => {
      isOpen.value = false
    }

    socket.value.onerror = (error) => {
      console.error('[WebSocket] Error event:', error)
    }
  }

  const disconnect = () => {
    cleanup()
  }

  const send = (data) => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      return
    }
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      socket.value.send(payload)
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error)
    }
  }

  const subscribe = (callback) => {
    if (!socket.value) {
      return
    }
    socket.value.onmessage = (event) => {
      try {
        const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        callback(parsed)
      } catch (error) {
        console.warn('[WebSocket] Failed to parse incoming message:', error)
      }
    }
  }

  const isConnected = () => {
    return isOpen.value
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    connect,
    disconnect,
    send,
    subscribe,
    isConnected,
    socket,
    isOpen,
  }
}