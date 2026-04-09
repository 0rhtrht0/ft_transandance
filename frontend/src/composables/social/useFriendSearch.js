import { ref } from 'vue'
import { searchUsers } from '@/services/social/searchService'

export function useFriendSearch()
{
    const query = ref('')
    const results = ref([])
    const search = async () => {
        const normalized = query.value.trim()
        if (normalized.length < 2) {
            results.value = []
            return
        }
        results.value = await searchUsers(normalized)
    }
    const clear = () => {
        results.value = []
    }
    const hasResults = () => {
        return (results.value.length > 0)
    }
    const setQuery = (value) => {
        query.value = value
    }
    const reset = () => {
        query.value = ''
        clear()
    }
    return ({query, results, search, clear, hasResults, setQuery, reset})
}
