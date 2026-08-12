/**
 * 轻量级应用内事件总线，不依赖第三方库。
 *
 * 用法：
 *   // 发布方
 *   import { emitAppEvent } from '@/composables/useAppEvent.js'
 *   emitAppEvent('recon-summary-updated', { sessionId })
 *
 *   // 订阅方（在组件 setup 中）
 *   import { useAppEvent } from '@/composables/useAppEvent.js'
 *   useAppEvent('recon-summary-updated', (payload) => { ... })
 *   // 组件卸载时自动取消订阅
 */
import { onUnmounted } from 'vue'

const listeners = new Map()

/**
 * 发布事件（可在任意模块调用，无需 Vue 上下文）。
 * @param {string} event
 * @param {*} payload
 */
export function emitAppEvent(event, payload) {
  const handlers = listeners.get(event)
  if (handlers) {
    for (const fn of handlers) {
      try { fn(payload) } catch { /* ignore listener errors */ }
    }
  }
}

/**
 * 在当前组件内订阅事件，组件卸载时自动取消订阅。
 * @param {string} event
 * @param {Function} handler
 */
export function useAppEvent(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(handler)

  onUnmounted(() => {
    const handlers = listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) listeners.delete(event)
    }
  })
}
