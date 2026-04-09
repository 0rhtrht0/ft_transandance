import { ref } from 'vue'
import { searchUsers } from '../services/searchService'

export function useFriendSearch() {
  const MIN_QUERY_LENGTH = 1
  const query = ref('')
  const results = ref([])
  const showResults = ref(false)
  const searching = ref(false)
  const error = ref('')
  let activeSearchId = 0

  const search = async (nextQuery = query.value) => {
    const normalized = String(nextQuery || '').trim()
    const searchId = ++activeSearchId

    if (normalized.length < MIN_QUERY_LENGTH) {
      results.value = []
      showResults.value = false
      return []
    }

    searching.value = true
    error.value = ''

    try {
      const nextResults = await searchUsers(normalized)
      if (searchId !== activeSearchId) {
        return results.value
      }
      results.value = nextResults
      showResults.value = true
      return nextResults
    } catch (err) {
      if (searchId === activeSearchId) {
        error.value = err instanceof Error ? err.message : 'Unable to search right now.'
        results.value = []
        showResults.value = false
      }
      throw err
    } finally {
      if (searchId === activeSearchId) {
        searching.value = false
      }
    }
  }

  const clear = () => {
    activeSearchId += 1
    query.value = ''
    results.value = []
    showResults.value = false
    error.value = ''
    searching.value = false
  }

  return {
    query,
    results,
    showResults,
    searching,
    error,
    search,
    clear
  }
}
