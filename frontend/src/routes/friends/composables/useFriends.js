import { ref } from 'vue'
import { fetchFriends, removeFriendById } from '../services/friendsService'
import { filterFriendsByQuery } from '../utils/friendState'

export function useFriends() {
  const friends = ref([])
  const loading = ref(false)
  const error = ref('')

  const normalizeFriend = (friend) => ({
    ...friend,
    id: Number(friend?.id) || friend?.id
  })

  const replaceFriends = (items) => {
    friends.value = Array.isArray(items) ? items.map(normalizeFriend) : []
  }

  const loadFriends = async () => {
    loading.value = true
    error.value = ''
    try {
      replaceFriends(await fetchFriends())
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load friends.'
      throw err
    } finally {
      loading.value = false
    }
  }

  const removeFriend = async (friendId, options = {}) => {
    await removeFriendById(friendId)
    if (options?.refresh !== false) {
      await loadFriends()
    }
  }

  const getFilteredFriends = (query) => filterFriendsByQuery(friends.value, query)

  return {
    friends,
    loading,
    error,
    loadFriends,
    removeFriend,
    replaceFriends,
    getFilteredFriends
  }
}
