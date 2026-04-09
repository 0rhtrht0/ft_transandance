const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const getIncomingRequests = (requests, currentUserId) => {
  const userId = normalizeId(currentUserId)
  if (userId === null) return []
  return requests.filter((request) => normalizeId(request.addressee_id) === userId)
}

export const getOutgoingRequests = (requests, currentUserId) => {
  const userId = normalizeId(currentUserId)
  if (userId === null) return []
  return requests.filter((request) => normalizeId(request.requester_id) === userId)
}

export const isFriend = (friends, userId) =>
  friends.some((friend) => normalizeId(friend.id) === normalizeId(userId))

export const hasOutgoingRequestForUser = (requests, currentUserId, userId) =>
  getOutgoingRequests(requests, currentUserId).some(
    (request) => normalizeId(request.addressee_id) === normalizeId(userId)
  )

export const hasIncomingRequestFromUser = (requests, currentUserId, userId) =>
  getIncomingRequests(requests, currentUserId).some(
    (request) => normalizeId(request.requester_id) === normalizeId(userId)
  )

export const findRequestIdForUser = (requests, currentUserId, targetUserId) => {
  const currentId = normalizeId(currentUserId)
  const targetId = normalizeId(targetUserId)
  if (currentId === null || targetId === null) return null

  const request = requests.find((item) => {
    const requesterId = normalizeId(item.requester_id)
    const addresseeId = normalizeId(item.addressee_id)
    return (
      (requesterId === currentId && addresseeId === targetId) ||
      (requesterId === targetId && addresseeId === currentId)
    )
  })
  return request?.id ?? null
}

export const filterFriendsByQuery = (friends, query) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return friends
  return friends.filter((friend) =>
    (friend.username || '').toLowerCase().includes(normalized)
  )
}
