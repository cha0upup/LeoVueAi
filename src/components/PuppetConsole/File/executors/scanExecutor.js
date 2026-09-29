import {
  pauseNetworkProbeWorkflowApi,
  resumeNetworkProbeWorkflowApi,
  stopNetworkProbeWorkflowApi,
  queryNetworkProbeWorkflowApi,
  listNetworkProbeWorkflowTasksApi
} from '@/services/api.js'
import { TERMINAL_TASK_STATUSES, TaskStatus, TaskType } from '@/constants/task.js'

export function applyScanExecutor(TaskEngine) {
  // Keep request revisions outside the task data exposed to the task center.
  const requestStates = new WeakMap()
  const stateFor = task => {
    if (!requestStates.has(task)) requestStates.set(task, { revision: 0, controlling: false })
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
    engine.scanQueryRequests?.delete(task.id)
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

  TaskEngine.prototype.clampProgress = function (progress) {
    const value = Number(progress || 0)
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
  }

  TaskEngine.prototype.mapScanStatus = function (status, snapshot = {}) {
    if (status === 'RUNNING') return TaskStatus.SCANNING
    if (status === 'PAUSED') return TaskStatus.PAUSED
    if (status !== 'STOPPED') return TaskStatus.PENDING
    return {
      COMPLETED: TaskStatus.COMPLETED,
      FAILED: TaskStatus.FAILED,
      CANCELLED: TaskStatus.CANCELLED
    }[snapshot.outcome] || TaskStatus.CANCELLED
  }

  TaskEngine.prototype.hydrateScanTask = function (taskId, snapshot) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.SCAN || !snapshot) return

    const previousStatus = task.status
    const nextStatus = snapshot.status ? this.mapScanStatus(snapshot.status, snapshot) : task.status
    const targetCount = Number(snapshot.targetCount ?? task.targetCount)
    const processedCount = nextStatus === TaskStatus.COMPLETED ? targetCount : task.processedCount
    const progress = this.clampProgress(snapshot.progress ?? task.progress)

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
    if (snapshot.reachableHostList !== undefined || snapshot.reachableHostCount !== undefined) {
      task.reachabilityLoaded = true
    }
    task.stages = snapshot.stages ?? task.stages
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
      (nextStatus === TaskStatus.SCANNING ? Date.now() : null)
    task.endTime =
      snapshot.finishedAt ||
      (TERMINAL_TASK_STATUSES.includes(nextStatus) ? task.endTime || Date.now() : null)
    task.error = snapshot.error || null

    if (nextStatus === TaskStatus.COMPLETED && previousStatus !== TaskStatus.COMPLETED) {
      this.emit('taskCompleted', task)
      return
    }
    if (nextStatus === TaskStatus.FAILED && previousStatus !== TaskStatus.FAILED) {
      this.emit('taskFailed', task, new Error(task.error || '扫描任务失败'))
      return
    }
    if (nextStatus === TaskStatus.CANCELLED && previousStatus !== TaskStatus.CANCELLED) {
      this.emit('taskCancelled', task)
      return
    }
    if (nextStatus === TaskStatus.PAUSED && previousStatus !== TaskStatus.PAUSED) {
      this.emit('taskPaused', task)
      return
    }
    if (nextStatus === TaskStatus.SCANNING && previousStatus === TaskStatus.PAUSED) {
      this.emit('taskResumed', task)
      return
    }

    this.emit('taskProgress', task)
  }

  TaskEngine.prototype.queryScanTask = async function (task) {
    task = this.getTaskById(task?.id)
    const backendTaskId = task?.backendTaskId
    if (!backendTaskId || !task?.sessionId) return null
    const state = stateFor(task)
    if (state.controlling) return null
    const revision = state.revision
    if (!this.scanQueryRequests) this.scanQueryRequests = new Map()
    const existing = this.scanQueryRequests.get(task.id)
    if (existing) return existing
    if (task.scanKind !== 'network_workflow') {
      throw new Error('未知的扫描任务类型')
    }
    const request = (async () => {
      const response = await queryNetworkProbeWorkflowApi({ sessionId: task.sessionId, taskId: backendTaskId })
      const result = response?.data
      if (this.getTaskById(task.id) !== task || state.controlling || state.revision !== revision) return null
      if (result && typeof result === 'object') {
        this.hydrateScanTask(task.id, result)
      }
      return result
    })()
    this.scanQueryRequests.set(task.id, request)
    try {
      return await request
    } finally {
      if (this.scanQueryRequests.get(task.id) === request) this.scanQueryRequests.delete(task.id)
    }
  }

  TaskEngine.prototype.syncNetworkWorkflowTasks = async function (sessionId) {
    if (!sessionId) return []
    const sessionTasks = this.getSessionTasks(sessionId)
    const revisions = new Map([...sessionTasks.values()].map(task => [task.id, stateFor(task).revision]))
    const previousTasks = new Map([...sessionTasks.values()]
      .filter(task => task.scanKind === 'network_workflow')
      .map(task => [task.backendTaskId, task]))
    const response = await listNetworkProbeWorkflowTasksApi({ sessionId })
    if (this.sessionTasks.get(sessionId) !== sessionTasks) return []
    const snapshots = Array.isArray(response?.data?.tasks) ? response.data.tasks : []
    const result = []
    for (const snapshot of snapshots) {
      const backendTaskId = snapshot?.taskId
      if (!backendTaskId) continue
      const previousTask = previousTasks.get(backendTaskId)
      if (previousTask && this.getTaskById(previousTask.id) !== previousTask) continue
      let task = this.getTasksBySession(sessionId).find(item =>
        item.scanKind === 'network_workflow' && item.backendTaskId === backendTaskId
      )
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
      const state = stateFor(task)
      if (!state.controlling && state.revision === (revisions.get(task.id) ?? 0)) {
        this.hydrateScanTask(task.id, snapshot)
      }
      result.push(task)
    }
    return result
  }
}
