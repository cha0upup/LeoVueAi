import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { TaskType, TERMINAL_TASK_STATUSES } from '@/constants/task.js'

const TASK_EVENTS = [
  'taskCreated',
  'taskProgress',
  'taskCompleted',
  'taskFailed',
  'taskPaused',
  'taskResumed',
  'taskCancelled',
  'taskRemoved'
]
const isDiscoveryTask = (task) =>
  task.type === TaskType.SCAN && task.scanKind === 'network_workflow'
const isActive = (task) => !TERMINAL_TASK_STATUSES.includes(task.status)

/** The task engine owns snapshots and controls; this view owns selection and polling. */
export function useAssetDiscoveryTasks({ sessionId, taskEngine, onError, pollIntervalMs = 2000 }) {
  const tasks = shallowRef([])
  const selectedTaskId = ref(null)
  const loading = ref(false)
  const hasLoaded = ref(false)
  const loadError = ref('')
  const resultRefreshToken = ref(0)
  const activeTask = computed(
    () => tasks.value.find((task) => task.id === selectedTaskId.value) || null
  )
  let generation = 0
  let disposed = false
  let timer = null
  let inFlight = null

  const isCurrent = (token) => !disposed && token === generation
  const clearTimer = () => {
    clearTimeout(timer)
    timer = null
  }

  function refreshTaskList() {
    if (disposed) return
    tasks.value = sessionId.value
      ? taskEngine
          .getTasksBySession(sessionId.value)
          .filter(isDiscoveryTask)
          .map((task) => ({ ...task }))
      : []
    if (!tasks.value.some((task) => task.id === selectedTaskId.value)) {
      selectedTaskId.value =
        [...tasks.value].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0]
          ?.id || null
    }
  }

  function scheduleRefresh() {
    clearTimer()
    if (!disposed && !inFlight && tasks.value.some(isActive)) {
      timer = setTimeout(() => {
        timer = null
        void syncTasks({ discover: false })
      }, pollIntervalMs)
    }
  }

  function syncTasks({ discover = true } = {}) {
    if (disposed || !sessionId.value) return Promise.resolve()
    if (inFlight) return inFlight
    clearTimer()
    const token = generation
    const currentSession = sessionId.value
    loading.value = true
    // Defer work until inFlight is assigned, including synchronous task-engine events.
    const request = Promise.resolve().then(async () => {
      try {
        if (!isCurrent(token)) return
        if (discover) await taskEngine.syncNetworkWorkflowTasks(currentSession)
        if (!isCurrent(token)) return
        refreshTaskList()
        const activeTasks = tasks.value.filter(task => isActive(task) ||
          (task.id === selectedTaskId.value && !task.reachabilityLoaded))
        const results = await Promise.allSettled(
          activeTasks.map((task) => taskEngine.queryScanTask(task))
        )
        if (!isCurrent(token)) return
        refreshTaskList()
        if (activeTasks.some((task) => task.id === selectedTaskId.value))
          resultRefreshToken.value += 1
        const failed = results.find((result) => result.status === 'rejected')
        if (failed) {
          loadError.value = failed.reason?.message || '部分任务状态同步失败'
          if (discover) onError?.(failed.reason)
        } else if (discover || !loadError.value) {
          loadError.value = ''
        }
      } catch (error) {
        if (isCurrent(token)) {
          loadError.value = error?.message || '任务同步失败，请重试'
          if (discover || !tasks.value.length) onError?.(error)
        }
      } finally {
        if (isCurrent(token) && inFlight === request) {
          inFlight = null
          loading.value = false
          hasLoaded.value = true
          scheduleRefresh()
        }
      }
    })
    inFlight = request
    return request
  }

  function selectTask(taskId) {
    selectedTaskId.value = taskId
  }

  watch(selectedTaskId, async (taskId) => {
    const task = activeTask.value
    if (!task || isActive(task) || task.reachabilityLoaded) return
    const token = generation
    try {
      await taskEngine.queryScanTask(task)
      if (isCurrent(token) && selectedTaskId.value === taskId) resultRefreshToken.value += 1
    } catch (error) {
      if (isCurrent(token) && selectedTaskId.value === taskId) {
        loadError.value = error?.message || '任务详情加载失败'
        onError?.(error)
      }
    }
  })

  function onTaskEvent(task) {
    if (task?.sessionId !== sessionId.value || !isDiscoveryTask(task)) return
    refreshTaskList()
    scheduleRefresh()
  }
  TASK_EVENTS.forEach((event) => taskEngine.on(event, onTaskEvent))
  watch(
    sessionId,
    () => {
      generation += 1
      inFlight = null
      loading.value = false
      hasLoaded.value = false
      loadError.value = ''
      selectedTaskId.value = null
      resultRefreshToken.value = 0
      clearTimer()
      refreshTaskList()
      void syncTasks()
    },
    { immediate: true, flush: 'sync' }
  )

  onScopeDispose(() => {
    disposed = true
    generation += 1
    clearTimer()
    TASK_EVENTS.forEach((event) => taskEngine.off(event, onTaskEvent))
  })

  return {
    tasks,
    selectedTaskId,
    activeTask,
    loading,
    hasLoaded,
    loadError,
    resultRefreshToken,
    selectTask,
    syncTasks,
    refreshTaskList
  }
}
