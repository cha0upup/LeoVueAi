import { onScopeDispose, ref } from 'vue'
import { getBasicInfoApi } from '@/services/api.js'
import { handleError } from '@/utils/errorHandler.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'

export function useBasicInfo() {
  const basicInfo = ref({})
  const loading = ref(false)
  const error = ref('')
  const requests = createLatestRequestGuard(['info'])

  const reset = () => {
    requests.invalidate()
    basicInfo.value = {}
    loading.value = false
    error.value = ''
  }

  const load = async (sessionId) => {
    if (!sessionId) return reset()
    const sequence = requests.next('info')
    const isCurrent = () => requests.isCurrent('info', sequence)
    loading.value = true
    error.value = ''
    try {
      const response = await getBasicInfoApi({ sessionId })
      if (isCurrent()) basicInfo.value = response.data.BasicInfo || {}
    } catch (cause) {
      if (isCurrent()) error.value = handleError(cause, { defaultMessage: '获取主机信息失败' })
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  onScopeDispose(reset)
  return { basicInfo, loading, error, load, reset }
}
