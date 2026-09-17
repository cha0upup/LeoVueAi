import { computed, ref, onScopeDispose } from 'vue'
import {
  debugNetworkFingerprintApi,
  queryNetworkProbeWorkflowApi,
  stopNetworkProbeWorkflowApi
} from '@/services/api.js'

export function useFingerprintDebug() {
  const taskId = ref('')
  const taskSessionId = ref('')
  const summary = ref(null)
  const pending = ref(false)
  const stopping = ref(false)
  const error = ref('')
  const refreshToken = ref(0)
  const active = computed(() => Boolean(taskId.value) && summary.value?.status !== 'STOPPED')
  let generation = 0
  let timer
  let disposed = false
  let querying = false

  async function refresh() {
    if (disposed || !taskId.value || querying) return
    clearTimeout(timer)
    const current = generation
    querying = true
    try {
      const response = await queryNetworkProbeWorkflowApi({ sessionId: taskSessionId.value, taskId: taskId.value })
      if (disposed || current !== generation) return
      summary.value = response.data
      error.value = ''
      refreshToken.value += 1
      if (active.value) timer = setTimeout(refresh, 1000)
    } catch (cause) {
      if (!disposed && current === generation) error.value = cause?.message || '读取调试进度失败，请刷新重试'
    } finally {
      if (current === generation) querying = false
    }
  }

  async function start({ sessionId, target, fingerprint }) {
    if (pending.value || active.value || disposed) return
    const current = ++generation
    clearTimeout(timer)
    querying = false
    pending.value = true
    taskId.value = ''
    summary.value = null
    error.value = ''
    try {
      const response = await debugNetworkFingerprintApi({ sessionId, target, fingerprint })
      if (disposed || current !== generation) return
      if (!response.data?.taskId) throw new Error('启动响应缺少任务编号')
      taskSessionId.value = sessionId
      taskId.value = response.data.taskId
      await refresh()
    } catch (cause) {
      if (!disposed && current === generation) error.value = cause?.message || '启动调试失败'
    } finally {
      if (!disposed && current === generation) pending.value = false
    }
  }

  async function stop() {
    if (!active.value || stopping.value) return
    const current = generation
    stopping.value = true
    try {
      await stopNetworkProbeWorkflowApi({ sessionId: taskSessionId.value, taskId: taskId.value })
      if (!disposed && current === generation) await refresh()
    } catch (cause) {
      if (!disposed && current === generation) error.value = cause?.message || '停止调试失败'
    } finally {
      if (!disposed && current === generation) stopping.value = false
    }
  }

  onScopeDispose(() => { disposed = true; generation += 1; clearTimeout(timer) })
  return { taskId, taskSessionId, summary, pending, stopping, error, refreshToken, active, start, stop, refresh }
}
