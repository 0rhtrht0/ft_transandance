const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const toDate = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatRelativeTime = (value) => {
  const date = toDate(value)
  if (!date) return 'Never'

  const now = Date.now()
  const diff = now - date.getTime()

  if (diff < MINUTE) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`

  return date.toLocaleDateString()
}

export const formatLastSeen = (value) => {
  const date = toDate(value)
  if (!date) return 'Never'
  return formatRelativeTime(date)
}

export const formatDateTime = (value) => {
  const date = toDate(value)
  if (!date) return ''
  return date.toLocaleString()
}
