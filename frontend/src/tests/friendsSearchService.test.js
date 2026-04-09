import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestJsonMock = vi.hoisted(() => vi.fn())

vi.mock('../routes/friends/services/httpClient.js', () => ({
  requestJson: requestJsonMock
}))

import { searchUsers } from '../routes/friends/services/searchService.js'

describe('friends searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches with a single character query', async () => {
    requestJsonMock.mockResolvedValue({
      users: [{ id: 9, username: 'nova' }]
    })

    const result = await searchUsers('n')

    expect(requestJsonMock).toHaveBeenCalledWith('/api/users/search?q=n&limit=20')
    expect(result).toEqual([
      expect.objectContaining({ id: 9, username: 'nova' })
    ])
  })
})
