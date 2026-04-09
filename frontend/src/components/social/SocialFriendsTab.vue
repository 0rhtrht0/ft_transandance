<template>
  <section class="social-tab">
    <header class="section-header">
      <h2>Friends</h2>
      <p>{{ friends.length }} total</p>
    </header>

    <div class="search">
      <input
        v-model="query"
        type="text"
        placeholder="Search users..."
        @input="onSearchInput"
      />
    </div>

    <div v-if="results.length > 0" class="search-results">
      <h3>Search results</h3>
      <div v-for="user in results" :key="user.id" class="row">
        <span>{{ user.username }}</span>
        <button
          v-if="isFriend(user.id)"
          type="button"
          disabled
        >
          Already friend
        </button>
        <button
          v-else-if="hasOutgoingRequest(user.id)"
          type="button"
          @click="cancelOutgoingRequest(outgoingRequestId(user.id))"
        >
          Cancel request
        </button>
        <button
          v-else
          type="button"
          @click="sendRequest(user.id)"
        >
          Add friend
        </button>
      </div>
    </div>

    <div class="friends-list">
      <h3>Your friends</h3>
      <div v-if="friends.length === 0" class="empty">No friends yet.</div>
      <div v-for="friend in friends" :key="friend.id" class="row">
        <span>{{ friend.username }}</span>
        <button type="button" @click="removeFriend(friend.id)">Remove</button>
      </div>
    </div>

    <div class="requests-list">
      <h3>Incoming requests</h3>
      <div v-if="incomingRequests.length === 0" class="empty">No pending requests.</div>
      <div v-for="request in incomingRequests" :key="request.id" class="row">
        <span>{{ request.requester?.username || 'Unknown user' }}</span>
        <div class="actions">
          <button type="button" @click="acceptRequest(request.id)">Accept</button>
          <button type="button" @click="rejectRequest(request.id)">Reject</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from 'vue'
import { useFriends } from '@/composables/social/useFriends'
import { useFriendRequests } from '@/composables/social/useFriendRequests'
import { useFriendSearch } from '@/composables/social/useFriendSearch'
import {
  cancelFriendRequest,
  sendFriendRequest
} from '@/services/social/requestsService'

const { friends, loadFriends, removeFriend, isFriend } = useFriends()
const {
  loadRequests,
  accept,
  reject,
  incomingRequests,
  outgoingRequests
} = useFriendRequests()
const {
  query,
  results,
  search,
  clear
} = useFriendSearch()

const hasOutgoingRequest = (userId) =>
  outgoingRequests.value.some((request) => request.addressee_id === userId)

const outgoingRequestId = (userId) =>
  outgoingRequests.value.find((request) => request.addressee_id === userId)?.id

const onSearchInput = async () => {
  if (query.value.trim().length < 2) {
    clear()
    return
  }
  await search()
}

const sendRequest = async (userId) => {
  await sendFriendRequest(userId)
  await loadRequests()
  await search()
}

const cancelOutgoingRequest = async (requestId) => {
  if (!requestId) return
  await cancelFriendRequest(requestId)
  await loadRequests()
  await search()
}

const acceptRequest = async (requestId) => {
  await accept(requestId)
  await loadFriends()
}

const rejectRequest = async (requestId) => {
  await reject(requestId)
}

onMounted(async () => {
  await Promise.all([loadFriends(), loadRequests()])
})
</script>

<style scoped>
.social-tab {
  display: grid;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.search input {
  width: 100%;
  padding: 10px;
}

.search-results,
.friends-list,
.requests-list {
  display: grid;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.actions {
  display: flex;
  gap: 8px;
}

.empty {
  color: #777;
}
</style>
