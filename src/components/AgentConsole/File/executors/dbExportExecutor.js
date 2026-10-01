import { TaskStatus, TaskType } from '@/constants/task.js'

export function applyDbExportExecutor(TaskEngine) {
  TaskEngine.prototype.mapDbExportStatus = function (status) {
    const normalized = String(status || '').toUpperCase()
    if (normalized === 'PENDING') return TaskStatus.PENDING
    if (normalized === 'RUNNING') return TaskStatus.DB_EXPORTING
    if (normalized === 'PAUSED') return TaskStatus.PAUSED
    if (normalized === 'CANCELLED') return TaskStatus.CANCELLED
    if (normalized === 'FAILED') return TaskStatus.FAILED
    if (normalized === 'COMPLETED') return TaskStatus.COMPLETED
    return TaskStatus.PENDING
  }

  TaskEngine.prototype.hydrateDbExportTask = function (taskId, snapshot) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.DB_EXPORT || !snapshot) return

    task.serverTaskId = snapshot.taskId || task.serverTaskId
    task.fileName = snapshot.fileName || task.fileName
    task.status = this.mapDbExportStatus(snapshot.status)
    task.progress = Number(snapshot.progress || 0)
    task.currentTable = snapshot.currentTable || ''
    task.processedTables = Number(snapshot.processedTables || 0)
    task.tableCount = snapshot.tableCount ?? task.tableCount
    task.rowCount = snapshot.rowCount ?? task.rowCount
    task.fileSize = snapshot.fileSize ?? task.fileSize
    task.downloadPath = snapshot.downloadPath || task.downloadPath
    task.createdTime = snapshot.createdTime || task.createdTime
    task.startTime = snapshot.startTime || task.startTime
    task.endTime = snapshot.endTime || task.endTime
    task.error = snapshot.error || null
    task.options = {
      ...task.options,
      exportFormat: snapshot.format || task.options.exportFormat,
      includeStructure:
        snapshot.includeStructure === null || snapshot.includeStructure === undefined
          ? task.options.includeStructure
          : snapshot.includeStructure,
      includeData:
        snapshot.includeData === null || snapshot.includeData === undefined
          ? task.options.includeData
          : snapshot.includeData
    }

    this.emit('taskProgress', task)
  }

  // 更新数据库导出任务进度
  TaskEngine.prototype.updateDbExportProgress = function (taskId, progress, currentTable, processedTables) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.DB_EXPORT) {
      return
    }

    task.progress = Math.min(100, Math.max(0, progress))
    task.currentTable = currentTable
    task.processedTables = processedTables

    this.emit('taskProgress', task)
  }

  // 完成数据库导出任务
  TaskEngine.prototype.completeDbExportTask = function (taskId, result) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.DB_EXPORT) {
      return
    }

    task.status = TaskStatus.COMPLETED
    task.progress = 100
    task.endTime = Date.now()
    task.result = result

    this.activeTasks.delete(taskId)
    this.emit('taskCompleted', task)
  }

  // 失败数据库导出任务
  TaskEngine.prototype.failDbExportTask = function (taskId, error) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.DB_EXPORT) {
      return
    }

    task.status = TaskStatus.FAILED
    task.error = error
    task.endTime = Date.now()

    this.activeTasks.delete(taskId)
    this.emit('taskFailed', task, new Error(error))
  }
}
