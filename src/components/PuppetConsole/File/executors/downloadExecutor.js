import {
  downloadEngineStartApi,
  downloadEngineProgressApi,
  downloadEngineCancelApi
} from '@/services/api.js'
import { formatFilePath } from '@/utils/format.js'
import { TaskStatus } from '@/constants/task.js'

// 启动与轮询共用快照处理，零值和清空的错误信息也按服务端结果更新。
function applyDownloadSnapshot(task, payload = {}) {
  const snap = payload
  task.engineTaskId = snap.taskId || task.engineTaskId
  task.fileSize = Number(snap.expectedLength ?? task.fileSize ?? 0)
  task.expectedMd5 = snap.expectedMd5 ?? task.expectedMd5
  task.totalChunks = Number(snap.totalChunks ?? task.totalChunks ?? 0)
  task.completedChunksCount = Number(snap.doneChunks ?? task.completedChunksCount ?? 0)
  task.downloadedSize = Number(snap.downloadedBytes ?? task.downloadedSize ?? 0)
  task.speed = Number(snap.speedBytesPerSec ?? 0)
  task.downloadPath = snap.downloadPath ?? task.downloadPath
  task.taskTempPath = snap.taskTempPath ?? task.taskTempPath
  task.lastError = snap.lastError ?? null
  task.currentStage = snap.currentStage ?? task.currentStage
  task.errorStage = snap.errorStage ?? null
  task.progress = task.fileSize > 0 ? Math.min(100, (task.downloadedSize / task.fileSize) * 100) : 0
  return snap
}

export function applyDownloadExecutor(TaskEngine) {
  TaskEngine.prototype.executeDownloadTask = async function (task) {
    // 新逻辑：使用后端 Download Engine（断点续传 + 服务端落盘）
    const { chunkSize, concurrency } = task.options

    const remotePath = formatFilePath(task.filePath + task.fileName)

    // 启动/自动续传后端下载任务（只启动一次）
    if (!task.engineTaskId) {
      const startRes = await downloadEngineStartApi({
        sessionId: task.sessionId,
        filePath: remotePath,
        threads: Number(concurrency) || 4,
        chunkSize: Number(chunkSize) || 1048576
      })

      applyDownloadSnapshot(task, startRes.data || {})
      this.emit('taskProgress', task)
    }

    if (!task.engineTaskId) {
      throw new Error('下载引擎未返回 taskId，无法跟踪任务进度')
    }

    // 轮询进度直到完成/失败/取消；暂停后结束本轮监控，恢复时重新进入。
    const pollIntervalMs = 1000
    const maxExecutionTime = 60 * 60 * 1000 // 60 分钟
    const begin = Date.now()

    while (true) {
      // 超时保护，避免前端永远挂起
      if (Date.now() - begin > maxExecutionTime) {
        throw new Error('下载超时，请稍后重试或检查网络连接')
      }

      if (task.isCancelled) {
        // best-effort 取消后端任务（保留已下载数据）
        try {
          await downloadEngineCancelApi({ taskId: task.engineTaskId })
        } catch {
          // ignore
        }
        task.status = TaskStatus.CANCELLED
        task.endTime = Date.now()
        this.emit('taskCancelled', task)
        return
      }

      if (task.isPaused) {
        task.status = TaskStatus.PAUSED
        this.emit('taskPaused', task)
        return
      }

      const progressRes = await downloadEngineProgressApi({ taskId: task.engineTaskId })

      const snap = applyDownloadSnapshot(task, progressRes.data || {})
      const state = snap.state

      if (state === 'COMPLETED') {
        task.status = TaskStatus.COMPLETED
        task.endTime = Date.now()
        task.progress = 100
        this.emit('taskCompleted', task)
        return
      }

      if (state === 'FAILED') {
        task.status = TaskStatus.FAILED
        task.endTime = Date.now()
        task.error = task.lastError || '下载失败'
        this.emit('taskFailed', task, new Error(task.error))
        throw new Error(task.error)
      }

      if (state === 'CANCELLED') {
        task.status = TaskStatus.CANCELLED
        task.isCancelled = true
        task.endTime = Number(snap.endAtMs || Date.now())
        this.emit('taskCancelled', task)
        return
      } else if (state === 'PAUSED') {
        task.status = TaskStatus.PAUSED
        task.isPaused = true
        this.emit('taskPaused', task)
        return
      } else {
        task.status = TaskStatus.DOWNLOADING
      }

      this.emit('taskProgress', task)
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }
}
