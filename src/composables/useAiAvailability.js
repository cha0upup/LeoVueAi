import { computed, ref } from 'vue'

import { platformAiAvailabilityApi } from '@/services/api/platform-ai.js'
import { isCurrentSession, registerSessionCleanup, sessionGeneration } from '@/services/sessionLifecycle.js'

/** Session-scoped AI availability shared by the dock and entry panel. */
// ── 模块级单例状态 ────────────────────────────────────────────────────────────
const aiAvailable = ref(false)
const loading = ref(false)
const fetched = ref(false)
let inflight = null

const unregister = registerSessionCleanup('ai-availability', () => {
  aiAvailable.value = false
  loading.value = false
  fetched.value = false
  inflight = null
})
if (import.meta.hot) import.meta.hot.dispose(unregister)

const fetchAvailability = async () => {
  if (inflight) return inflight
  loading.value = true
  const requestGeneration = sessionGeneration.value
  inflight = (async () => {
    try {
      const res = await platformAiAvailabilityApi()
      if (!isCurrentSession(requestGeneration)) return
      const data = res?.data ?? {}
      aiAvailable.value = data.available === true
      fetched.value = true
    } catch (err) {
      if (!isCurrentSession(requestGeneration)) return
      // 维持上一次状态，避免临时 API 失败导致入口被永久禁用；记录原因方便排查。
      // eslint-disable-next-line no-console
      console.warn('[useAiAvailability] 加载 AI 可用性失败：', err?.message || err)
    } finally {
      if (isCurrentSession(requestGeneration)) {
        loading.value = false
        inflight = null
      }
    }
  })()
  return inflight
}

// ── composable ────────────────────────────────────────────────────────────────
export function useAiAvailability({ autoFetch = true } = {}) {
  /** AI 是否可用：至少存在一个已配置的模型通道 */
  const available = computed(() => aiAvailable.value)

  /** 不可用时的解释文案（用于 tooltip / 提示） */
  const unavailableReason = computed(() => {
    if (!fetched.value && loading.value) return '正在检测 AI 模型配置…'
    if (!aiAvailable.value) return '尚未配置 AI 模型，无法使用 AI 助理'
    return ''
  })

  if (autoFetch && !fetched.value && !loading.value) {
    fetchAvailability()
  }

  return {
    available,
    loading,
    unavailableReason,
    refresh: fetchAvailability
  }
}
