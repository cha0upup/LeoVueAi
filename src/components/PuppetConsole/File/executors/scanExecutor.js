import {
  pauseFingerprintScanApi,
  pausePortScanApi,
  resumeFingerprintScanApi,
  resumePortScanApi,
  stopFingerprintScanApi,
  stopPortScanApi
} from '@/services/api.js'
import { TERMINAL_TASK_STATUSES, TaskStatus, TaskType } from '@/constants/task.js'

export function applyScanExecutor(TaskEngine) {
  TaskEngine.prototype.getScanBackendTaskId = function (task) {
    return task?.backendTaskId || task?.serverTaskId || task?.options?.backendTaskId || null
  }

  TaskEngine.prototype.pauseScanTask = async function (task) {
    const backendTaskId = this.getScanBackendTaskId(task)
    if (!backendTaskId) {
      throw new Error('缺少扫描任务编号，无法暂停')
    }

    if (task.scanKind === 'port_scan') {
      await pausePortScanApi({ sessionId: task.sessionId, taskId: backendTaskId })
    } else if (task.scanKind === 'fingerprint_scan') {
      await pauseFingerprintScanApi({ sessionId: task.sessionId, taskId: backendTaskId })
    } else {
      throw new Error('该扫描任务不支持暂停')
    }
  }

  TaskEngine.prototype.resumeScanTask = async function (task) {
    const backendTaskId = this.getScanBackendTaskId(task)
    if (!backendTaskId) {
      throw new Error('缺少扫描任务编号，无法继续')
    }

    if (task.scanKind === 'port_scan') {
      await resumePortScanApi({ sessionId: task.sessionId, taskId: backendTaskId })
    } else if (task.scanKind === 'fingerprint_scan') {
      await resumeFingerprintScanApi({ sessionId: task.sessionId, taskId: backendTaskId })
    } else {
      throw new Error('该扫描任务不支持继续')
    }
  }

  TaskEngine.prototype.stopScanTask = async function (task) {
    const backendTaskId = this.getScanBackendTaskId(task)
    if (!backendTaskId) {
      throw new Error('缺少扫描任务编号，无法终止')
    }

    if (task.scanKind === 'port_scan') {
      await stopPortScanApi({ sessionId: task.sessionId, taskId: backendTaskId })
    } else if (task.scanKind === 'fingerprint_scan') {
      await stopFingerprintScanApi({ sessionId: task.sessionId, taskId: backendTaskId })
    } else {
      throw new Error('该扫描任务不支持终止')
    }
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
      const total = Number(snapshot.totalCount ?? snapshot.total ?? snapshot.portLength ?? 0)
      const processed = Number(snapshot.processedCount ?? snapshot.completed ?? snapshot.scannedCount ?? 0)
      return total > 0 && processed >= total ? TaskStatus.COMPLETED : TaskStatus.CANCELLED
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
    const processedCount = Number(
      snapshot.processedCount ?? snapshot.completed ?? snapshot.scannedCount ?? task.processedCount ?? 0
    )
    const nextStatus = snapshot.status ? this.mapScanStatus(snapshot.status, snapshot) : task.status
    const progress =
      snapshot.progress !== undefined
        ? this.clampProgress(snapshot.progress)
        : totalCount > 0
          ? this.clampProgress((processedCount / totalCount) * 100)
          : task.progress

    task.backendTaskId = snapshot.backendTaskId || snapshot.taskId || task.backendTaskId
    task.serverTaskId = task.backendTaskId || task.serverTaskId
    task.scanKind = snapshot.scanKind || task.scanKind
    task.targetLabel = snapshot.targetLabel || task.targetLabel
    task.fileName = snapshot.fileName || task.fileName
    task.status = nextStatus
    task.progress = nextStatus === TaskStatus.COMPLETED ? 100 : progress
    task.currentStep = snapshot.currentStep || task.currentStep || ''
    task.totalCount = totalCount
    task.processedCount = processedCount
    task.targetCount = Number(snapshot.targetCount ?? task.targetCount ?? totalCount)
    task.hitCount = Number(snapshot.hitCount ?? task.hitCount ?? 0)
    task.missCount = Number(snapshot.missCount ?? task.missCount ?? 0)
    task.resultSummary = snapshot.resultSummary || task.resultSummary || ''
    task.scanHost = snapshot.scanHost || task.scanHost || ''
    task.scanHosts = snapshot.scanHosts || task.scanHosts || []
    task.scanPorts = snapshot.scanPorts || task.scanPorts || []
    task.portLength = Number(snapshot.portLength ?? task.portLength ?? 0)
    task.scannedCount = Number(snapshot.scannedCount ?? task.scannedCount ?? processedCount)
    task.openPortList = snapshot.openPortList || task.openPortList || []
    task.reachableHostList = snapshot.reachableHostList || task.reachableHostList || []
    task.unreachableHostList = snapshot.unreachableHostList || task.unreachableHostList || []
    task.fingerprintId = snapshot.fingerprintId || task.fingerprintId || ''
    task.protocol = snapshot.protocol || task.protocol || ''
    task.result = snapshot.result ?? task.result
    task.createdTime = snapshot.createdTime || task.createdTime || snapshot.createTime
    task.createTime = snapshot.createTime || task.createTime || task.createdTime
    task.startTime =
      snapshot.startTime || task.startTime || (nextStatus === TaskStatus.SCANNING ? Date.now() : null)
    task.endTime =
      snapshot.endTime || (TERMINAL_TASK_STATUSES.includes(nextStatus) ? task.endTime || Date.now() : null)
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
}
