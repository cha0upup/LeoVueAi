import { onScopeDispose, ref, shallowRef } from 'vue'
import { getBasicInfoApi } from '@/services/api/agent-node.js'
import { handleError } from '@/utils/errorHandler.js'

export function useBasicInfo() {
  const basicInfo = shallowRef({})
  const loading = ref(false)
  const error = ref('')
  let session = ''
  let pending

  const reset = () => {
    const previous = pending
    pending = undefined
    session = ''
    previous?.controller.abort()
    basicInfo.value = {}
    loading.value = false
    error.value = ''
  }

  const load = (sessionId) => {
    if (!sessionId) return reset()
    if (session !== sessionId) {
      reset()
      session = sessionId
    }
    if (pending) return pending.promise

    const request = { controller: new AbortController(), promise: null }
    pending = request
    request.promise = read(sessionId, request)
    return request.promise
  }

  const read = async (sessionId, request) => {
    const { signal } = request.controller
    loading.value = true
    error.value = ''
    try {
      const response = await getBasicInfoApi({ sessionId }, { signal })
      if (pending === request) basicInfo.value = response.data.BasicInfo || {}
    } catch (cause) {
      if (pending === request) error.value = handleError(cause, { defaultMessage: '读取实例基础信息失败' })
    } finally {
      if (pending === request) {
        pending = undefined
        loading.value = false
      }
    }
  }

  onScopeDispose(reset)
  return { basicInfo, loading, error, load, reset }
}
