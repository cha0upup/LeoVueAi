import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'

import { useAppModeNavigation } from '@/composables/useAppModeNavigation.js'
import { useAuth } from '@/composables/useAuth.js'
import { platformAiAvailabilityApi } from '@/services/api/platform-ai.js'

/**
 * AI 可用性检测（模块级单例）。
 *
 * 用途：
 *   - 检查后端是否已配置至少一个 AI 模型通道，决定"AI 助理"入口是否可用。
 *   - 未配置时给出引导提示（管理员可一键跳转到配置页，普通用户提示联系管理员）。
 *
 * 设计要点：
 *   - 状态用模块级单例缓存，多个组件共享同一份 availability，避免重复请求。
 *   - 首次调用 fetch()（或开启 autoFetch）后会拉一次；调用 refresh() 可手动刷新
 *     （例如用户从管理后台配置完返回主工作台后）。
 *   - available 用计算属性派生，不需要手动维护。
 *
 * 使用示例：
 * ```js
 * const { available, ensureConfigured, refresh } = useAiAvailability()
 *
 * const onAiBtnClick = async () => {
 *   if (!(await ensureConfigured())) return
 *   openAiAssistant()
 * }
 * ```
 */

// ── 模块级单例状态 ────────────────────────────────────────────────────────────
const availabilityState = ref({
  available: false,
  enabledCount: 0
})
const loading = ref(false)
const fetched = ref(false)
let inflight = null

const fetchAvailability = async () => {
  if (inflight) return inflight
  loading.value = true
  inflight = (async () => {
    try {
      const res = await platformAiAvailabilityApi()
      const data = res?.data ?? {}
      availabilityState.value = {
        available: !!data.available,
        enabledCount: Number(data.enabledCount || 0)
      }
      fetched.value = true
    } catch (err) {
      // 维持上一次状态，避免临时 API 失败导致入口被永久禁用；记录原因方便排查。
      // eslint-disable-next-line no-console
      console.warn('[useAiAvailability] 加载 AI 可用性失败：', err?.message || err)
    } finally {
      loading.value = false
      inflight = null
    }
  })()
  return inflight
}

// ── composable ────────────────────────────────────────────────────────────────
export function useAiAvailability({ autoFetch = true } = {}) {
  const { goToAdmin } = useAppModeNavigation()
  const { isAdmin } = useAuth()

  /** AI 是否可用：至少存在一个已配置的模型通道 */
  const available = computed(() => availabilityState.value.available)

  /** 不可用时的解释文案（用于 tooltip / 提示） */
  const unavailableReason = computed(() => {
    if (!fetched.value && loading.value) return '正在检测 AI 模型配置…'
    if (!availabilityState.value.available) return '尚未配置 AI 模型，无法使用 AI 助理'
    return ''
  })

  /**
   * 拦截式可用性确保器：
   *   - 可用 → 返回 true，调用方继续。
   *   - 不可用 → 弹确认框（管理员可跳转配置页，普通用户仅提示），返回 false。
   *
   * @returns {Promise<boolean>}
   */
  const ensureConfigured = async () => {
    // 还没拉过，先确保已拉取
    if (!fetched.value && !loading.value) {
      await fetchAvailability()
    } else if (loading.value && inflight) {
      await inflight
    }

    if (available.value) return true

    try {
      await ElMessageBox.confirm(
        isAdmin.value
          ? '系统尚未配置任何 AI 模型通道，需要先在「系统配置」中添加可用的模型才能使用 AI 助理。'
          : '系统尚未配置任何 AI 模型通道，请联系管理员在「系统配置」中添加可用的模型后再使用。',
        '无可用 AI 模型',
        {
          confirmButtonText: isAdmin.value ? '前往配置' : '知道了',
          cancelButtonText: '取消',
          showCancelButton: isAdmin.value,
          type: 'warning',
          closeOnClickModal: false,
          closeOnPressEscape: true
        }
      )
      if (isAdmin.value) {
        goToAdmin({ tab: 'system' })
      }
    } catch {
      // 用户取消，静默
    }
    return false
  }

  if (autoFetch && !fetched.value && !loading.value) {
    fetchAvailability()
  }

  return {
    availabilityState,
    available,
    loading,
    unavailableReason,
    refresh: fetchAvailability,
    ensureConfigured
  }
}
