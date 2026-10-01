import { ref } from 'vue'

function parseEventPayload(event) {
  if (!event || typeof event.data !== 'string') return null
  try {
    return JSON.parse(event.data)
  } catch {
    return null
  }
}

export function useEventLogFollow({ createSource, onAppend, onMeta, onError } = {}) {
  if (typeof createSource !== 'function') {
    throw new TypeError('createSource must be a function')
  }

  const isFollowing = ref(false)
  let source = null
  let generation = 0

  function stop() {
    generation += 1
    const activeSource = source
    source = null
    isFollowing.value = false
    if (!activeSource || typeof activeSource.close !== 'function') return
    try {
      activeSource.close()
    } catch {
      // Closing is best-effort because transports may already be disconnected.
    }
  }

  function start(params) {
    stop()
    const currentGeneration = ++generation
    try {
      const nextSource = createSource(params)
      source = nextSource
      if (!nextSource || typeof nextSource.addEventListener !== 'function') {
        throw new TypeError('createSource must return an event source')
      }
      nextSource.addEventListener('append', event => {
        if (currentGeneration !== generation) return
        const payload = parseEventPayload(event)
        if (!Array.isArray(payload?.entries) || payload.entries.length === 0) return
        onAppend?.(payload.entries, payload)
      })
      nextSource.addEventListener('meta', event => {
        if (currentGeneration !== generation) return
        const payload = parseEventPayload(event)
        if (payload) onMeta?.(payload)
      })
      nextSource.addEventListener('error', event => {
        if (currentGeneration !== generation) return
        try {
          onError?.(event)
        } finally {
          stop()
        }
      })
      isFollowing.value = true
      return nextSource
    } catch (error) {
      stop()
      throw error
    }
  }

  return { isFollowing, start, stop }
}
