<template>
  <div v-if="open" class="profile-modal" @click.self="$emit('close')">
    <section
      ref="dialogRef"
      class="profile-card"
      role="dialog"
      aria-modal="true"
      @keydown="handleDialogKeydown"
    >
      <header class="profile-header">
        <div class="profile-identity">
          <div class="profile-avatar" :style="avatarStyle">
            <span v-if="!hasAvatar">{{ profileInitial }}</span>
          </div>
          <div class="profile-info">
            <h2 :class="{ 'me-badge': profile?.is_me }">{{ profileTitle }}</h2>
            <span class="profile-status" :class="{ online: profile?.is_online }">
              {{ profile?.is_online ? 'Online' : 'Offline' }}
            </span>
          </div>
        </div>
        <button ref="closeButtonRef" type="button" class="close-btn" @click="$emit('close')">
          <AppIcon name="x" :size="20" />
        </button>
      </header>

      <div v-if="loading" class="profile-loading">Loading profile...</div>
      <div v-else-if="error" class="profile-error">{{ error }}</div>
      <template v-else-if="profile">
        <div class="profile-content">
          <section class="profile-stats">
            <div class="stat-item">
              <span class="label">Evaluation Points</span>
              <strong class="value">{{ profile.stats?.evaluation_points || 0 }}</strong>
            </div>
            <div class="stat-item">
              <span class="label">Rank</span>
              <strong class="value">{{ resolveProfileRank(profile.stats?.evaluation_points) }}</strong>
            </div>
          </section>

          <section class="profile-bio">
            <h3>About</h3>
            <p>{{ profile.bio || 'No biography provided.' }}</p>
          </section>

          <section v-if="profile.progression?.length" class="profile-progression">
            <h3>Progression</h3>
            <div class="progression-list">
              <div v-for="entry in profile.progression" :key="entry.difficulty" class="progression-item">
                <span class="diff">{{ entry.difficulty }}</span>
                <span class="stage">Stage {{ entry.current_stage }}</span>
              </div>
            </div>
          </section>

          <section v-if="profile.stats?.unlocked_achievements?.length" class="profile-achievements">
            <h3>Achievements</h3>
            <div class="achievements-flex">
              <span v-for="a in profile.stats.unlocked_achievements" :key="a" class="badge">
                {{ a }}
              </span>
            </div>
          </section>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { getApiBase } from '../../auth/auth_api.js'
import { resolveProfileRank } from '../utils/profileSummary'

const props = defineProps({
  open: { type: Boolean, default: false },
  profile: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

defineEmits(['close'])

const dialogRef = ref(null)
const closeButtonRef = ref(null)
let previousActiveElement = null

const avatarStyle = computed(() => {
  const avatar = props.profile?.avatar
  if (!avatar) return {}
  const url = String(avatar).startsWith('http') ? avatar : `${getApiBase()}${String(avatar).startsWith('/') ? '' : '/'}${avatar}`
  return { backgroundImage: `url("${url}")`, backgroundSize: 'cover' }
})

const hasAvatar = computed(() => Boolean(props.profile?.avatar))
const profileInitial = computed(() => String(props.profile?.username || '?').charAt(0).toUpperCase())
const profileTitle = computed(() => props.profile?.is_me ? `${props.profile.username} (You)` : props.profile?.username)

const handleDialogKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeButtonRef.value?.click()
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previousActiveElement = document.activeElement
    await nextTick()
    closeButtonRef.value?.focus?.()
  } else if (previousActiveElement?.focus) {
    previousActiveElement.focus()
  }
})

onBeforeUnmount(() => {
  if (previousActiveElement?.focus) previousActiveElement.focus()
})
</script>

<style scoped>
.profile-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.profile-card {
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.profile-header {
  padding: 20px;
  border-bottom: 1px solid #222;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-identity { display: flex; gap: 16px; align-items: center; }

.profile-avatar {
  width: 64px;
  height: 64px;
  background: #222;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}

.profile-info h2 { margin: 0; font-size: 18px; color: #fff; }
.profile-status { font-size: 12px; color: #888; }
.profile-status.online { color: #22c55e; }

.me-badge::after {
  content: 'YOU';
  font-size: 10px;
  margin-left: 8px;
  padding: 2px 4px;
  background: #333;
  border-radius: 4px;
}

.close-btn {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
}

.close-btn:hover { color: #fff; }

.profile-content { padding: 20px; display: flex; flex-direction: column; gap: 24px; }

.profile-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-item {
  background: #181818;
  padding: 12px;
  border: 1px solid #222;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.stat-item .label { font-size: 11px; color: #666; text-transform: uppercase; }
.stat-item .value { font-size: 18px; color: #fff; margin-top: 4px; }

.profile-content h3 { margin: 0 0 12px; font-size: 13px; color: #555; text-transform: uppercase; }

.profile-bio p { margin: 0; font-size: 14px; color: #888; line-height: 1.5; }

.progression-list { display: flex; flex-direction: column; gap: 8px; }
.progression-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #181818;
  border-radius: 6px;
  font-size: 13px;
}

.diff { color: #888; }
.stage { color: #fff; font-weight: 600; }

.achievements-flex { display: flex; flex-wrap: wrap; gap: 8px; }
.badge {
  background: #222;
  border: 1px solid #333;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  color: #fff;
}

.profile-loading, .profile-error { padding: 40px; text-align: center; color: #888; }
.profile-error { color: #ef4444; }
</style>
