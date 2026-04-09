import { computed, ref } from 'vue'
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchPendingRequests,
  rejectFriendRequest,
  sendFriendRequest
} from '../services/requestsService'
import {
  getIncomingRequests,
  getOutgoingRequests
} from '../utils/friendState'

export function useFriendRequests(currentUserIdRef) {
  const requests = ref([])
  const optimisticRequests = ref([])
  const loading = ref(false)
  const error = ref('')
  const fallbackCurrentUserId = ref(null)

  const normalizeId = (value) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const normalizeRequest = (request) => ({
    ...request,
    id: Number(request?.id) || request?.id,
    requester_id: Number(request?.requester_id) || request?.requester_id,
    addressee_id: Number(request?.addressee_id) || request?.addressee_id,
    status: request?.status || 'pending'
  })

  const replaceRequests = (items) => {
    requests.value = Array.isArray(items) ? items.map(normalizeRequest) : []
  }

  const upsertRequest = (list, request) => {
    const normalized = normalizeRequest(request)
    const next = Array.isArray(list) ? list.filter((item) => item?.id !== normalized.id) : []
    return [normalized, ...next]
  }

  const rememberOptimisticRequest = (request) => {
    optimisticRequests.value = upsertRequest(optimisticRequests.value, request)
    requests.value = upsertRequest(requests.value, request)
  }

  const forgetOptimisticRequest = (requestId) => {
    optimisticRequests.value = optimisticRequests.value.filter((request) => request?.id !== requestId)
  }

  const readStoredUserId = () => {
    const raw = localStorage.getItem('userId')
    if (raw === null || raw === '') return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const currentUserId = computed(() => {
    const fromRef = normalizeId(currentUserIdRef?.value)
    if (fromRef !== null) return fromRef
    const fromStorage = readStoredUserId()
    if (Number.isFinite(fromStorage)) return fromStorage
    return normalizeId(fallbackCurrentUserId.value)
  })

  const incomingRequests = computed(() =>
    getIncomingRequests(requests.value, currentUserId.value)
  )

  const outgoingRequests = computed(() =>
    getOutgoingRequests(requests.value, currentUserId.value)
  )

  const loadRequests = async () => {
    loading.value = true
    error.value = ''
    try {
      const fetchedRequests = await fetchPendingRequests()
      const fetchedIds = new Set(fetchedRequests.map((request) => request?.id))

      optimisticRequests.value = optimisticRequests.value.filter(
        (request) => !fetchedIds.has(request?.id)
      )

      replaceRequests([
        ...optimisticRequests.value,
        ...fetchedRequests
      ])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load friend requests.'
      throw err
    } finally {
      loading.value = false
    }
  }

  const sendRequest = async (userId, optimisticData = {}) => {
    const created = normalizeRequest({
      ...optimisticData,
      ...(await sendFriendRequest(userId)),
      addressee: optimisticData?.addressee,
      requester: optimisticData?.requester
    })
    if (Number.isFinite(created.requester_id)) {
      fallbackCurrentUserId.value = created.requester_id
    }
    rememberOptimisticRequest(created)

    try {
      await loadRequests()
    } catch {
      // Keep optimistic state when the refresh request fails after a successful creation.
    }

    return created
  }

  const acceptRequest = async (requestId, options = {}) => {
    forgetOptimisticRequest(requestId)
    await acceptFriendRequest(requestId)
    if (options?.refresh !== false) {
      await loadRequests()
    }
  }

  const rejectRequest = async (requestId, options = {}) => {
    forgetOptimisticRequest(requestId)
    await rejectFriendRequest(requestId)
    if (options?.refresh !== false) {
      await loadRequests()
    }
  }

  const cancelRequest = async (requestId, options = {}) => {
    forgetOptimisticRequest(requestId)
    await cancelFriendRequest(requestId)
    if (options?.refresh !== false) {
      await loadRequests()
    }
  }

  return {
    requests,
    currentUserId,
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    loadRequests,
    replaceRequests,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest
  }
}
