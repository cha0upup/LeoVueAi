import { normalizeEngineTaskStatus, TaskStatus, TaskType } from '@/constants/task.js'

export function applyDbExportExecutor(TaskEngine) {
  TaskEngine.prototype.hydrateDbExportTask = function (taskId, snapshot) {
    const task = this.getTaskById(taskId)
    if (!task || task.type !== TaskType.DB_EXPORT || !snapshot) return

    task.serverTaskId = snapshot.taskId || task.serverTaskId
    task.fileName = snapshot.fileName || task.fileName
    task.status = normalizeEngineTaskStatus(snapshot.status, TaskStatus.DB_EXPORTING)
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
}
