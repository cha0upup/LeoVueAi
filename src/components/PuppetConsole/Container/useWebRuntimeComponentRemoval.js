import { onScopeDispose, ref } from 'vue'
import { removeWebRuntimeComponentApi } from '@/services/api.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { normalizeRuntimeOperation } from './containerManageModel.js'

export function useWebRuntimeComponentRemoval({ props, emit, componentType, label }) {
  const removingIds = ref(new Set())
  let active = true
  onScopeDispose(() => { active = false })

  const removeComponent = async (key, identifier, confirmation) => {
    if (!active || !props.removable || !props.contextId || removingIds.value.has(key)) return false
    const target = { sessionId: props.sessionId, contextId: props.contextId, componentType, identifier }
    const isCurrent = () => active && target.sessionId === props.sessionId && target.contextId === props.contextId
    removingIds.value.add(key)
    try {
      const confirmed = await confirmAction({
        ...confirmation,
        message: `Context: ${props.contextName || 'ROOT'}\n\n${confirmation.message}`
      })
      if (!confirmed || !isCurrent() || !props.removable) return false
      const response = await removeWebRuntimeComponentApi(target)
      if (!isCurrent()) return false
      const operation = normalizeRuntimeOperation(response.data)
      if (!operation.ok) {
        showError(operation.error)
        return false
      }
      showSuccess(`${label} 移除成功`)
      emit('refresh')
      return true
    } catch (error) {
      if (isCurrent()) showError(`移除${label}失败：${error?.message || '未知错误'}`)
      return false
    } finally {
      removingIds.value.delete(key)
    }
  }

  return { removingIds, removeComponent }
}
