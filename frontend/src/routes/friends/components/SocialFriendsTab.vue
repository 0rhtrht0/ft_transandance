<template>
  <section class="social-friends-tab">
    <header class="friends-header">
      <div class="friends-header__copy">
        <h2>Friends</h2>
        <p class="friends-subtitle">Manage your connections and find players.</p>
      </div>
      <div class="search-box">
        <form class="search-form" @submit.prevent="submitSearch">
          <input
            v-model="query"
            type="text"
            placeholder="Search players..."
            class="search-input"
            @input="onSearchInput"
          />
          <button type="submit" class="search-btn" :disabled="!canSearch">Search</button>
        </form>
        <button type="button" class="profile-btn" :disabled="!resolvedCurrentUserId" @click="openOwnProfile">
          My Profile
        </button>
      </div>
    </header>

    <p v-if="globalError" class="error">{{ globalError }}</p>

    <section class="stats-grid">
      <article
        v-for="card in commandCards"
        :key="card.label"
        class="stat-card"
      >
        <span class="stat-label">{{ card.label }}</span>
        <strong class="stat-value">{{ card.value }}</strong>
      </article>
    </section>

    <div class="grid">
      <article v-if="showResults" class="panel panel-search-results">
        <div class="panel-heading">
          <h3>Search Results ({{ results.length }})</h3>
          <button type="button" class="btn-sm" @click="clear">Close</button>
        </div>

        <p v-if="searching" class="loading">Searching...</p>
        <p v-else-if="results.length === 0" class="empty">No users found.</p>

        <div v-for="user in results" :key="user.id" class="search-result">
          <div class="result-info">
            <div class="friend-avatar" :style="getFriendAvatarStyle(user)">
              <span v-if="!resolveFriendAvatar(user)">{{ friendInitial(user) }}</span>
            </div>
            <div class="result-details">
              <strong>{{ user.username }}</strong>
              <span class="points">{{ resolveSearchPoints(user) }} pts</span>
            </div>
          </div>

          <div class="result-actions">
            <button class="btn-sm" @click="openProfile(user)">Profile</button>
            <button v-if="isSearchResultFriend(user)" class="btn-sm" @click="openChat(user)">Message</button>
            <template v-else-if="hasRequestSent(user.id)">
              <button class="btn-sm" @click="openChat(user)">Message</button>
              <button
                class="btn-sm btn-danger"
                @click="cancelRequestAction(getRequestId(user.id), user.id)"
              >
                Cancel
              </button>
            </template>
            <button
              v-else-if="hasRequestReceived(user.id)"
              class="btn-sm btn-success"
              @click="acceptRequestAction(getRequestId(user.id))"
            >
              Accept
            </button>
            <button v-else class="btn-sm btn-accent" @click="sendRequestAction(user)">Add Friend</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <h3>Friends ({{ friends.length }})</h3>
          <span class="online-count">{{ onlineCount }} online</span>
        </div>
        
        <div v-if="filteredFriends.length === 0" class="empty">No friends found.</div>

        <div
          v-for="friend in filteredFriends"
          :key="friend.id"
          class="friend-card"
        >
          <div class="friend-info">
            <div class="friend-avatar" :style="getFriendAvatarStyle(friend)">
              <span v-if="!resolveFriendAvatar(friend)">{{ friendInitial(friend) }}</span>
            </div>
            <div class="friend-details">
              <span class="friend-name">{{ friend.username }}</span>
              <span class="friend-status" :class="{ online: friend.is_online }">
                {{ friend.is_online ? 'Online' : 'Offline' }}
              </span>
            </div>
          </div>
          <div class="friend-actions">
            <button class="btn-sm" @click="openChat(friend)">Chat</button>
            <button class="btn-sm" @click="openProfile(friend)">Profile</button>
            <button class="btn-sm btn-danger" @click="removeFriendAction(friend.id)">Remove</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <h3>Requests ({{ incomingRequests.length }})</h3>
        </div>
        <div v-if="incomingRequests.length === 0" class="empty">No requests.</div>

        <div
          v-for="request in incomingRequests"
          :key="request.id"
          class="request-card"
        >
          <div class="request-info">
            <strong>{{ request.requester?.username || 'Unknown' }}</strong>
          </div>
          <div class="request-actions">
            <button class="btn-sm btn-success" @click="acceptRequestAction(request.id)">Accept</button>
            <button class="btn-sm btn-danger" @click="rejectRequestAction(request.id)">Reject</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <h3>Outgoing ({{ outgoingRequests.length }})</h3>
        </div>
        <div v-if="outgoingRequests.length === 0" class="empty">No outgoing requests.</div>

        <div
          v-for="request in outgoingRequests"
          :key="request.id"
          class="request-card"
        >
          <div class="request-content">
            <div class="request-row">
              <strong>{{ request.addressee?.username || 'Unknown' }}</strong>
            </div>
          </div>
          <div class="request-actions">
            <button class="btn-sm" @click="openChat(request.addressee)">Message</button>
            <button class="btn-sm btn-danger" @click="cancelRequestAction(request.id)">Cancel</button>
          </div>
        </div>
      </article>
    </div>

  </section>
</template>

<script setup>
import { computed, onMounted, ref, toRef, watch } from 'vue'
import { getApiBase } from '../../auth/auth_api.js'
import { useFriends } from '../composables/useFriends'
import { useFriendRequests } from '../composables/useFriendRequests'
import { useFriendSearch } from '../composables/useFriendSearch'
import { fetchFriendsSummary } from '../services/friendsService'
import {
  findRequestIdForUser,
  hasIncomingRequestFromUser,
  hasOutgoingRequestForUser,
  isFriend
} from '../utils/friendState'
import { shouldRefreshFriendsPanel } from '../utils/socialRealtime'
import { formatLastSeen, formatRelativeTime } from '../utils/timeFormatter'

const props = defineProps({
  currentUserId: {
    type: Number,
    default: null
  },
  realtimeEvent: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['notify', 'open-chat', 'summary', 'view-profile'])

const {
  friends,
  loading: friendsLoading,
  error: friendsError,
  loadFriends,
  removeFriend,
  replaceFriends
} =
  useFriends()
const {
  requests,
  currentUserId: effectiveCurrentUserId,
  incomingRequests,
  outgoingRequests,
  loading: requestsLoading,
  error: requestsError,
  loadRequests,
  replaceRequests,
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest
} = useFriendRequests(toRef(props, 'currentUserId'))
const {
  query,
  results,
  showResults,
  searching,
  error: searchError,
  search,
  clear
} = useFriendSearch()

const filteredFriends = computed(() => friends.value)
const onlineCount = computed(() => friends.value.filter((friend) => friend?.is_online).length)
const canSearch = computed(() => query.value.trim().length >= 1)
const localOutgoingRequestIds = ref({})
const summaryError = ref('')

const commandCards = computed(() => [
  { label: 'Friends', value: friends.value.length },
  { label: 'Online', value: onlineCount.value },
  { label: 'Pending', value: incomingRequests.value.length }
])

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const setLocalOutgoingRequestId = (userId, requestId) => {
  const normalizedUserId = normalizeId(userId)
  if (normalizedUserId === null) return
  localOutgoingRequestIds.value = {
    ...localOutgoingRequestIds.value,
    [normalizedUserId]: requestId ?? true
  }
}

const clearLocalOutgoingRequestId = (userId) => {
  const normalizedUserId = normalizeId(userId)
  if (normalizedUserId === null) return
  const next = { ...localOutgoingRequestIds.value }
  delete next[normalizedUserId]
  localOutgoingRequestIds.value = next
}

const getLocalOutgoingRequestId = (userId) => {
  const normalizedUserId = normalizeId(userId)
  if (normalizedUserId === null) return null
  return localOutgoingRequestIds.value[normalizedUserId] ?? null
}

const resolvedCurrentUserId = computed(() => {
  return normalizeId(effectiveCurrentUserId.value)
})

const loading = computed(() => friendsLoading.value || requestsLoading.value || searching.value)
const globalError = computed(() => summaryError.value || friendsError.value || requestsError.value || searchError.value)

const cloneRequest = (request) => ({
  ...request,
  requester: request?.requester ? { ...request.requester } : request?.requester,
  addressee: request?.addressee ? { ...request.addressee } : request?.addressee
})

const snapshotFriends = () => friends.value.map((friend) => ({ ...friend }))
const snapshotRequests = () => requests.value.map(cloneRequest)

const queueRefreshAfterMutation = () => {
  void refreshAfterMutation().catch(() => {
    // Best effort background sync only.
  })
}

const removeFriendLocally = (friendId) => {
  const normalizedFriendId = normalizeId(friendId)
  replaceFriends(
    friends.value.filter((friend) => normalizeId(friend?.id) !== normalizedFriendId)
  )
}

const removeRequestLocally = (requestId) => {
  const normalizedRequestId = normalizeId(requestId)
  replaceRequests(
    requests.value.filter((request) => normalizeId(request?.id) !== normalizedRequestId)
  )
}

const upsertFriendLocally = (friend) => {
  const normalizedFriendId = normalizeId(friend?.id)
  if (normalizedFriendId === null) return

  replaceFriends([
    {
      ...friend,
      id: normalizedFriendId
    },
    ...friends.value.filter((item) => normalizeId(item?.id) !== normalizedFriendId)
  ])
}

const buildFriendFromRequest = (request) => {
  if (!request) return null

  const currentId = normalizeId(resolvedCurrentUserId.value)
  const requesterId = normalizeId(request?.requester_id)
  const addresseeId = normalizeId(request?.addressee_id)
  const source =
    currentId !== null && requesterId === currentId
      ? request?.addressee
      : request?.requester
  const fallbackId =
    currentId !== null && requesterId === currentId
      ? addresseeId
      : requesterId
  const friendId = normalizeId(source?.id ?? fallbackId)

  if (friendId === null) return null

  return {
    ...source,
    id: friendId,
    username: source?.username || 'Friend',
    avatar: source?.avatar || null,
    is_online: Boolean(source?.is_online),
    last_seen: source?.last_seen || null,
    evaluation_points: Number(source?.evaluation_points ?? source?.points ?? 0) || 0
  }
}

const loadAll = async () => {
  summaryError.value = ''
  try {
    const summary = await fetchFriendsSummary()
    friends.value = summary.friends
    requests.value = summary.requests
    friendsError.value = ''
    requestsError.value = ''
  } catch (err) {
    const message = String(err instanceof Error ? err.message : '')
    const shouldFallback = message.includes('(404)') || message.toLowerCase().includes('not found')
    if (shouldFallback) {
      await Promise.all([loadFriends(), loadRequests()])
      return
    }
    summaryError.value = err instanceof Error ? err.message : 'Unable to load social summary.'
    throw err
  }
}

const refreshAfterMutation = async () => {
  await loadAll()
  if (canSearch.value && showResults.value) {
    await search()
  }
}

const notifyError = (fallback) => (err) => {
  emit('notify', {
    type: 'error',
    title: 'Friends',
    message: err instanceof Error ? err.message : fallback
  })
}

const syncKnownFriendRequestState = async (err, userId = null) => {
  const message = String(err instanceof Error ? err.message : '').toLowerCase()
  const isExistingRequest = message.includes('friend request already exists')
  const isAlreadyFriend = message.includes('already friends')
  const isUnconfirmedRequest = message.includes('could not be confirmed')

  if (!isExistingRequest && !isAlreadyFriend && !isUnconfirmedRequest) {
    return false
  }

  try {
    await refreshAfterMutation()
  } catch {
    // Best effort sync only.
  }

  if (isExistingRequest || isUnconfirmedRequest) {
    setLocalOutgoingRequestId(userId, getRequestId(userId) ?? true)
  }

  if (isExistingRequest) {
    emit('notify', {
      type: 'friend_request_sent_self',
      title: userId ? String(results.value.find((item) => normalizeId(item?.id) === normalizeId(userId))?.username || 'Friend') : 'Friend',
      message: 'Friend request already pending.'
    })
    return true
  }

  if (isAlreadyFriend) {
    emit('notify', {
      type: 'info',
      title: 'Friends',
      message: 'You are already friends.'
    })
    return true
  }

  return false
}

const onSearchInput = async () => {
  if (!query.value.trim()) {
    clear()
    return
  }
  try {
    await search()
  } catch (err) {
    notifyError('Unable to search.')(err)
  }
}

const submitSearch = async () => {
  if (!canSearch.value) return
  try {
    await search()
  } catch (err) {
    notifyError('Unable to search.')(err)
  }
}

const sendRequestAction = async (user) => {
  const targetUserId = normalizeId(user?.id ?? user)
  if (targetUserId === null) return

  try {
    const created = await sendRequest(targetUserId, {
      addressee: user && typeof user === 'object' ? user : null
    })
    setLocalOutgoingRequestId(targetUserId, created?.id)
    emit('notify', {
      type: 'friend_request_sent_self',
      title: user?.username || 'Friend',
      message: `Friend request sent to ${user?.username || 'this player'}.`
    })
    try {
      await refreshAfterMutation()
    } catch {
      // The request is already created; keep the optimistic state visible.
    }
  } catch (err) {
    if (await syncKnownFriendRequestState(err, targetUserId)) {
      return
    }
    notifyError('Unable to send request.')(err)
  }
}

const acceptRequestAction = async (requestId) => {
  const request = incomingRequests.value.find((item) => item?.id === requestId) || null
  if (!request) return

  const friendsSnapshot = snapshotFriends()
  const requestsSnapshot = snapshotRequests()
  const requesterUsername = request?.requester?.username || 'Friend'

  try {
    const acceptedFriend = buildFriendFromRequest(request)
    removeRequestLocally(requestId)
    if (acceptedFriend) {
      upsertFriendLocally(acceptedFriend)
    }

    await acceptRequest(requestId, { refresh: false })
    queueRefreshAfterMutation()
    emit('notify', {
      type: 'friend_request_accepted_self',
      title: requesterUsername,
      message: `${requesterUsername} is now your friend.`
    })
  } catch (err) {
    replaceFriends(friendsSnapshot)
    replaceRequests(requestsSnapshot)
    notifyError('Unable to accept request.')(err)
  }
}

const rejectRequestAction = async (requestId) => {
  const request = incomingRequests.value.find((item) => item?.id === requestId) || null
  const requesterUsername = request?.requester?.username || 'Friend'
  try {
    await rejectRequest(requestId)
    await refreshAfterMutation()
    emit('notify', {
      type: 'friend_request_rejected_self',
      title: requesterUsername,
      message: `You rejected ${requesterUsername}'s friend request.`
    })
  } catch (err) {
    notifyError('Unable to reject request.')(err)
  }
}

const cancelRequestAction = async (requestId, userId = null) => {
  if (!requestId) return
  const request = requests.value.find((item) => item?.id === requestId) || null
  const normalizedUserId = normalizeId(userId)
  const searchMatch =
    normalizedUserId === null
      ? null
      : results.value.find((item) => normalizeId(item?.id) === normalizedUserId) || null
  const addresseeUsername =
    request?.addressee?.username ||
    request?.requester?.username ||
    searchMatch?.username ||
    'Friend'
  try {
    await cancelRequest(requestId)
    clearLocalOutgoingRequestId(userId)
    await refreshAfterMutation()
    emit('notify', {
      type: 'friend_request_cancelled_self',
      title: addresseeUsername,
      message: `Friend request to ${addresseeUsername} cancelled.`
    })
  } catch (err) {
    notifyError('Unable to cancel request.')(err)
  }
}

const removeFriendAction = async (friendId) => {
  if (!window.confirm('Remove this friend?')) return

  const friendsSnapshot = snapshotFriends()
  const targetFriend = friends.value.find((friend) => normalizeId(friend?.id) === normalizeId(friendId)) || null
  const friendUsername = targetFriend?.username || 'Friend'
  try {
    removeFriendLocally(friendId)
    await removeFriend(friendId, { refresh: false })
    queueRefreshAfterMutation()
    emit('notify', {
      type: 'friend_removed_self',
      title: friendUsername,
      message: `You removed ${friendUsername} from your friends.`
    })
  } catch (err) {
    replaceFriends(friendsSnapshot)
    notifyError('Unable to remove friend.')(err)
  }
}

const openChat = (user) => {
  emit('open-chat', {
    userId: user.userId || user.id,
    username: user.username,
    avatar: resolveFriendAvatar(user)
  })
}

const openProfile = (user) => {
  emit('view-profile', { userId: user.userId || user.id })
}

const openOwnProfile = () => {
  if (resolvedCurrentUserId.value) {
    emit('view-profile', { userId: resolvedCurrentUserId.value })
  }
}

const isUserFriend = (userId) => isFriend(friends.value, userId)
const isSearchResultFriend = (user) => Boolean(user?.is_friend) || isUserFriend(user?.id)
const hasRequestSent = (userId) =>
  hasOutgoingRequestForUser(requests.value, resolvedCurrentUserId.value, userId) ||
  Boolean(getLocalOutgoingRequestId(userId))
const hasRequestReceived = (userId) => hasIncomingRequestFromUser(requests.value, resolvedCurrentUserId.value, userId)
const getRequestId = (userId) =>
  findRequestIdForUser(requests.value, resolvedCurrentUserId.value, userId) ??
  getLocalOutgoingRequestId(userId)

const resolveSearchPoints = (user) =>
  Number(user?.evaluation_points ?? user?.points ?? 0) || 0

const resolveFriendAvatar = (friend) => {
  const raw = friend?.avatar || friend?.avatar_url || friend?.profile?.avatar_url
  if (!raw) return null
  if (String(raw).startsWith('http')) return raw
  return `${getApiBase()}${String(raw).startsWith('/') ? '' : '/'}${raw}`
}

const getFriendAvatarStyle = (friend) => {
  const avatar = resolveFriendAvatar(friend)
  return avatar ? { backgroundImage: `url("${avatar}")`, backgroundSize: 'cover' } : {}
}

const friendInitial = (friend) => String(friend?.username || '?').charAt(0).toUpperCase()

onMounted(loadAll)

watch(() => props.realtimeEvent?.id, async () => {
  if (shouldRefreshFriendsPanel(props.realtimeEvent?.payload)) {
    await loadAll()
  }
})
</script>

<style scoped>
.social-friends-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  overflow-y: auto;
}

.friends-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
}

.friends-header h2 { margin: 0; font-size: 18px; }
.friends-subtitle { margin: 4px 0 0; color: #888; font-size: 14px; }

.search-box { display: flex; gap: 12px; }
.search-form { display: flex; gap: 8px; }

.search-input {
  background: #000;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  width: 200px;
}

.btn-sm, .search-btn, .profile-btn {
  background: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-sm:hover, .search-btn:hover, .profile-btn:hover { background: #333; }
.btn-sm:active, .search-btn:active, .profile-btn:active,
.btn-sm:focus, .search-btn:focus, .profile-btn:focus {
  background: #444;
  color: #fff;
  outline: none;
}
.btn-accent {
  background: var(--social-accent);
  border-color: var(--social-accent);
  color: #0b0b0b;
  font-weight: 800;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
}

.btn-accent:hover {
  background: #ffffff;
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.55), 0 0 18px rgba(255, 255, 255, 0.14);
  transform: translateY(-1px);
}
.btn-success { background: #166534; border-color: #15803d; }
.btn-danger {
  background: rgba(153, 27, 27, 0.15);
  border: 1px solid #b91c1c;
  color: #ef4444;
}

.btn-danger:hover {
  background: #991b1b;
  color: #fff;
  box-shadow: 0 0 12px rgba(153, 27, 27, 0.4);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  background: #111;
  border: 1px solid #333;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.stat-label { font-size: 12px; color: #888; text-transform: uppercase; }
.stat-value { font-size: 24px; font-weight: 700; margin-top: 4px; }

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.panel-search-results {
  grid-column: 1 / -1;
}

.panel {
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #222;
  padding-bottom: 8px;
}

.panel-heading h3 { margin: 0; font-size: 15px; }
.online-count { font-size: 12px; color: #22c55e; }

.friend-card, .request-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #181818;
  border: 1px solid #222;
  border-radius: 8px;
}

.friend-info, .result-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.friend-avatar {
  width: 32px;
  height: 32px;
  background: #333;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.friend-details, .result-details {
  display: flex;
  flex-direction: column;
}

.friend-name { font-size: 14px; font-weight: 600; }
.friend-status { font-size: 11px; color: #888; }
.friend-status.online { color: #22c55e; }

.friend-actions, .request-actions, .result-actions {
  display: flex;
  gap: 4px;
}

.request-row {
  display: flex;
  align-items: center;
  gap: 12px; /* Fixed spacing for loginSent badge */
}

.badge {
  background: #333;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #aaa;
}

.search-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #181818;
  border-radius: 8px;
}

.loading, .empty { text-align: center; color: #888; padding: 20px; }

.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-heading h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.panel-chip {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--social-border-glass);
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

/* Cards (Friends, Requests, Search) */
.friend-card, .request-card, .search-result {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--social-border-glass);
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
}

.friend-card:hover, .request-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--social-border-strong);
}

.friend-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-wrapper {
  position: relative;
}

.friend-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #1e293b;
  border: 1px solid var(--social-border-glass);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.status-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 99px;
  background: #475569;
  border: 2px solid #0f172a;
}

.avatar-wrapper.online .status-indicator {
  background: #22c55e;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

.friend-details {
  display: grid;
  gap: 2px;
}

.friend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.friend-name {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
}

.points-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--social-accent);
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 6px;
}

.status-text {
  font-size: 11px;
  color: var(--social-muted);
}

.status-text.online {
  color: #22c55e;
}

.request-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.request-name {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
}

.request-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--social-muted);
}

.request-time {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--social-muted);
}

.action-btn:hover {
  background: var(--social-accent);
  border-color: var(--social-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--social-accent-glow);
}

.action-btn.delete:hover {
  background: #ef4444;
  border-color: #ef4444;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.action-btn.accept:hover {
  background: #10b981;
  border-color: #10b981;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 800px) {
  .friends-header {
    flex-direction: column;
  }
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
