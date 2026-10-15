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
export function useAssetDiscoveryTasks({ sessionId, taskEngine, onError, pollIntervalMs = 2000, autoSelect = true }) {
  const tasks = shallowRef([])
  const selectedTaskId = ref(null)
  const inFlight = shallowRef(null)
  const moreRequest = shallowRef(null)
  const loading = computed(() => Boolean(inFlight.value))
  const loadingMore = computed(() => Boolean(moreRequest.value))
  const hasLoaded = ref(false)
  const loadError = ref('')
  const historyCursor = ref('')
  const hasMoreHistory = computed(() => Boolean(historyCursor.value))
  const resultRefreshToken = ref(0)
  const activeTask = computed(
    () => tasks.value.find((task) => task.id === selectedTaskId.value) || null
  )
  let generation = 0
  let disposed = false
  let timer = null

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
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0) ||
            String(b.backendTaskId).localeCompare(String(a.backendTaskId)))
          .map((task) => ({ ...task }))
      : []
    if (!tasks.value.some((task) => task.id === selectedTaskId.value)) {
      selectedTaskId.value = autoSelect ? tasks.value[0]?.id || null : null
    }
  }

  function scheduleRefresh() {
    clearTimer()
    if (!disposed && !inFlight.value && sessionId.value && pollIntervalMs > 0) {
      timer = setTimeout(() => {
        timer = null
        void syncTasks({ discover: false })
      }, pollIntervalMs)
    }
  }

  function syncTasks({ discover = true, more = false } = {}) {
    if (disposed || !sessionId.value) return Promise.resolve()
    if (inFlight.value) return inFlight.value
    clearTimer()
    const token = generation
    const currentSession = sessionId.value
    // Defer work until inFlight is assigned, including synchronous task-engine events.
    const request = Promise.resolve().then(async () => {
      try {
        if (!isCurrent(token)) return
        if (discover || more) {
          const page = await taskEngine.syncNetworkWorkflowTasks(currentSession, {
            scope: 'history', cursor: more ? historyCursor.value : ''
          })
          if (!isCurrent(token)) return
          historyCursor.value = page.hasMore ? page.nextCursor : ''
        }
        // Discover live tasks independently of how much history is loaded.
        const liveIds = new Set()
        if (!more) {
          let cursor = ''
          do {
            const page = await taskEngine.syncNetworkWorkflowTasks(currentSession, { scope: 'active', cursor })
            if (!isCurrent(token)) return
            page.tasks.forEach(task => liveIds.add(task.id))
            if (!page.hasMore) break
            if (!page.nextCursor || page.nextCursor === cursor) throw new Error('活跃任务分页游标异常')
            cursor = page.nextCursor
          } while (isCurrent(token))
        }
        refreshTaskList()
        // Only the selected task needs full details. Query missing live tasks once
        // more to observe terminal transitions that no longer appear in the live list.
        const activeTasks = tasks.value.filter(task =>
          (task.id === selectedTaskId.value && (isActive(task) || !task.detailsLoaded)) ||
          (!more && isActive(task) && !liveIds.has(task.id)))
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
        } else {
          loadError.value = ''
        }
      } catch (error) {
        if (isCurrent(token)) {
          loadError.value = error?.message || '任务同步失败，请重试'
          if (discover || !tasks.value.length) onError?.(error)
        }
      } finally {
        if (isCurrent(token) && inFlight.value === request) {
          inFlight.value = null
          hasLoaded.value = true
          scheduleRefresh()
        }
      }
    })
    inFlight.value = request
    return request
  }

  function loadMoreTasks() {
    if (moreRequest.value) return moreRequest.value
    const token = generation
    const request = Promise.resolve(inFlight.value).then(() => {
      if (isCurrent(token) && hasMoreHistory.value) return syncTasks({ discover: false, more: true })
    }).finally(() => {
      if (moreRequest.value === request) moreRequest.value = null
    })
    moreRequest.value = request
    return request
  }

  function selectTask(taskId) {
    selectedTaskId.value = taskId
  }

  watch(selectedTaskId, async (taskId) => {
    const task = activeTask.value
    if (!task || inFlight.value || (!isActive(task) && task.detailsLoaded)) return
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
      inFlight.value = null
      hasLoaded.value = false
      loadError.value = ''
      historyCursor.value = ''
      moreRequest.value = null
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
    hasMoreHistory,
    loadingMore,
    loadMoreTasks,
    resultRefreshToken,
    selectTask,
    syncTasks,
    refreshTaskList
  }
}
