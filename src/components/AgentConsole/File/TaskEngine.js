import {
  uploadFileChunkApi,
  downloadEngineCancelApi,
  downloadEnginePauseApi,
  downloadEngineResumeApi,
  downloadEngineRetryApi
} from '@/services/api/agent-files.js'
import { pauseSqlExportTaskApi, resumeSqlExportTaskApi, stopSqlExportTaskApi } from '@/services/api/sql.js'
import {
  TERMINAL_TASK_STATUSES,
  TaskStatus,
  TaskType
} from '@/constants/task.js'
import {
  createDbExportTask,
  createDownloadTask,
  createScanTask,
  createUploadTask
} from './taskFactories.js'
import { applyDownloadExecutor } from './executors/downloadExecutor.js'
import { applyUploadExecutor } from './executors/uploadExecutor.js'
import { applyScanExecutor } from './executors/scanExecutor.js'
import { applyDbExportExecutor } from './executors/dbExportExecutor.js'
import { registerSessionCleanup } from '@/services/sessionLifecycle.js'

/** 按会话管理任务，协调执行器并分发生命周期事件。 */
class TaskEngine {
  constructor() {
    this.sessionTasks = new Map() // 按sessionId分组的任务存储: Map<sessionId, Map<taskId, task>>
    this.maxConcurrentTasks = 3 // 最大并发任务数
    this.activeTasks = new Set() // 活跃任务集合
    this.taskIdCounter = 0 // 任务ID计数器
    this.eventListeners = new Map() // 事件监听器
  }

  // Detach browser observers without cancelling durable backend tasks.
  detach() {
    for (const tasks of this.sessionTasks.values()) {
      for (const task of tasks.values()) {
        task.isDetached = true
        task.fileData = null
      }
    }
    this.sessionTasks.clear()
    this.activeTasks.clear()
    this.eventListeners.clear()
    this.scanQueryRequests?.clear()
  }

  // 任务存储与查询

  generateTaskId() {
    return `task_${Date.now()}_${++this.taskIdCounter}`
  }

  getSessionTasks(sessionId) {
    if (!this.sessionTasks.has(sessionId)) {
      this.sessionTasks.set(sessionId, new Map())
    }
    return this.sessionTasks.get(sessionId)
  }

  getTasksBySession(sessionId) {
    const sessionTaskMap = this.getSessionTasks(sessionId)
    return Array.from(sessionTaskMap.values())
  }

  getTaskById(taskId) {
    for (const sessionTaskMap of this.sessionTasks.values()) {
      if (sessionTaskMap.has(taskId)) {
        return sessionTaskMap.get(taskId)
      }
    }
    return null
  }

  removeTaskById(taskId) {
    for (const sessionTaskMap of this.sessionTasks.values()) {
      if (sessionTaskMap.has(taskId)) {
        sessionTaskMap.delete(taskId)
        return true
      }
    }
    return false
  }

  // 任务创建

  registerTask(task) {
    const taskId = task.id
    this.getSessionTasks(task.sessionId).set(taskId, task)
    this.emit('taskCreated', task)
    return taskId
  }

  // 创建下载任务
  createDownloadTask(sessionId, filePath, fileName, fileSize, options = {}) {
    const taskId = this.generateTaskId()
    return this.registerTask(createDownloadTask({ taskId, sessionId, filePath, fileName, fileSize, options }))
  }

  // 创建上传任务
  createUploadTask(sessionId, serverPath, fileName, fileSize, fileData, options = {}) {
    const taskId = this.generateTaskId()
    return this.registerTask(createUploadTask({
      taskId,
      sessionId,
      serverPath,
      fileName,
      fileSize,
      fileData,
      options
    }))
  }

  // 创建数据库导出任务
  createDbExportTask(sessionId, databaseName, tableCount, options = {}) {
    const taskId = this.generateTaskId()
    return this.registerTask(createDbExportTask({ taskId, sessionId, databaseName, tableCount, options }))
  }

  // 创建扫描任务
  createScanTask(sessionId, targetLabel, options = {}) {
    const taskId = this.generateTaskId()
    return this.registerTask(createScanTask({
      taskId,
      sessionId,
      targetLabel,
      options
    }))
  }

  // 开始任务
  async startTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`)
    }

    if (
      task.status === TaskStatus.DOWNLOADING ||
      task.status === TaskStatus.UPLOADING ||
      task.status === TaskStatus.DB_EXPORTING ||
      task.status === TaskStatus.SCANNING
    ) {
      throw new Error(`任务已在运行: ${taskId}`)
    }

    // 检查并发限制
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      throw new Error('已达到最大并发任务数限制')
    }

    try {
      // 根据任务类型设置正确的状态
      if (task.type === TaskType.DOWNLOAD) {
        task.status = TaskStatus.DOWNLOADING
      } else if (task.type === TaskType.UPLOAD) {
        task.status = TaskStatus.UPLOADING
      } else if (task.type === TaskType.DB_EXPORT) {
        task.status = TaskStatus.DB_EXPORTING
      } else if (task.type === TaskType.SCAN) {
        task.status = TaskStatus.SCANNING
      }

      task.startTime = Date.now()
      task.error = null
      this.activeTasks.add(taskId)

      this.emit('taskStarted', task)

      if (task.type === TaskType.DOWNLOAD) {
        await this.executeDownloadTask(task)
      } else if (task.type === TaskType.UPLOAD) {
        await this.executeUploadTask(task)
      } else if (task.type === TaskType.SCAN) {
        await this.executeScanTask(task)
      }

      // 任务完成事件由执行器发出，避免重复通知。
    } catch (error) {
      if (task.isDetached) return
      task.status = TaskStatus.FAILED
      task.error = error.message
      task.endTime = Date.now()
      this.emit('taskFailed', task, error)
      throw error
    } finally {
      this.activeTasks.delete(taskId)
    }
  }

  // 文件分块上传

  async uploadChunk(task, offset, arrayBuffer) {
    if (task.isDetached) return null
    try {
      // 将Uint8Array转换为Base64字符串
      const base64Data = this.arrayBufferToBase64(arrayBuffer)
      const params = {
        sessionId: task.sessionId,
        filePath: task.uploadPath || task.serverPath + task.fileName,
        offset: Number(offset),
        data: base64Data
      }

      const response = await uploadFileChunkApi(params)
      return response.data
    } catch (error) {
      throw new Error(`分块上传失败: ${error.message}`, { cause: error })
    }
  }

  // 任务控制

  async pauseTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return

    if (task.type === TaskType.SCAN) {
      await this.pauseScanTask(task)
    } else if (
      task.type === TaskType.DOWNLOAD &&
      task.engineTaskId &&
      task.status === TaskStatus.DOWNLOADING
    ) {
      // 下载任务：调用后端 pause，保留进度并允许恢复
      await downloadEnginePauseApi({ taskId: task.engineTaskId })
    } else if (task.type === TaskType.DB_EXPORT && task.serverTaskId) {
      task.isPaused = true
      task.status = TaskStatus.PAUSED
      await pauseSqlExportTaskApi({ taskId: task.serverTaskId })
      this.emit('taskPaused', task)
      return
    } else if (task.status !== TaskStatus.DOWNLOADING) {
      return
    }

    task.isPaused = true
    task.status = TaskStatus.PAUSED
    this.emit('taskPaused', task)
  }

  // 继续任务
  async resumeTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return

    let resumedStatus = TaskStatus.DOWNLOADING
    let restartDownload = false
    if (task.type === TaskType.SCAN) {
      await this.resumeScanTask(task)
      resumedStatus = TaskStatus.SCANNING
    } else if (task.type === TaskType.DOWNLOAD && task.engineTaskId && task.status === TaskStatus.PAUSED) {
      // 下载任务：调用后端 resume，然后让轮询继续
      await downloadEngineResumeApi({ sessionId: task.sessionId, taskId: task.engineTaskId })
      resumedStatus = TaskStatus.PENDING
      restartDownload = true
    } else if (
      task.type === TaskType.DB_EXPORT &&
      task.serverTaskId &&
      task.status === TaskStatus.PAUSED
    ) {
      if (!task.connection) {
        throw new Error('缺少数据库连接信息，无法恢复导出任务')
      }
      await resumeSqlExportTaskApi({
        sessionId: task.sessionId,
        taskId: task.serverTaskId,
        connection: task.connection
      })
      resumedStatus = TaskStatus.PENDING
    } else if (task.status !== TaskStatus.PAUSED) {
      return
    }

    task.isPaused = false
    task.status = resumedStatus
    this.emit('taskResumed', task)
    if (restartDownload) this.startTask(taskId).catch(() => {})
  }

  // 停止任务
  async stopTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return
    if (task.type === TaskType.UPLOAD && task.currentStage === 'COMMITTING') {
      throw new Error('文件正在提交，请等待提交结果')
    }

    const isScanTask = task.type === TaskType.SCAN
    if (isScanTask) {
      await this.stopScanTask(task)
    } else {
      if (task.type === TaskType.DOWNLOAD && task.engineTaskId) {
        await downloadEngineCancelApi({ taskId: task.engineTaskId })
      }
      if (task.type === TaskType.DB_EXPORT && task.serverTaskId) {
        await stopSqlExportTaskApi({ taskId: task.serverTaskId })
      }
    }

    task.isCancelled = true
    task.isPaused = false
    task.status = TaskStatus.CANCELLED
    task.endTime = Date.now()
    if (isScanTask) task.canControl = false
    this.emit('taskCancelled', task)
  }

  async retryTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`)
    }
    if (task.status !== TaskStatus.FAILED) {
      return
    }

    task.error = null
    task.lastError = null
    task.errorStage = null
    task.endTime = null
    task.isCancelled = false
    task.isPaused = false

    if (task.type === TaskType.DOWNLOAD && task.engineTaskId) {
      await downloadEngineRetryApi({
        sessionId: task.sessionId,
        taskId: task.engineTaskId
      })
    }

    task.status = TaskStatus.PENDING
    this.emit('taskRetried', task)
    this.startTask(taskId).catch(() => {})
  }

  removeTask(taskId) {
    const task = this.getTaskById(taskId)
    if (task) {
      const serverDownloadAlreadyRemoved =
        task.type === TaskType.DOWNLOAD && task.status === TaskStatus.PAUSED
      if (!TERMINAL_TASK_STATUSES.includes(task.status) && !serverDownloadAlreadyRemoved) {
        this.stopTask(taskId).catch(() => {})
      }
      this.removeTaskById(taskId)
      this.emit('taskRemoved', task)
    }
  }

  // 任务事件

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event).push(callback)
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  emit(event, ...args) {
    if (args[0]?.isDetached) return
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)

      listeners.forEach((callback) => {
        try {
          callback(...args)
        } catch {
          // 静默处理事件监听器执行失败
        }
      })
    }
  }

}

applyDownloadExecutor(TaskEngine)
applyUploadExecutor(TaskEngine)
applyScanExecutor(TaskEngine)
applyDbExportExecutor(TaskEngine)

// 创建全局任务引擎实例，确保在热重载时保持单例

let globalTaskEngine = window.__globalTaskEngine

if (!globalTaskEngine) {
  globalTaskEngine = new TaskEngine()
  window.__globalTaskEngine = globalTaskEngine
}

export const taskEngine = globalTaskEngine

const unregister = registerSessionCleanup('tasks', () => TaskEngine.prototype.detach.call(taskEngine))
if (import.meta.hot) import.meta.hot.dispose(unregister)
