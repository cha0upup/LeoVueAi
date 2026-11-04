import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { previewAiModelRequestApi } from '@/services/api/admin.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'

/** Debounced local planning with stale-response, dialog-close and unmount guards. */
export function useAiModelRequestPreview({ visible, form, debounceMs = 250 }) {
  const preview = shallowRef(null)
  const loading = ref(false)
  const error = ref('')
  const guard = createLatestRequestGuard(['preview'])
  let timer = null
  let controller = null
  let disposed = false

  const draft = () => ({
    providerId: form.providerId,
    model: form.model,
    thinkingEnabled: form.thinkingEnabled,
    reasoningEffort: form.reasoningEffort,
    temperature: form.temperature,
    maxOutputTokens: form.maxOutputTokens,
    contextWindowTokens: form.contextWindowTokens
  })
  const key = () => JSON.stringify(draft())
  const ready = () => !disposed && visible.value && form.providerId != null && String(form.model || '').trim()

  function cancel() {
    clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
    guard.invalidate()
    loading.value = false
  }

  async function refresh(force = false) {
    clearTimeout(timer)
    timer = null
    if (!ready()) return null
    const requestKey = key()
    if (!force && preview.value) return preview.value
    controller?.abort()
    const sequence = guard.next('preview')
    const requestController = new AbortController()
    controller = requestController
    loading.value = true
    error.value = ''
    try {
      const response = await previewAiModelRequestApi(draft(), { signal: requestController.signal })
      if (!guard.isCurrent('preview', sequence) || !ready() || requestKey !== key()) return null
      preview.value = response.data
      return preview.value
    } catch (failure) {
      if (guard.isCurrent('preview', sequence) && !requestController.signal.aborted) {
        preview.value = null
        error.value = failure?.message || '参数预览失败，请重试'
      }
      return null
    } finally {
      if (guard.isCurrent('preview', sequence)) {
        loading.value = false
        controller = null
      }
    }
  }

  watch(() => [visible.value, key()], () => {
    cancel()
    preview.value = null
    error.value = ''
    if (!ready()) return
    loading.value = true
    timer = setTimeout(() => { refresh() }, debounceMs)
  }, { immediate: true, flush: 'sync' })

  onScopeDispose(() => { disposed = true; cancel() })
  return { preview, loading, error, refresh }
}
