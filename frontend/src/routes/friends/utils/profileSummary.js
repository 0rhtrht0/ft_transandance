const PROFILE_RANKS = [
  { minPoints: 0, label: 'Newcomer' },
  { minPoints: 3, label: 'Scout' },
  { minPoints: 6, label: 'Runner' },
  { minPoints: 10, label: 'Navigator' },
  { minPoints: 15, label: 'Blackhole Elite' }
]

export const normalizeProfilePoints = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export const resolveProfileRank = (points) => {
  const normalizedPoints = normalizeProfilePoints(points)
  let rank = PROFILE_RANKS[0].label

  for (const entry of PROFILE_RANKS) {
    if (normalizedPoints >= entry.minPoints) {
      rank = entry.label
    }
  }

  return rank
}

export const buildProfileHighlights = (profile) => {
  const stats = profile?.stats || {}

  return [
    {
      label: 'Evaluation points',
      value: normalizeProfilePoints(stats.evaluation_points ?? stats.points)
    },
    {
      label: 'Wallet transactions',
      value: Number(stats.wallet_transactions) || 0
    },
    {
      label: 'Record',
      value: `${Number(stats.wins) || 0}W / ${Number(stats.losses) || 0}L`
    },
    {
      label: 'Friends',
      value: Number(stats.friends_count) || 0
    }
  ]
}
