import {
  uploadFileChunkApi,
  downloadEngineCancelApi,
  downloadEnginePauseApi,
  downloadEngineResumeApi,
  downloadEngineRetryApi,
  pauseSqlExportTaskApi,
  resumeSqlExportTaskApi,
  stopSqlExportTaskApi
} from '@/services/api.js'
import {
  TASK_STATUS_TEXT,
  TASK_STATUS_TONE,
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

// ============================================================================
// PART 2: 任务管理引擎 - 核心类
// ============================================================================
// 职责：
// - 按 sessionId 分组管理所有任务
// - 控制任务生命周期（创建、删除、查询）
// - 事件系统
// - 与各任务执行器协调

class TaskEngine {
  constructor() {
    this.sessionTasks = new Map() // 按sessionId分组的任务存储: Map<sessionId, Map<taskId, task>>
    this.maxConcurrentTasks = 3 // 最大并发任务数
    this.activeTasks = new Set() // 活跃任务集合
    this.taskIdCounter = 0 // 任务ID计数器
    this.eventListeners = new Map() // 事件监听器
  }

  // ========================================================================
  // 任务存储与查询
  // ========================================================================

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

  getAllTasks() {
    const allTasks = []
    for (const sessionTaskMap of this.sessionTasks.values()) {
      allTasks.push(...Array.from(sessionTaskMap.values()))
    }
    return allTasks
  }

  getAllSessionIds() {
    return Array.from(this.sessionTasks.keys())
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

  // ========================================================================
  // PART 3: 任务创建器 - 支持多种任务类型
  // ========================================================================
  // 创建 DOWNLOAD | UPLOAD | DB_EXPORT | SCAN 任务

  // 创建下载任务
  createDownloadTask(sessionId, filePath, fileName, fileSize, options = {}) {
    const taskId = this.generateTaskId()
    const task = createDownloadTask({ taskId, sessionId, filePath, fileName, fileSize, options })

    const sessionTaskMap = this.getSessionTasks(sessionId)
    sessionTaskMap.set(taskId, task)
    this.emit('taskCreated', task)

    return taskId
  }

  // 创建上传任务
  createUploadTask(sessionId, serverPath, fileName, fileSize, fileData, options = {}) {
    const taskId = this.generateTaskId()
    const task = createUploadTask({
      taskId,
      sessionId,
      serverPath,
      fileName,
      fileSize,
      fileData,
      options
    })

    const sessionTaskMap = this.getSessionTasks(sessionId)
    sessionTaskMap.set(taskId, task)
    this.emit('taskCreated', task)

    return taskId
  }

  // 创建数据库导出任务
  createDbExportTask(sessionId, databaseName, tableCount, options = {}) {
    const taskId = this.generateTaskId()
    const task = createDbExportTask({ taskId, sessionId, databaseName, tableCount, options })

    const sessionTaskMap = this.getSessionTasks(sessionId)
    sessionTaskMap.set(taskId, task)
    this.emit('taskCreated', task)

    return taskId
  }

  // 创建扫描任务
  createScanTask(sessionId, scanKind, targetLabel, totalCount = 0, options = {}) {
    const taskId = this.generateTaskId()
    const task = createScanTask({
      taskId,
      sessionId,
      scanKind,
      targetLabel,
      totalCount,
      options
    })

    const sessionTaskMap = this.getSessionTasks(sessionId)
    sessionTaskMap.set(taskId, task)
    this.emit('taskCreated', task)

    return taskId
  }

  // ========================================================================
  // PART 4: 任务生命周期管理
  // ========================================================================
  // 启动、暂停、恢复、停止、删除任务

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

      // 注意：这里不应该直接发出taskCompleted事件
      // 因为executeDownloadTask和executeUploadTask内部会处理任务完成
      // 只有在任务执行失败时才会到达这里
    } catch (error) {
      task.status = TaskStatus.FAILED
      task.error = error.message
      task.endTime = Date.now()
      this.emit('taskFailed', task, error)
      throw error
    } finally {
      this.activeTasks.delete(taskId)
    }
  }

  // ========================================================================
  // PART 5: 任务执行器 - 各任务类型的实现
  // ========================================================================
  // 每个 execute*Task() 方法是独立的任务执行逻辑
  // 由 startTask() 分发调用

  // ---- 5.1 下载任务执行器（已抽取到 executors/downloadExecutor.js）----
  // ---- 5.2 上传任务执行器（已抽取到 executors/uploadExecutor.js）----

  // ========================================================================
  // PART 6: 上传任务辅助函数
  // ========================================================================

  async uploadChunk(task, offset, arrayBuffer) {
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

  // ========================================================================
  // PART 7: 公共工具函数 - MD5、文件读取、格式化等
  // ========================================================================

  hasFileInfo(taskId) {
    const task = this.getTaskById(taskId)
    return task && task.fileSize > 0 && task.serverMD5
  }

  // ========================================================================
  // PART 8: 任务控制操作 - 暂停、继续、停止
  // ========================================================================

  async pauseTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return

    if (task.type === TaskType.SCAN) {
      await this.pauseScanTask(task)
      task.isPaused = true
      task.status = TaskStatus.PAUSED
      this.emit('taskPaused', task)
      return
    }

    // 下载任务：调用后端 pause，保留进度并允许恢复
    if (
      task.type === TaskType.DOWNLOAD &&
      task.engineTaskId &&
      task.status === TaskStatus.DOWNLOADING
    ) {
      await downloadEnginePauseApi({ taskId: task.engineTaskId })
      task.isPaused = true
      task.status = TaskStatus.PAUSED
      this.emit('taskPaused', task)
      return
    }

    if (task.type === TaskType.DB_EXPORT && task.serverTaskId) {
      task.isPaused = true
      task.status = TaskStatus.PAUSED
      await pauseSqlExportTaskApi({ taskId: task.serverTaskId })
      this.emit('taskPaused', task)
      return
    }

    // 其它任务（如旧上传）仍使用本地暂停逻辑
    if (task.status === TaskStatus.DOWNLOADING) {
      task.isPaused = true
      task.status = TaskStatus.PAUSED
      this.emit('taskPaused', task)
    }
  }

  // 继续任务
  async resumeTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return

    if (task.type === TaskType.SCAN) {
      await this.resumeScanTask(task)
      task.isPaused = false
      task.status = TaskStatus.SCANNING
      this.emit('taskResumed', task)
      return
    }

    // 下载任务：调用后端 resume，然后让轮询继续
    if (task.type === TaskType.DOWNLOAD && task.engineTaskId && task.status === TaskStatus.PAUSED) {
      await downloadEngineResumeApi({ sessionId: task.sessionId, taskId: task.engineTaskId })
      task.isPaused = false
      task.status = TaskStatus.PENDING
      this.emit('taskResumed', task)
      this.startTask(taskId).catch(() => {})
      return
    }

    if (task.type === TaskType.DB_EXPORT && task.serverTaskId && task.status === TaskStatus.PAUSED) {
      if (!task.connection) {
        throw new Error('缺少数据库连接信息，无法恢复导出任务')
      }
      await resumeSqlExportTaskApi({
        sessionId: task.sessionId,
        taskId: task.serverTaskId,
        connection: task.connection
      })
      task.isPaused = false
      task.status = TaskStatus.PENDING
      this.emit('taskResumed', task)
      return
    }

    if (task.status === TaskStatus.PAUSED) {
      task.isPaused = false
      task.status = TaskStatus.DOWNLOADING
      this.emit('taskResumed', task)
    }
  }

  // 停止任务
  async stopTask(taskId) {
    const task = this.getTaskById(taskId)
    if (!task) return

    if (task.type === TaskType.SCAN) {
      task.isCancelled = true
      task.isPaused = false
      try {
        await this.stopScanTask(task)
      } catch {
        // ignore
      }
      task.status = TaskStatus.CANCELLED
      task.endTime = Date.now()
      task.canControl = false
      this.emit('taskCancelled', task)
      return
    }

    if (task.type === TaskType.DOWNLOAD && task.engineTaskId) {
      await downloadEngineCancelApi({ taskId: task.engineTaskId })
    }

    if (task.type === TaskType.DB_EXPORT && task.serverTaskId) {
      await stopSqlExportTaskApi({ taskId: task.serverTaskId })
    }

    task.isCancelled = true
    task.isPaused = false
    task.status = TaskStatus.CANCELLED
    task.endTime = Date.now()
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

  // ========================================================================
  // PART 9: 任务查询与监控接口
  // ========================================================================

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

  getTask(taskId) {
    return this.getTaskById(taskId)
  }

  // 获取任务列表（用于显示）
  getTaskList() {
    return this.getAllTasks().map((task) => ({
      id: task.id,
      type: task.type,
      fileName: task.fileName,
      fileSize: task.fileSize,
      status: task.status,
      progress: task.progress,
      downloadedSize: task.type === TaskType.DOWNLOAD ? task.downloadedSize : 0,
      uploadedSize: task.type === TaskType.UPLOAD ? task.uploadedSize : 0,
      speed: task.speed,
      startTime: task.startTime,
      endTime: task.endTime,
      retryCount: task.retryCount,
      error: task.error,
      scanKind: task.scanKind,
      targetLabel: task.targetLabel,
      backendTaskId: task.backendTaskId
    }))
  }

  // 获取任务统计信息
  getTaskStats() {
    const tasks = this.getAllTasks()
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === TaskStatus.PENDING).length,
      downloading: tasks.filter((t) => t.status === TaskStatus.DOWNLOADING).length,
      uploading: tasks.filter((t) => t.status === TaskStatus.UPLOADING).length,
      paused: tasks.filter((t) => t.status === TaskStatus.PAUSED).length,
      scanning: tasks.filter((t) => t.status === TaskStatus.SCANNING).length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      failed: tasks.filter((t) => t.status === TaskStatus.FAILED).length,
      cancelled: tasks.filter((t) => t.status === TaskStatus.CANCELLED).length
    }
  }

  // 清理已完成的任务
  cleanupCompletedTasks() {
    const completedTasks = this.getAllTasks().filter(
      (task) =>
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.CANCELLED
    )

    completedTasks.forEach((task) => {
      this.removeTaskById(task.id)
    })
  }

  // ========================================================================
  // PART 10: 事件系统 - 观察者模式
  // ========================================================================

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

  // ========================================================================
  // PART 11: UI 辅助函数
  // ========================================================================

  // 获取状态类型（用于UI显示）
  getStatusType(status) {
    return TASK_STATUS_TONE[status] || 'info'
  }

  // 获取状态文本
  getStatusText(status) {
    return TASK_STATUS_TEXT[status] || status
  }

}

applyDownloadExecutor(TaskEngine)
applyUploadExecutor(TaskEngine)
applyScanExecutor(TaskEngine)
applyDbExportExecutor(TaskEngine)

// ============================================================================
// PART 14: 全局单例初始化
// ============================================================================
// 创建全局任务引擎实例，确保在热重载时保持单例

let globalTaskEngine = window.__globalTaskEngine

if (!globalTaskEngine) {
  globalTaskEngine = new TaskEngine()
  window.__globalTaskEngine = globalTaskEngine
}

export const taskEngine = globalTaskEngine

// 导出任务引擎实例
