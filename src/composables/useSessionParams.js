import { unref } from 'vue'

/**
 * 统一构造带 sessionId 的 puppet API 请求体。
 *
 * 替代每个组件重复的:
 *   function buildParams(extra = {}) {
 *     return { sessionId: props.sessionId, ...extra }
 *   }
 *
 * 用法:
 *   const { withSession } = useSessionParams(() => props.sessionId)
 *   const res = await someApi(withSession({ source, format }))
 *
 * sessionRef 可以是:
 *   - ref/computed:`ref(sessionId)` 或 `computed(() => props.sessionId)`
 *   - getter 函数:`() => props.sessionId`
 *   - 字符串字面量
 */
export function useSessionParams(sessionRef) {
  function readSessionId() {
    if (typeof sessionRef === 'function') return sessionRef()
    return unref(sessionRef)
  }

  function withSession(extra = {}) {
    return { sessionId: readSessionId(), ...extra }
  }

  return { withSession, sessionId: readSessionId }
}
