import { computed, ref, watch } from 'vue'
import { listAvailableAiModelsApi } from '@/services/api/platform-ai.js'
import { chatReasoningOptions } from '@/utils/aiReasoning.js'

/**
 * AI 通道选择器 composable。
 *
 * 拉取后端配置的所有 AI 通道，维护当前选中的 configId。
 * 若有激活通道（isActive=1），自动设为默认选中。
 *
 * 默认 API: {@link listAvailableAiModelsApi}（GET /platform/ai/models）。
 * 该接口只返回聊天所需的脱敏模型目录。
 *
 * 用法：
 * ```js
 * const { configs, selectedConfigId, fetchConfigs } = useAiChannelSelector()
 * await fetchConfigs()
 * // 新建会话时：
 * platformAiThreadCreateApi({ configId: selectedConfigId.value ?? undefined })
 * ```
 */
export function useAiChannelSelector({ loadConfigs = listAvailableAiModelsApi } = {}) {
  /** 所有通道列表：[{ id, name, protocol, model, isActive }] */
  const configs = ref([])
  /** 当前选中的通道 ID；null 表示使用激活通道 */
  const selectedConfigId = ref(null)
  const selectedConfig = computed(() => selectedConfigId.value == null
    ? configs.value.find(config => config.isActive === 1)
    : configs.value.find(config => config.id === selectedConfigId.value))
  const effortOptions = computed(() => chatReasoningOptions(selectedConfig.value))
  const requestedEffort = ref('auto')
  const acceptsEffort = value => effortOptions.value.some(option => option.value === value)
  const reasoningEffort = computed({
    get: () => acceptsEffort(requestedEffort.value) ? requestedEffort.value : 'auto',
    set: value => { requestedEffort.value = acceptsEffort(value) ? value : 'auto' }
  })
  // Discard an incompatible selection, including changes delivered by catalog refresh.
  watch(effortOptions, () => {
    if (!acceptsEffort(requestedEffort.value)) requestedEffort.value = 'auto'
  }, { flush: 'sync' })

  const fetchConfigs = async () => {
    try {
      const res = await loadConfigs()
      const list = res?.data ?? []
      configs.value = list.filter((item) => item.enabled !== 0)
      // 默认选中激活通道
      if (selectedConfigId.value == null) {
        const active = configs.value.find((c) => c.isActive === 1)
        selectedConfigId.value = active?.id ?? null
      }
    } catch (err) {
      // 维持当前状态，但记录原因，避免静默失败让上层"永远拿到空数组"难以排查
      // eslint-disable-next-line no-console
      console.warn('[useAiChannelSelector] 加载 AI 通道失败：', err?.message || err)
    }
  }

  return {
    configs,
    selectedConfigId,
    reasoningEffort,
    fetchConfigs
  }
}
