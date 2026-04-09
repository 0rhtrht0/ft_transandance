import { ref } from 'vue'
import {
  fetchFriends,
  deleteFriend
} from '@/services/social/friendsService'

export function useFriends() {
  const friends = ref([])

  const loadFriends = async () => {
    friends.value = await fetchFriends()
  }

  const removeFriend = async (id) => {
    await deleteFriend(id)
    await loadFriends()
  }

  const isFriend = (id) => friends.value.some((friend) => friend.id === id)

  const countFriends = () => friends.value.length

  return {
    friends,
    loadFriends,
    removeFriend,
    isFriend,
    countFriends
  }
}
