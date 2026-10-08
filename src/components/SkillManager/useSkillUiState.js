import { ref, watch } from 'vue'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const STORAGE_KEY = 'skill-manager-ui-state-v2'

const DEFAULT_STATE = {
  activeScope: 'agent-node',
  catalogMode: 'simple',
  lastFilePath: '',
  treePanelWidth: 240
}

let sharedState = null

/**
 * Skill Manager 的 UI 状态持久化。
 *
 * 返回的 ref 直接绑定到组件状态，watch 自动同步到 localStorage。
 * 多个组件共享同一份状态，避免互相覆盖。
 */
export function useSkillUiState() {
  if (!sharedState) {
    const parsed = safeLocalStorage.getJSON(
      STORAGE_KEY,
      {},
      (value) => value && typeof value === 'object' && !Array.isArray(value)
    )
    sharedState = ref({ ...DEFAULT_STATE, ...parsed })
    watch(sharedState, (state) => safeLocalStorage.setJSON(STORAGE_KEY, state), { deep: true })
  }
  return { state: sharedState }
}
