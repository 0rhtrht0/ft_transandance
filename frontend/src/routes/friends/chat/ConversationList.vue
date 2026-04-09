<template>
  <aside class="conversation-sidebar">
    <header class="sidebar-header">
      <h3>Conversations</h3>
    </header>

    <div class="conversation-container">
      <div v-if="conversations.length === 0" class="empty-state">
        <p>No active conversations</p>
      </div>

      <button
        v-for="conversation in conversations"
        :key="conversation.id"
        type="button"
        class="conversation-item"
        :class="{ active: conversation.id === activeConversationId }"
        @click="$emit('select', conversation.id)"
      >
        <div class="avatar-wrapper">
          <div class="avatar" :style="getConversationAvatarStyle(conversation)" aria-hidden="true"></div>
          <div v-if="isConversationOnline(conversation)" class="online-indicator"></div>
        </div>
        
        <div class="conversation-content">
          <div class="top-row">
            <span class="name">{{ getConversationName(conversation) }}</span>
            <span v-if="conversation.unread_count > 0" class="unread-badge">
              {{ conversation.unread_count }}
            </span>
          </div>
          <p class="preview">{{ getConversationSubtitle(conversation) }}</p>
        </div>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { getApiBase } from '../../auth/auth_api.js'

const DEFAULT_AVATAR = '/assets/images/default-avatar.svg'

const props = defineProps({
  conversations: {
    type: Array,
    default: () => []
  },
  activeConversationId: {
    type: Number,
    default: null
  }
})

defineEmits(['select'])

const getConversationName = (conversation) => {
  if (conversation.name) return conversation.name
  const participants = conversation.participants || []
  if (!participants.length) return 'Conversation'
  return participants.map((p) => p.username).join(', ')
}

const getConversationSubtitle = (conversation) => {
  const lastMessage = String(conversation?.last_message?.content || '').trim()
  if (lastMessage) return lastMessage
  if (conversation?.last_message?.image_url) return 'Photo attachment'
  return ''
}

const isConversationOnline = (conversation) => {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  return participants.length === 1 && Boolean(participants[0]?.is_online)
}

const getConversationAvatar = (conversation) => {
  const participant = Array.isArray(conversation?.participants) ? conversation.participants[0] : null
  const raw = participant?.avatar || participant?.avatar_url || null
  if (!raw) return DEFAULT_AVATAR
  if (String(raw).startsWith('http')) return raw
  return `${getApiBase()}${String(raw).startsWith('/') ? '' : '/'}${raw}`
}

const getConversationAvatarStyle = (conversation) => ({
  backgroundImage: `url("${getConversationAvatar(conversation)}")`,
  backgroundSize: 'cover',
  backgroundPosition: 'center'
})
</script>

<style scoped>
.conversation-sidebar {
  display: flex;
  flex-direction: column;
  width: 280px;
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  overflow: hidden;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #222;
}

.sidebar-header h3 { margin: 0; font-size: 14px; text-transform: uppercase; color: #888; }

.conversation-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state { padding: 40px 20px; text-align: center; color: #555; font-size: 13px; }

.conversation-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.conversation-item:hover { background: #1a1a1a; }
.conversation-item.active { background: #222; border-color: #333; }

.avatar { width: 40px; height: 40px; border-radius: 6px; background: #222; position: relative; }

.online-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #111;
}

.conversation-content { flex: 1; min-width: 0; }
.top-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.name { font-size: 14px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.unread-badge {
  background: var(--social-accent);
  color: #000;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.preview { font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }

@media (max-width: 900px) {
  .conversation-sidebar { width: 100%; }
}
</style>
