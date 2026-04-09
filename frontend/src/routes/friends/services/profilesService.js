import { requestJson } from './httpClient'

export const fetchPublicProfile = async (userId) => {
  const resolvedId = Number(userId)
  if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
    throw new Error('Invalid profile id.')
  }

  return requestJson(`/users/profiles/${encodeURIComponent(resolvedId)}`)
}
