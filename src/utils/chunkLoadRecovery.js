import { safeSessionStorage } from '@/utils/browserStorage.js'

const RELOAD_MARKER_KEY = 'leovue-chunk-reload-target'
const CHUNK_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .* failed/i

export const isChunkLoadError = (error) =>
  CHUNK_LOAD_ERROR_PATTERN.test(error?.message || String(error || ''))

/**
 * Reloads the current SPA route once when a deployment removes a chunk used by an old browser tab.
 */
export function installChunkLoadRecovery(
  router,
  storage = safeSessionStorage,
  location = window.location
) {
  router.onError((error, to) => {
    if (!isChunkLoadError(error)) return

    const target = to?.fullPath || `${location.pathname}${location.search}${location.hash}`
    if (storage.getItem(RELOAD_MARKER_KEY) === target) return

    storage.setItem(RELOAD_MARKER_KEY, target)
    location.assign(target)
  })

  router.afterEach(() => {
    storage.removeItem(RELOAD_MARKER_KEY)
  })
}
