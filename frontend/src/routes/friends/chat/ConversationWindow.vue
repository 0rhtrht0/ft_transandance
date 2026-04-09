<template>
  <section class="conversation-window">
    <div v-if="pendingRecipientId && !conversation" class="hint">
      <div class="pending-recipient">
        <div class="pending-avatar" :style="pendingRecipientAvatarStyle"></div>
        <div class="pending-copy">
          <strong>New Chat</strong>
          <p>You can message {{ pendingRecipientName }} to start a conversation.</p>
        </div>
        <button
          v-if="pendingProfileTarget"
          type="button"
          class="profile-btn profile-trigger"
          @click="emitViewProfile(pendingProfileTarget)"
        >
          View Profile
        </button>
      </div>
    </div>

    <div v-else-if="!conversation" class="hint">
      Select a conversation or search for a player.
    </div>

    <template v-else>
      <header class="chat-header">
        <div class="target-info">
          <div class="target-avatar" :style="avatarStyle(conversationProfileTarget || pendingProfileTarget)"></div>
          <div class="target-details">
            <h3>{{ conversationTitle }}</h3>
          </div>
        </div>
        <button
          v-if="conversationProfileTarget || pendingProfileTarget"
          type="button"
          class="profile-btn profile-trigger"
          @click="emitViewProfile(conversationProfileTarget || pendingProfileTarget)"
        >
          View Profile
        </button>
      </header>

      <div class="messages-viewport" ref="msgContainer">
        <div v-if="hasMore" class="load-history-row">
          <button 
            type="button" 
            class="load-more-btn" 
            :disabled="loadingHistory"
            @click="$emit('load-more')"
          >
            {{ loadingHistory ? 'Loading...' : 'Load older messages' }}
          </button>
        </div>

        <div v-if="messages.length === 0" class="chat-empty">
          <p>Start of your conversation.</p>
        </div>

        <article
          v-for="message in messages"
          :key="message.id"
          class="chat-bubble-row"
          :class="{ own: message.sender_id === currentUserId }"
        >
          <div
            class="message-avatar"
            :style="message.sender_id === currentUserId ? currentUserAvatarStyle : avatarStyle({ avatar: message.sender_avatar })"
          ></div>
          <div class="bubble-content">
            <strong class="bubble-author">{{ message.sender_id === currentUserId ? 'You' : (message.sender_name || 'User') }}</strong>
            <div v-if="resolveMessageImageUrl(message)" class="attachment-wrapper">
              <img
                v-if="isImageFileUrl(resolveMessageImageUrl(message))"
                class="chat-image message-image"
                :src="resolveMessageImageUrl(message)"
                alt="Shared image"
              />
              <a 
                v-else 
                :href="resolveMessageImageUrl(message)" 
                target="_blank" 
                class="chat-file-pill" 
                :download="getFilePreviewName(resolveMessageImageUrl(message))"
              >
                <AppIcon name="file" :size="16" />
                <span>{{ getFilePreviewName(resolveMessageImageUrl(message)) }}</span>
              </a>
            </div>
            <div v-if="message.content" class="bubble-text">{{ message.content }}</div>
            <span class="bubble-meta">{{ formatRelativeTime(message.created_at) }}</span>
          </div>
        </article>
      </div>
    </template>

    <footer class="conversation-composer">
      <slot name="composer" />
    </footer>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getApiBase } from '../../auth/auth_api.js'
import { formatRelativeTime } from '../utils/timeFormatter'
import AppIcon from '../../../components/ui/AppIcon.vue'

const props = defineProps({
  conversation: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  currentUserId: { type: Number, default: null },
  currentUserAvatar: { type: String, default: null },
  pendingRecipientId: { type: Number, default: null },
  pendingRecipient: { type: Object, default: null },
  loadingHistory: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false }
})
const emit = defineEmits(['view-profile', 'load-more'])

const msgContainer = ref(null)
const isAutoScrolling = ref(true)

const scrollToBottom = async (force = false) => {
  await nextTick()
  if (!msgContainer.value) return
  if (force || isAutoScrolling.value) {
    msgContainer.value.scrollTop = msgContainer.value.scrollHeight
  }
}

const handleScroll = () => {
  if (!msgContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = msgContainer.value
  isAutoScrolling.value = scrollHeight - (scrollTop + clientHeight) < 50
}

watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen > oldLen && !props.loadingHistory) {
    const isNewMessage = oldLen > 0 && props.messages[newLen - 1]?.id !== props.messages[oldLen - 1]?.id
    scrollToBottom(isNewMessage)
  }
})

watch(() => props.conversation?.id, () => {
  scrollToBottom(true)
})

onMounted(() => {
  scrollToBottom(true)
  if (msgContainer.value) {
    msgContainer.value.addEventListener('scroll', handleScroll)
  }
})

const DEFAULT_AVATAR = '/assets/images/default-avatar.svg'

const conversationTitle = computed(() => {
  if (!props.conversation) return 'Chat'
  if (props.conversation.name) return props.conversation.name
  const participants = props.conversation.participants || []
  return participants.map((p) => p.username).join(', ') || 'Chat'
})

const pendingRecipientName = computed(() => props.pendingRecipient?.username || `User #${props.pendingRecipientId}`)

const conversationProfileTarget = computed(() => {
  const participants = Array.isArray(props.conversation?.participants) ? props.conversation.participants : []
  if (participants.length !== 1) return null
  const participant = participants[0]
  return { id: participant.id, username: participant.username, avatar: participant.avatar || participant.avatar_url }
})

const pendingProfileTarget = computed(() => {
  if (!props.pendingRecipientId) return null
  return {
    id: props.pendingRecipientId,
    username: pendingRecipientName.value,
    avatar: props.pendingRecipient?.avatar || props.pendingRecipient?.avatar_url || null
  }
})

const resolveAvatarUrl = (raw) => {
  if (!raw) return DEFAULT_AVATAR
  if (String(raw).startsWith('http')) return raw
  return `${getApiBase()}${String(raw).startsWith('/') ? '' : '/'}${raw}`
}

const pendingRecipientAvatarStyle = computed(() => ({
  backgroundImage: `url("${resolveAvatarUrl(null)}")`,
  backgroundSize: 'cover'
}))

const currentUserAvatarStyle = computed(() => ({
  backgroundImage: `url("${resolveAvatarUrl(props.currentUserAvatar)}")`,
  backgroundSize: 'cover'
}))

const avatarStyle = (target) => ({
  backgroundImage: `url("${resolveAvatarUrl(target?.avatar)}")`,
  backgroundSize: 'cover'
})

const resolveMessageImageUrl = (message) => {
  const raw = message?.image_url || message?.imageUrl
  if (!raw) return null
  return resolveAvatarUrl(raw)
}
const isImageFileUrl = (url) => !/\.(pdf|doc|docx|txt|zip|tar|gz|csv)$/i.test(url)
const getFilePreviewName = (url) => {
  const base = String(url).split('/').pop() || 'File'
  // Strips message_{user_id}_{time_ns}_
  return base.replace(/^message_\d+_\d+_/, '')
}

const emitViewProfile = (target) => {
  if (target?.id) emit('view-profile', target)
}
</script>

<style scoped>
.conversation-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  overflow: hidden;
}

.chat-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #222;
  background: #181818;
}

.target-info { display: flex; align-items: center; gap: 12px; }
.target-avatar { width: 36px; height: 36px; border-radius: 6px; background: #222; }
.target-details h3 { margin: 0; font-size: 15px; color: #fff; }

.profile-btn {
  background: #222;
  border: 1px solid #333;
  color: #888;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.messages-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.load-history-row { display: flex; justify-content: center; padding-bottom: 12px; }
.load-more-btn {
  background: #1a1a1a;
  border: 1px solid #333;
  padding: 6px 16px;
  border-radius: 20px;
  color: #666;
  font-size: 12px;
  cursor: pointer;
}

.chat-bubble-row { display: flex; width: 100%; gap: 8px; align-items: flex-end; margin-bottom: 2px; }
.chat-bubble-row.own { justify-content: flex-end; }

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #222;
  flex-shrink: 0;
  border: 1px solid #333;
}

.bubble-content { max-width: calc(80% - 36px); display: flex; flex-direction: column; }
.chat-bubble-row.own .bubble-content { align-items: flex-end; max-width: 80%; }

.bubble-text {
  padding: 10px 14px;
  border-radius: 12px;
  background: #222;
  color: #eee;
  font-size: 14px;
  line-height: 1.5;
}

.own .bubble-text { background: var(--social-accent); color: #000; font-weight: 500; }

.bubble-meta { font-size: 10px; color: #555; margin-top: 4px; }

.chat-image { max-width: 280px; height: auto; border-radius: 8px; margin-bottom: 4px; border: 1px solid #333; }

.conversation-composer { padding: 16px; border-top: 1px solid #222; }

.chat-file-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  max-width: 100%;
}

.chat-file-pill:hover {
  background: #222;
  border-color: #444;
}

.chat-file-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint, .chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 14px;
}
</style>
