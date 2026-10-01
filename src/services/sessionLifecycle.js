import { readonly, ref } from 'vue'
import { createLogger } from '@/utils/logger.js'

const generation = ref(0)
const cleanups = new Map()
const logger = createLogger('SessionLifecycle')
let resetting = false

// A generation belongs to one browser login, not to a backend task.
export const sessionGeneration = readonly(generation)
export const isCurrentSession = value => value === generation.value

export function createSessionChangedError() {
  const error = new Error('登录会话已更新')
  error.name = 'SessionChangedError'
  error.code = 'SESSION_CHANGED'
  return error
}

export function registerSessionCleanup(key, cleanup) {
  cleanups.set(key, cleanup)
  return () => {
    if (cleanups.get(key) === cleanup) cleanups.delete(key)
  }
}

export function resetSessionState() {
  if (resetting) return
  resetting = true
  try {
    generation.value += 1
    for (const cleanup of [...cleanups.values()]) {
      try {
        cleanup()
      } catch (error) {
        // One failed cleanup must not leave the other user's state alive.
        logger.error('清理登录会话状态失败', error)
      }
    }
  } finally {
    resetting = false
  }
}
