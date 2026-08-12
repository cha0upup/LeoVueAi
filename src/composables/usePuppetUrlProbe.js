import { ref } from 'vue'
import { probeUrlPathsApi } from '@/services/api.js'
import { showError, showInfo, showSuccess, showWarning } from '@/utils/messageUtils.js'

export function usePuppetUrlProbe(options) {
  const {
    getBaseUrl,
    mergePaths,
    probeApi = probeUrlPathsApi,
    messages = {
      error: showError,
      info: showInfo,
      success: showSuccess,
      warning: showWarning
    }
  } = options
  const probing = ref(false)
  let requestSequence = 0

  const cancelProbe = () => {
    requestSequence += 1
    probing.value = false
  }

  const probePaths = async () => {
    const baseUrl = String(getBaseUrl?.() || '').trim()
    if (!baseUrl) {
      messages.warning('请先填写连接地址')
      return false
    }
    if (probing.value) return false

    const requestId = ++requestSequence
    probing.value = true
    try {
      const response = await probeApi({ baseUrl })
      if (requestId !== requestSequence) return false

      const data = response?.data
      if (!data?.success) {
        messages.error('探测失败')
        return false
      }

      const paths = Array.isArray(data.paths) ? data.paths : []
      if (!paths.length) {
        messages.info('未发现有效路径，请手动填写')
        return true
      }

      mergePaths(paths)
      const sources = Array.isArray(data.sources) ? data.sources.filter(Boolean) : []
      const sourceText = sources.length ? `（来源：${sources.join('、')}）` : ''
      messages.success(`探测完成，发现 ${paths.length} 个路径${sourceText}`)
      return true
    } catch (error) {
      if (requestId !== requestSequence) return false
      messages.error(`探测请求异常: ${error?.message || '未知错误'}`)
      return false
    } finally {
      if (requestId === requestSequence) probing.value = false
    }
  }

  return { probing, probePaths, cancelProbe }
}
