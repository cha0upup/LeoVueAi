import { ref } from 'vue'

import { testPuppetConfigApi } from '@/services/api.js'
import { showError } from '@/utils/messageUtils.js'

export function usePuppetConfigTest({ validate, buildPayload }) {
  const testing = ref(false)
  const result = ref(null)
  let requestToken = 0

  const reset = () => {
    requestToken += 1
    testing.value = false
    result.value = null
  }

  const testConnection = async () => {
    const valid = await validate()
    if (!valid) return null
    const token = ++requestToken
    testing.value = true
    result.value = null
    try {
      const response = await testPuppetConfigApi(buildPayload())
      const nextResult = response.data || { success: false, message: '连接无响应' }
      if (token === requestToken) result.value = nextResult
      return nextResult
    } catch (error) {
      const nextResult = {
        success: false,
        message: error?.message || '连接测试失败'
      }
      if (token === requestToken) {
        result.value = nextResult
        showError(nextResult.message)
      }
      return nextResult
    } finally {
      if (token === requestToken) testing.value = false
    }
  }

  return { testing, result, reset, testConnection }
}
