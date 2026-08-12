import { ref } from 'vue'
import { listAvailableAiModelsApi } from '@/services/api/platform-ai.js'

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
 * platformAiCreateAgent({ configId: selectedConfigId.value || undefined })
 * ```
 */
export function useAiChannelSelector({ loadConfigs = listAvailableAiModelsApi } = {}) {
  /** 所有通道列表：[{ id, name, protocol, model, isActive }] */
  const configs = ref([])
  /** 当前选中的通道 ID；null 表示使用激活通道 */
  const selectedConfigId = ref(null)
  const configsLoading = ref(false)

  const fetchConfigs = async () => {
    configsLoading.value = true
    try {
      const res = await loadConfigs()
      const list = res?.data ?? []
      configs.value = list.filter((item) => item.enabled !== 0).map((item) => ({
        ...item,
        protocol: item.protocol || 'openai'
      }))
      // 默认选中激活通道
      if (selectedConfigId.value == null) {
        const active = configs.value.find((c) => c.isActive === 1)
        selectedConfigId.value = active?.id ?? null
      }
    } catch (err) {
      // 维持当前状态，但记录原因，避免静默失败让上层"永远拿到空数组"难以排查
      // eslint-disable-next-line no-console
      console.warn('[useAiChannelSelector] 加载 AI 通道失败：', err?.message || err)
    } finally {
      configsLoading.value = false
    }
  }

  return {
    configs,
    selectedConfigId,
    configsLoading,
    fetchConfigs
  }
}
