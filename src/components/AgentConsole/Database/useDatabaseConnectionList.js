import { onScopeDispose, ref, watch } from 'vue'
import { getDatabaseConnectionsApi } from '@/services/api/agent-manage.js'

export function useDatabaseConnectionList(sessionId) {
  const savedConfigs = ref([])
  const savedLoading = ref(true)
  const loadFailed = ref(false)
  let activeRequest = null
  let disposed = false

  const abortActiveRequest = () => {
    const previous = activeRequest
    activeRequest = null
    previous?.abort()
  }

  const loadSavedConfigs = async ({ silent = false } = {}) => {
    if (disposed) return
    const session = sessionId.value
    // A refresh can follow a mutation, so it must not reuse a request started before that mutation.
    abortActiveRequest()
    if (!session) {
      loadFailed.value = true
      savedLoading.value = false
      return
    }

    const request = new AbortController()
    activeRequest = request
    if (!silent) savedLoading.value = true
    loadFailed.value = false
    try {
      const { data } = await getDatabaseConnectionsApi({ sessionId: session }, { signal: request.signal })
      if (activeRequest === request) savedConfigs.value = data || []
    } catch {
      if (activeRequest === request) loadFailed.value = true
    } finally {
      if (activeRequest === request) {
        activeRequest = null
        savedLoading.value = false
      }
    }
  }

  watch(sessionId, () => {
    savedConfigs.value = []
    void loadSavedConfigs()
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    abortActiveRequest()
  })

  return { savedConfigs, savedLoading, loadFailed, loadSavedConfigs }
}
