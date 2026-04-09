import { requestJson } from './httpClient'

export const searchUsers = async (query) => {
  const normalized = query.trim()
  if (normalized.length < 1) return []

  const data = await requestJson(
    `/api/users/search?q=${encodeURIComponent(normalized)}&limit=20`
  )
  const rows = Array.isArray(data?.users) ? data.users : []
  return rows.map((user) => ({
    ...user,
    id: Number(user?.id) || user?.id
  }))
}
