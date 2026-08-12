import { isRef, onScopeDispose, ref, watch } from 'vue'

import { executeRequest } from '@/utils/apiUtils.js'
import { confirmAction, confirmDelete } from '@/utils/confirmUtils.js'
import { showSuccess } from '@/utils/messageUtils.js'

const DEFAULT_POLLING_INTERVAL_MS = 2000
const KNOWN_STATUSES = new Set(['RUNNING', 'PAUSED', 'STOPPED'])

/**
 * 扫描任务的通用生命周期控制器。
 *
 * 业务扫描只负责“如何启动任务、如何解释结果、如何同步任务中心”，这里统一负责
 * 查询去重、轮询清理、暂停/继续/终止和本地任务列表管理。
 */
export function useScanTaskLifecycle({
  sessionIdRef,
  queryApi,
  pauseApi,
  resumeApi,
  stopApi,
  syncTask = () => {},
  applyResult = () => {},
  extractResult = (response) => response?.data?.result,
  onTerminal = () => {},
  taskName = '扫描任务',
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS
}) {
  const tasks = ref([])
  const isRefreshing = ref(false)
  const pollingTimers = new Map()
  const inFlightQueries = new Map()
  const querySequences = new Map()
  const controlSequences = new Map()
  let disposed = false

  const getSessionId = () => {
    const id = sessionIdRef?.value ?? sessionIdRef
    return typeof id === 'string' ? id : ''
  }

  const findTask = (taskId) => tasks.value.find((task) => task.taskId === taskId)

  const stopPolling = (taskId) => {
    const timer = pollingTimers.get(taskId)
    if (timer) {
      clearInterval(timer)
      pollingTimers.delete(taskId)
    }
  }

  const applyQueryResult = (task, result) => {
    const previousStatus = task.status
    task.result = result

    const status = String(result?.status || '').toUpperCase()
    if (KNOWN_STATUSES.has(status)) {
      task.status = status
    }

    applyResult(task, result, { previousStatus, status: task.status })
    syncTask(task)

    if (task.status === 'STOPPED') {
      stopPolling(task.taskId)
      if (previousStatus !== 'STOPPED') onTerminal(task, result)
    }
  }

  /**
   * 同一任务同一时刻只保留一个查询请求，避免慢请求被轮询重叠放大。
   * 手动终止后可用 force 拉取最终结果快照。
   */
  const queryResult = (taskId, { force = false, silent = true } = {}) => {
    if (disposed) return Promise.resolve(null)

    const task = findTask(taskId)
    if (!task) {
      stopPolling(taskId)
      return Promise.resolve(null)
    }
    if (task.status === 'STOPPED' && !force) {
      stopPolling(taskId)
      return Promise.resolve(task.result)
    }

    const existingQuery = inFlightQueries.get(taskId)
    if (existingQuery) return existingQuery

    task.isQuerying = true
    const sessionId = getSessionId()
    const sequence = (querySequences.get(taskId) || 0) + 1
    querySequences.set(taskId, sequence)
    let query
    query = (async () => {
      try {
        const response = await queryApi({
          sessionId,
          taskId
        })
        const result = extractResult(response)
        if (!result || typeof result !== 'object') return null
        if (
          disposed ||
          getSessionId() !== sessionId ||
          findTask(taskId) !== task ||
          querySequences.get(taskId) !== sequence
        ) return null
        applyQueryResult(task, result)
        return result
      } catch (error) {
        if (!silent) throw error
        return null
      } finally {
        if (inFlightQueries.get(taskId) === query) {
          if (findTask(taskId) === task) task.isQuerying = false
          inFlightQueries.delete(taskId)
        }
      }
    })()

    inFlightQueries.set(taskId, query)
    return query
  }

  const startPolling = (taskId) => {
    if (disposed) return

    stopPolling(taskId)
    void queryResult(taskId)

    const timer = setInterval(() => {
      const task = findTask(taskId)
      if (!task || task.status === 'STOPPED') {
        stopPolling(taskId)
        return
      }
      if (task.status !== 'PAUSED') {
        void queryResult(taskId)
      }
    }, pollingIntervalMs)

    pollingTimers.set(taskId, timer)
  }

  const addTask = (task) => {
    if (!task?.taskId) {
      throw new TypeError(`${taskName}缺少 taskId`)
    }
    stopPolling(task.taskId)
    inFlightQueries.delete(task.taskId)
    querySequences.delete(task.taskId)
    controlSequences.delete(task.taskId)
    tasks.value = [task, ...tasks.value.filter(item => item.taskId !== task.taskId)]
    syncTask(task)
    return task
  }

  const remove = async (taskId) => {
    const confirmed = await confirmDelete({ message: `确定要删除这个${taskName}吗？` })
    if (!confirmed) return false

    stopPolling(taskId)
    const index = tasks.value.findIndex((task) => task.taskId === taskId)
    if (index < 0) return false

    tasks.value.splice(index, 1)
    showSuccess('任务已删除')
    return true
  }

  const batchRemove = (taskIds, { notify = true } = {}) => {
    const ids = new Set(Array.isArray(taskIds) ? taskIds : [])
    if (!ids.size) return 0

    ids.forEach(stopPolling)
    const before = tasks.value.length
    tasks.value = tasks.value.filter((task) => !ids.has(task.taskId))
    const removedCount = before - tasks.value.length

    if (notify && removedCount > 0) {
      showSuccess(`已删除 ${removedCount} 个任务`)
    }
    return removedCount
  }

  const refresh = async () => {
    await executeRequest(
      async () => {
        const activeTasks = tasks.value.filter((task) => task.status !== 'STOPPED')
        await Promise.all(activeTasks.map((task) => queryResult(task.taskId, { silent: false })))
      },
      {
        loadingRef: isRefreshing,
        successMessage: null,
        errorMessage: '刷新任务失败'
      }
    )
  }

  const runControl = async ({ taskId, api, nextStatus, successMessage, errorMessage }) => {
    const taskAtStart = findTask(taskId)
    if (!taskAtStart) return null
    const sessionId = getSessionId()
    const sequence = (controlSequences.get(taskId) || 0) + 1
    controlSequences.set(taskId, sequence)
    querySequences.set(taskId, (querySequences.get(taskId) || 0) + 1)
    inFlightQueries.delete(taskId)
    taskAtStart.isQuerying = false
    try {
      await executeRequest(() => api({ sessionId, taskId }), {
        successMessage,
        errorMessage
      })

      const task = findTask(taskId)
      if (
        task === taskAtStart &&
        getSessionId() === sessionId &&
        controlSequences.get(taskId) === sequence
      ) {
        querySequences.set(taskId, (querySequences.get(taskId) || 0) + 1)
        inFlightQueries.delete(taskId)
        task.isQuerying = false
        task.status = nextStatus
        syncTask(task)
        return task
      }
      return null
    } catch {
      return null
    }
  }

  const pause = async (taskId) => {
    const task = await runControl({
      taskId,
      api: pauseApi,
      nextStatus: 'PAUSED',
      successMessage: '任务已暂停',
      errorMessage: '暂停失败'
    })
    if (!task) return false

    await queryResult(taskId)
    return true
  }

  const resume = async (taskId) => {
    const task = await runControl({
      taskId,
      api: resumeApi,
      nextStatus: 'RUNNING',
      successMessage: '任务已继续',
      errorMessage: '继续失败'
    })
    if (!task) return false

    if (!pollingTimers.has(taskId)) {
      startPolling(taskId)
    }
    await queryResult(taskId)
    return true
  }

  const stop = async (taskId) => {
    const confirmed = await confirmAction({
      title: '确认终止',
      message: `确定要终止该${taskName}吗？`
    })
    if (!confirmed) return false

    const task = await runControl({
      taskId,
      api: stopApi,
      nextStatus: 'STOPPED',
      successMessage: '任务已终止',
      errorMessage: '终止失败'
    })
    if (!task) return false

    stopPolling(taskId)
    await queryResult(taskId, { force: true })
    return true
  }

  const dispose = () => {
    disposed = true
    pollingTimers.forEach((timer) => clearInterval(timer))
    pollingTimers.clear()
    inFlightQueries.clear()
    querySequences.clear()
    controlSequences.clear()
  }

  const reset = () => {
    pollingTimers.forEach((timer) => clearInterval(timer))
    pollingTimers.clear()
    inFlightQueries.clear()
    querySequences.clear()
    controlSequences.clear()
    tasks.value = []
    isRefreshing.value = false
  }

  if (isRef(sessionIdRef)) {
    watch(sessionIdRef, (sessionId, previousSessionId) => {
      if (sessionId !== previousSessionId) reset()
    })
  }

  onScopeDispose(dispose, true)

  return {
    tasks,
    isRefreshing,
    getSessionId,
    addTask,
    queryResult,
    startPolling,
    stopPolling,
    remove,
    batchRemove,
    refresh,
    pause,
    resume,
    stop,
    reset,
    dispose
  }
}
