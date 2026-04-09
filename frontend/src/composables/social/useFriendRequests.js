import { computed, ref } from 'vue'
import {
  fetchRequests,
  acceptFriendRequest,
  rejectFriendRequest
} from '@/services/social/requestsService'

export function useFriendRequests() {
  const requests = ref([])

  const currentUserId = computed(() => {
    const stored = localStorage.getItem('userId')
    if (stored === null || stored === '') return null
    const raw = Number(stored)
    return Number.isFinite(raw) ? raw : null
  })

  const loadRequests = async () => {
    requests.value = await fetchRequests()
  }

  const accept = async (id) => {
    await acceptFriendRequest(id)
    await loadRequests()
  }

  const reject = async (id) => {
    await rejectFriendRequest(id)
    await loadRequests()
  }

  const incomingRequests = computed(() =>
    requests.value.filter((request) => request.addressee_id === currentUserId.value)
  )

  const outgoingRequests = computed(() =>
    requests.value.filter((request) => request.requester_id === currentUserId.value)
  )

  return {
    requests,
    loadRequests,
    accept,
    reject,
    incomingRequests,
    outgoingRequests
  }
}
