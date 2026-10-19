import {
  pauseNetworkProbeWorkflowApi,
  resumeNetworkProbeWorkflowApi,
  stopNetworkProbeWorkflowApi,
  queryNetworkProbeWorkflowApi,
  listNetworkProbeWorkflowTasksApi
} from '@/services/api/scan.js'
import { TERMINAL_TASK_STATUSES, TaskStatus, TaskType } from '@/constants/task.js'
import { clampProgress } from '@/utils/format.js'
import { interruptedScanProgress } from '../../Scan/scanStages.js'

const STATUS_EVENTS = {
  [TaskStatus.COMPLETED]: 'taskCompleted',
  [TaskStatus.FAILED]: 'taskFailed',
  [TaskStatus.CANCELLED]: 'taskCancelled',
  [TaskStatus.PAUSED]: 'taskPaused'
}

function mapScanStatus(status, snapshot = {}) {
  if (status === 'RUNNING') return TaskStatus.SCANNING
  if (status === 'PAUSED') return TaskStatus.PAUSED
  if (status === 'FAILED') return TaskStatus.FAILED
  if (status !== 'STOPPED') return TaskStatus.PENDING
  return {
    COMPLETED: TaskStatus.COMPLETED,
    FAILED: TaskStatus.FAILED,
    CANCELLED: TaskStatus.CANCELLED
  }[snapshot.outcome] || TaskStatus.CANCELLED
}

export function applyScanExecutor(TaskEngine) {
  // Request state follows the task object without being exposed to the task center.
  const requestStates = new WeakMap()
  const stateFor = task => {
    if (!requestStates.has(task)) requestStates.set(task, { revision: 0, controlling: false, query: null })
    return requestStates.get(task)
  }

  const controlTask = async (engine, task, api) => {
    task = engine.getTaskById(task.id)
    const backendTaskId = task?.backendTaskId
    if (!backendTaskId) throw new Error('缺少扫描任务编号')
    if (task.scanKind !== 'network_workflow') {
      throw new Error('未知的扫描任务类型')
    }
    const state = stateFor(task)
    if (state.controlling) throw new Error('扫描任务正在执行控制操作')
    state.controlling = true
    state.revision += 1
    state.query = null
    try {
      await api({ sessionId: task.sessionId, taskId: backendTaskId })
    } finally {
      state.controlling = false
      state.revision += 1
    }
  }

  TaskEngine.prototype.pauseScanTask = function (task) {
    return controlTask(this, task, pauseNetworkProbeWorkflowApi)
  }

  TaskEngine.prototype.resumeScanTask = function (task) {
    return controlTask(this, task, resumeNetworkProbeWorkflowApi)
  }

  TaskEngine.prototype.stopScanTask = function (task) {
    return controlTask(this, task, stopNetworkProbeWorkflowApi)
  }

  TaskEngine.prototype.executeScanTask = async function (task) {
    if (task.status !== TaskStatus.SCANNING) {
      return
    }

    // 扫描任务由扫描工作台负责启动和轮询，TaskEngine 只统一承载任务中心视图与控制入口。
    this.emit('taskProgress', task)
  }

  TaskEngine.prototype.hydrateScanTask = function (taskId, snapshot) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.SCAN || !snapshot) return

    const previousStatus = task.status
    const nextStatus = snapshot.status ? mapScanStatus(snapshot.status, snapshot) : task.status
    const targetCount = Number(snapshot.targetCount ?? task.targetCount)
    const processedCount = nextStatus === TaskStatus.COMPLETED ? targetCount : task.processedCount
    const interruptedProgress = [TaskStatus.FAILED, TaskStatus.CANCELLED].includes(nextStatus)
      ? interruptedScanProgress(snapshot.stages ?? task.stages) : null
    const progress = interruptedProgress ?? clampProgress(snapshot.progress ?? task.progress)

    task.backendTaskId = snapshot.taskId || task.backendTaskId
    task.status = nextStatus
    task.progress = nextStatus === TaskStatus.COMPLETED ? 100 : progress
    task.processedCount = processedCount
    task.targetCount = targetCount
    task.openCount = Number(snapshot.openCount ?? task.openCount)
    task.serviceCount = Number(snapshot.serviceCount ?? task.serviceCount)
    task.fingerprintCount = Number(snapshot.fingerprintCount ?? task.fingerprintCount)
    task.identifiedApplicationCount = Number(snapshot.identifiedApplicationCount ?? task.identifiedApplicationCount)
    task.scanHosts = snapshot.hosts ?? task.scanHosts
    task.scanPorts = snapshot.ports ?? task.scanPorts
    task.reachableHostList = snapshot.reachableHostList ?? task.reachableHostList
    task.reachableHostCount = Number(snapshot.reachableHostCount ?? task.reachableHostCount)
    for (const key of ['unknownHostCount', 'unreachableHostCount', 'pendingHostCount', 'skippedHostCount', 'portScanHostCount']) {
      if (snapshot[key] != null) task[key] = Math.max(0, Number(snapshot[key]) || 0)
    }
    task.stages = snapshot.stages ?? task.stages
    const stages = Array.isArray(task.stages) ? task.stages : []
    task.probeCompleted = stages.reduce((total, stage) => total + Math.max(0, Number(stage.completed) || 0), 0)
    // A terminal workflow deliberately returns currentStage=null. Do not
    // retain the previous live stage when hydrating a completed history item.
    if (snapshot.currentStage !== undefined) {
      task.currentStage = snapshot.currentStage
    }
    const createdAt = snapshot.createdAt
    if (createdAt != null) {
      const numericCreatedAt = Number(createdAt)
      const normalizedCreatedAt = Number.isFinite(numericCreatedAt) && numericCreatedAt > 0
        ? numericCreatedAt
        : Date.parse(String(createdAt))
      if (Number.isFinite(normalizedCreatedAt) && normalizedCreatedAt > 0) {
        task.createdAt = normalizedCreatedAt
      }
    }
    task.startTime =
      snapshot.startTime ||
      task.startTime ||
      (nextStatus === TaskStatus.SCANNING ? task.createdAt || Date.now() : null)
    task.endTime =
      snapshot.finishedAt ||
      (TERMINAL_TASK_STATUSES.includes(nextStatus) ? task.endTime || Date.now() : null)
    if (snapshot.error !== undefined) task.error = snapshot.error || null

    let event = 'taskProgress'
    if (nextStatus !== previousStatus) {
      event = STATUS_EVENTS[nextStatus] ||
        (previousStatus === TaskStatus.PAUSED && nextStatus === TaskStatus.SCANNING ? 'taskResumed' : 'taskProgress')
    }
    if (event === 'taskFailed') {
      this.emit(event, task, new Error(task.error || '扫描任务失败'))
    } else {
      this.emit(event, task)
    }
  }

  TaskEngine.prototype.queryScanTask = async function (task) {
    task = this.getTaskById(task?.id)
    const backendTaskId = task?.backendTaskId
    if (!backendTaskId || !task?.sessionId) return null
    const state = stateFor(task)
    if (state.controlling) return null
    if (state.query) return state.query
    const revision = state.revision
    if (task.scanKind !== 'network_workflow') {
      throw new Error('未知的扫描任务类型')
    }
    const request = (async () => {
      const response = await queryNetworkProbeWorkflowApi({ sessionId: task.sessionId, taskId: backendTaskId })
      const result = response?.data
      if (this.getTaskById(task.id) !== task || state.controlling || state.revision !== revision) return null
      if (result && typeof result === 'object') {
        state.revision += 1
        task.detailsLoaded = true
        this.hydrateScanTask(task.id, result)
      }
      return result
    })()
    state.query = request
    try {
      return await request
    } finally {
      if (state.query === request) state.query = null
    }
  }

  TaskEngine.prototype.syncNetworkWorkflowTasks = async function (sessionId, { scope = 'history', cursor = '' } = {}) {
    const emptyPage = { tasks: [], hasMore: false, nextCursor: '' }
    if (!sessionId) return emptyPage
    const sessionTasks = this.getSessionTasks(sessionId)
    const previousTasks = new Map([...sessionTasks.values()]
      .filter(task => task.scanKind === 'network_workflow')
      .map(task => [task.backendTaskId, { task, revision: stateFor(task).revision }]))
    const response = await listNetworkProbeWorkflowTasksApi({ sessionId, scope, cursor, pageSize: scope === 'active' ? 100 : 20 })
    if (this.sessionTasks.get(sessionId) !== sessionTasks) return emptyPage
    const snapshots = Array.isArray(response?.data?.tasks) ? response.data.tasks : []
    const result = []
    const tasksByBackendId = new Map(this.getTasksBySession(sessionId)
      .filter(task => task.scanKind === 'network_workflow')
      .map(task => [task.backendTaskId, task]))
    for (const snapshot of snapshots) {
      const backendTaskId = snapshot?.taskId
      if (!backendTaskId) continue
      const previous = previousTasks.get(backendTaskId)
      if (previous && this.getTaskById(previous.task.id) !== previous.task) continue
      let task = tasksByBackendId.get(backendTaskId)
      if (!task) {
        const taskId = this.createScanTask(
          sessionId,
          snapshot.name || '网络资产发现',
          {
            backendTaskId,
            targetCount: snapshot.targetCount,
            scanHosts: snapshot.hosts,
            scanPorts: snapshot.ports
          }
        )
        task = this.getTaskById(taskId)
      }
      tasksByBackendId.set(backendTaskId, task)
      const state = stateFor(task)
      if (!state.controlling && state.revision === (previous?.revision ?? 0)) {
        if (snapshot.status && mapScanStatus(snapshot.status, snapshot) !== task.status) {
          task.detailsLoaded = false
        }
        this.hydrateScanTask(task.id, snapshot)
      }
      result.push(task)
    }
    return {
      tasks: result,
      hasMore: response?.data?.hasMore === true,
      nextCursor: response?.data?.nextCursor || ''
    }
  }
}
