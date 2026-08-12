import { ref, watch } from 'vue'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const STORAGE_KEY = 'skill-manager-ui-state-v2'

const DEFAULT_STATE = {
  activeScope: 'puppet-node',
  catalogMode: 'simple',
  lastFilePath: '',
  treePanelWidth: 240
}

function readState() {
  const parsed = safeLocalStorage.getJSON(
    STORAGE_KEY,
    {},
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  )
  return { ...DEFAULT_STATE, ...parsed }
}

function writeState(state) {
  safeLocalStorage.setJSON(STORAGE_KEY, state)
}

let sharedState = null

function getSharedState() {
  if (sharedState) return sharedState

  sharedState = ref(readState())
  watch(sharedState, writeState, { deep: true })
  return sharedState
}

/**
 * Skill Manager 的 UI 状态持久化。
 *
 * 返回的 ref 直接绑定到组件状态，watch 自动同步到 localStorage。
 * 多个组件共享同一份状态，避免互相覆盖。
 */
export function useSkillUiState() {
  return { state: getSharedState() }
}
