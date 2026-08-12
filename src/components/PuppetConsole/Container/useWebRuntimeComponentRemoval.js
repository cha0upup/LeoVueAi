import { ref } from 'vue'
import { removeWebRuntimeComponentApi } from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { normalizeRuntimeOperation } from './containerManageModel.js'

export function useWebRuntimeComponentRemoval({ props, emit, componentType, label }) {
  const removingIds = ref(new Set())

  const removeComponent = async (key, identifier) => {
    removingIds.value.add(key)
    try {
      return await executeRequest(
        async () => {
          const response = await removeWebRuntimeComponentApi({
            sessionId: props.sessionId,
            componentType,
            contextName: props.contextName || '',
            identifier
          })
          const operation = normalizeRuntimeOperation(response.data)
          if (!operation.ok) {
            showError(operation.error)
            return false
          }
          showSuccess(`${label} 移除成功`)
          emit('refresh')
          return true
        },
        {
          successMessage: null,
          errorMessage: `移除${label}失败`
        }
      )
    } catch {
      return false
    } finally {
      removingIds.value.delete(key)
    }
  }

  return { removingIds, removeComponent }
}
