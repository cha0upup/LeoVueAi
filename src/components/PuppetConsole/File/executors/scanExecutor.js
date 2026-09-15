import {
  pauseNetworkProbeWorkflowApi,
  resumeNetworkProbeWorkflowApi,
  stopNetworkProbeWorkflowApi,
  queryNetworkProbeWorkflowApi,
  listNetworkProbeWorkflowTasksApi
} from '@/services/api.js'
import { TERMINAL_TASK_STATUSES, TaskStatus, TaskType } from '@/constants/task.js'
import { normalizeNetworkWorkflowKind } from '../taskFactories.js'

export function applyScanExecutor(TaskEngine) {
  TaskEngine.prototype.getScanBackendTaskId = function (task) {
    return task?.backendTaskId || task?.serverTaskId || task?.options?.backendTaskId || null
  }

  // Keep request revisions outside the task data exposed to the task center.
  const requestStates = new WeakMap()
  const stateFor = task => {
    if (!requestStates.has(task)) requestStates.set(task, { revision: 0, controlling: false })
    return requestStates.get(task)
  }

  const controlTask = async (engine, task, api) => {
    task = engine.getTaskById(task.id)
    const backendTaskId = engine.getScanBackendTaskId(task)
    if (!backendTaskId) throw new Error('缺少扫描任务编号')
    if (normalizeNetworkWorkflowKind(task.scanKind) !== 'network_workflow') {
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
    const normalized = String(status || '').toUpperCase()
    if (normalized === 'RUNNING' || normalized === 'SCANNING') return TaskStatus.SCANNING
    if (normalized === 'PAUSED') return TaskStatus.PAUSED
    if (normalized === 'FAILED' || normalized === 'ERROR') return TaskStatus.FAILED
    if (normalized === 'CANCELLED' || normalized === 'CANCELED') return TaskStatus.CANCELLED
    if (normalized === 'COMPLETED' || normalized === 'DONE') return TaskStatus.COMPLETED

    if (normalized === 'STOPPED') {
      const outcome = String(snapshot.outcome || '').toUpperCase()
      if (outcome === 'COMPLETED') return TaskStatus.COMPLETED
      if (outcome === 'FAILED') return TaskStatus.FAILED
      if (outcome === 'CANCELLED' || outcome === 'CANCELED') return TaskStatus.CANCELLED
      const total = Number(snapshot.totalCount ?? snapshot.total ?? snapshot.portLength ?? 0)
      const processed = Number(
        snapshot.processedCount ?? snapshot.completed ?? snapshot.scannedCount ??
          snapshot.completedStageCount ?? 0
      )
      const stageTotal = Number(snapshot.stageCount ?? 0)
      const stageCompleted = Number(snapshot.completedStageCount ?? 0)
      return (total > 0 && processed >= total) || (stageTotal > 0 && stageCompleted >= stageTotal)
        ? TaskStatus.COMPLETED
        : TaskStatus.CANCELLED
    }

    return TaskStatus.PENDING
  }

  TaskEngine.prototype.hydrateScanTask = function (taskId, snapshot) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.SCAN || !snapshot) return

    const previousStatus = task.status
    const totalCount = Number(
      snapshot.totalCount ??
        snapshot.total ??
        snapshot.portLength ??
        snapshot.targetCount ??
        task.totalCount ??
        0
    )
    const reportedProcessedCount = Number(
      snapshot.processedCount ??
        snapshot.completed ??
        snapshot.scannedCount ??
        task.processedCount ??
        0
    )
    const nextStatus = snapshot.status ? this.mapScanStatus(snapshot.status, snapshot) : task.status
    const targetCount = Number(snapshot.targetCount ?? task.targetCount ?? totalCount)
    const processedCount =
      snapshot.processedCount !== undefined ||
      snapshot.completed !== undefined ||
      snapshot.scannedCount !== undefined ||
      task.processedCount > 0 ||
      nextStatus !== TaskStatus.COMPLETED
        ? reportedProcessedCount
        : targetCount
    const progress =
      snapshot.progress !== undefined
        ? this.clampProgress(snapshot.progress)
        : totalCount > 0
          ? this.clampProgress((processedCount / totalCount) * 100)
          : task.progress

    task.backendTaskId = snapshot.backendTaskId || snapshot.taskId || task.backendTaskId
    task.serverTaskId = task.backendTaskId || task.serverTaskId
    // Older servers used a hyphenated identifier; keep it compatible while
    // storing the canonical value expected by the scan workbench.
    const scanKind = normalizeNetworkWorkflowKind(snapshot.scanKind)
    task.scanKind = scanKind || task.scanKind
    task.targetLabel = snapshot.targetLabel || task.targetLabel
    task.fileName = snapshot.fileName || task.fileName
    task.status = nextStatus
    task.progress = nextStatus === TaskStatus.COMPLETED ? 100 : progress
    task.currentStep = snapshot.currentStep || task.currentStep || ''
    task.totalCount = totalCount
    task.processedCount = processedCount
    task.targetCount = targetCount
    task.openCount = Number(snapshot.openCount ?? task.openCount ?? 0)
    task.serviceCount = Number(snapshot.serviceCount ?? task.serviceCount ?? 0)
    task.fingerprintCount = Number(snapshot.fingerprintCount ?? task.fingerprintCount ?? 0)
    task.errorCount = Number(snapshot.errorCount ?? task.errorCount ?? 0)
    task.hitCount = Number(snapshot.hitCount ?? task.hitCount ?? 0)
    task.missCount = Number(snapshot.missCount ?? task.missCount ?? 0)
    task.resultSummary = snapshot.resultSummary || task.resultSummary || ''
    task.scanHost = snapshot.scanHost || task.scanHost || ''
    task.scanHosts = snapshot.scanHosts || task.scanHosts || []
    task.scanPorts = snapshot.scanPorts || task.scanPorts || []
    task.portLength = Number(snapshot.portLength ?? task.portLength ?? 0)
    task.scannedCount = Number(snapshot.scannedCount ?? task.scannedCount ?? processedCount)
    task.openPortList = snapshot.openPortList || task.openPortList || []
    task.openPortResults = Array.isArray(snapshot.openPortResults)
      ? snapshot.openPortResults
      : task.openPortResults || []
    task.serviceResults = Array.isArray(snapshot.serviceResults)
      ? snapshot.serviceResults
      : task.serviceResults || []
    task.errors = Array.isArray(snapshot.errors) ? snapshot.errors : task.errors || []
    task.reachableHostList = snapshot.reachableHostList || task.reachableHostList || []
    task.reachableHostCount = Number(snapshot.reachableHostCount ?? task.reachableHostCount ?? task.reachableHostList.length)
    if (snapshot.reachableHostList !== undefined || snapshot.reachableHostCount !== undefined) {
      task.reachabilityLoaded = true
    }
    task.unreachableHostList = snapshot.unreachableHostList || task.unreachableHostList || []
    task.fingerprintId = snapshot.fingerprintId || task.fingerprintId || ''
    task.fingerprintIds = snapshot.fingerprintIds || task.fingerprintIds || []
    task.protocol = snapshot.protocol || task.protocol || ''
    task.result = snapshot.result ?? task.result
    task.outcome = snapshot.outcome || task.outcome || null
    task.stages = Array.isArray(snapshot.stages) ? snapshot.stages : task.stages || []
    // A terminal workflow deliberately returns currentStage=null. Do not
    // retain the previous live stage when hydrating a completed history item.
    if (Object.prototype.hasOwnProperty.call(snapshot, 'currentStage')) {
      task.currentStage = snapshot.currentStage
    } else {
      task.currentStage = task.currentStage || null
    }
    task.reconAnalysis = snapshot.reconAnalysis || task.reconAnalysis || {}
    task.metrics = snapshot.metrics || task.metrics || null
    const createdAt = snapshot.createdAt ?? snapshot.createdTime ?? snapshot.createTime
    if (createdAt != null) {
      const numericCreatedAt = Number(createdAt)
      const normalizedCreatedAt = Number.isFinite(numericCreatedAt) && numericCreatedAt > 0
        ? numericCreatedAt
        : Date.parse(String(createdAt))
      if (Number.isFinite(normalizedCreatedAt) && normalizedCreatedAt > 0) {
        task.createdAt = normalizedCreatedAt
        task.createdTime = normalizedCreatedAt
        task.createTime = normalizedCreatedAt
      }
    }
    task.startTime =
      snapshot.startTime ||
      task.startTime ||
      (nextStatus === TaskStatus.SCANNING ? Date.now() : null)
    task.endTime =
      snapshot.endTime ||
      (TERMINAL_TASK_STATUSES.includes(nextStatus) ? task.endTime || Date.now() : null)
    task.error = snapshot.error || null
    task.canControl = snapshot.canControl === undefined ? task.canControl : snapshot.canControl
    task.options = {
      ...task.options,
      ...(snapshot.options || {})
    }

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
    const backendTaskId = this.getScanBackendTaskId(task)
    if (!backendTaskId || !task?.sessionId) return null
    const state = stateFor(task)
    if (state.controlling) return null
    const revision = state.revision
    if (!this.scanQueryRequests) this.scanQueryRequests = new Map()
    const existing = this.scanQueryRequests.get(task.id)
    if (existing) return existing
    task.scanKind = normalizeNetworkWorkflowKind(task.scanKind)
    if (task.scanKind !== 'network_workflow') {
      throw new Error('未知的扫描任务类型')
    }
    const request = (async () => {
      const response = await queryNetworkProbeWorkflowApi({ sessionId: task.sessionId, taskId: backendTaskId })
      const result = response?.data?.result || response?.data
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
      .filter(task => normalizeNetworkWorkflowKind(task.scanKind) === 'network_workflow')
      .map(task => [this.getScanBackendTaskId(task), task]))
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
        normalizeNetworkWorkflowKind(item.scanKind) === 'network_workflow' &&
        (item.backendTaskId === backendTaskId || item.serverTaskId === backendTaskId)
      )
      if (!task) {
        const taskId = this.createScanTask(
          sessionId,
          'network_workflow',
          snapshot.name || '网络资产发现',
          snapshot.stageCount || 3,
          {
            backendTaskId,
            targetCount: snapshot.targetCount,
            scanHosts: snapshot.hosts,
            scanPorts: snapshot.ports,
            canControl: true
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
