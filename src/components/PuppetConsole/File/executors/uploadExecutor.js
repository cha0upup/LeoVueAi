import { deleteFileApi, getFileMd5Api, moveFileApi, newFileApi } from '@/services/api.js'
import { formatFilePath } from '@/utils/format.js'
import { createMd5Hasher } from '@/utils/md5.js'
import { TaskStatus } from '@/constants/task.js'

export function applyUploadExecutor(TaskEngine) {
  TaskEngine.prototype.executeUploadTask = async function (task) {
    if (task.status !== TaskStatus.UPLOADING) {
      return
    }

    task.progress = 0
    task.uploadedSize = 0
    task.speed = 0
    task.chunks = []
    task.activeUploads = new Set()
    task.isPaused = false
    task.isCancelled = false
    task.retryCount = 0
    task.error = null
    task.errorStage = null
    task.currentStage = 'PREPARING'
    const finalPath = formatFilePath(task.serverPath + task.fileName)
    const separatorIndex = finalPath.lastIndexOf('/')
    const parentPrefix = separatorIndex >= 0 ? finalPath.slice(0, separatorIndex + 1) : ''
    const tempPath = `${parentPrefix}.leo-upload-${task.id.slice(-12)}.part`
    task.uploadPath = tempPath
    const checkCancelled = () => {
      if (task.isCancelled || task.isPaused) {
        throw new Error(task.isCancelled ? '任务已取消' : '任务已暂停')
      }
    }

    try {
      // 同目录临时文件保证最终提交不跨文件系统。创建空文件同时完成截断，
      // 覆盖了零字节文件以及“小文件覆盖旧大文件”的场景。
      await newFileApi({
        sessionId: task.sessionId,
        path: tempPath,
        content: ''
      })
      checkCancelled()
      task.currentStage = 'TRANSFERRING'

      // 计算分块数量
      const chunkSize = task.options.chunkSize
      const totalChunks = Math.ceil(task.fileSize / chunkSize)
      task.totalChunks = totalChunks

      // 创建分块任务
      const createChunkTask = async (chunkIndex, retryAttempt = 0) => {
        checkCancelled()

        const offset = chunkIndex * chunkSize
        const size = Math.min(chunkSize, task.fileSize - offset)

        try {
          const chunk = task.fileData.slice(offset, offset + size)
          const arrayBuffer = await chunk.arrayBuffer()

          checkCancelled()
          const result = await this.uploadChunk(task, offset, arrayBuffer)

          if (result && !task.isCancelled) {
            task.chunks[chunkIndex] = {
              offset: offset,
              size: size,
              index: chunkIndex,
              uploaded: true
            }

            task.uploadedSize += size
            task.progress = (task.uploadedSize / task.fileSize) * 100

            const elapsed = (Date.now() - task.startTime) / 1000
            task.speed = task.uploadedSize / elapsed

            this.emit('taskProgress', task)
          }
        } catch (error) {
          if (task.isCancelled || task.isPaused) {
            throw error
          }
          if (retryAttempt < task.options.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (retryAttempt + 1)))
            return createChunkTask(chunkIndex, retryAttempt + 1)
          } else {
            throw error
          }
        }
      }

      // 并发上传分块
      const concurrency = task.options.concurrency
      for (let i = 0; i < totalChunks; i += concurrency) {
        const batch = []
        for (let j = 0; j < concurrency && i + j < totalChunks; j++) {
          const chunkIndex = i + j
          batch.push(createChunkTask(chunkIndex))
        }

        // 等待所有在途写入结束后再清理临时文件。
        const results = await Promise.allSettled(batch)
        const failure = results.find((result) => result.status === 'rejected')
        if (failure) throw failure.reason

        checkCancelled()
      }

      task.currentStage = 'VERIFYING_LOCAL'
      const [localMD5, checksumResponse] = await Promise.all([
        this.calculateLocalFileMD5(task.fileData),
        getFileMd5Api({ sessionId: task.sessionId, path: tempPath })
      ])
      checkCancelled()
      task.currentStage = 'VERIFYING_REMOTE'
      const serverMD5 = checksumResponse.data?.md5
      const verified = Boolean(serverMD5) && localMD5.toLowerCase() === serverMD5.toLowerCase()
      this.emit('md5Verified', {
        taskId: task.id,
        fileName: task.fileName,
        localMD5,
        serverMD5,
        verified,
        method: 'MD5'
      })
      if (!verified) {
        throw new Error(`上传完整性校验失败: local=${localMD5}, remote=${serverMD5 || 'missing'}`)
      }

      // 校验通过后再将临时文件提交为最终文件。
      checkCancelled()
      task.currentStage = 'COMMITTING'
      await moveFileApi({
        sessionId: task.sessionId,
        path: tempPath,
        newPath: finalPath,
        conflictStrategy: 'overwrite'
      })
      task.uploadPath = null
      task.serverMD5 = serverMD5

      // 任务完成
      task.status = TaskStatus.COMPLETED
      task.currentStage = 'FINISHED'
      task.endTime = Date.now()
      task.progress = 100
      task.uploadedSize = task.fileSize

      const duration = (task.endTime - task.startTime) / 1000
      const avgSpeed = task.fileSize / duration
      task.speed = avgSpeed

      this.emit('taskCompleted', task)
    } catch (error) {
      if (task.uploadPath) {
        try {
          await deleteFileApi({
            sessionId: task.sessionId,
            path: task.uploadPath
          })
        } catch {
          // 清理失败不覆盖原始上传错误。
        }
        task.uploadPath = null
      }
      task.endTime = Date.now()
      task.error = error.message
      task.errorStage = task.currentStage
      if (task.isCancelled) {
        task.status = TaskStatus.CANCELLED
        this.emit('taskCancelled', task)
      } else {
        task.status = TaskStatus.FAILED
        this.emit('taskFailed', task)
      }
    }
  }

  // 将ArrayBuffer转换为Base64字符串
  TaskEngine.prototype.arrayBufferToBase64 = function (buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }

    return btoa(binary)
  }

  // 每次读取最多 1 MiB；摘要结果与服务端一致。
  TaskEngine.prototype.calculateLocalFileMD5 = async function (fileData) {
    const hasher = createMd5Hasher()
    const chunkSize = 1024 * 1024
    if (fileData instanceof Blob) {
      for (let offset = 0; offset < fileData.size; offset += chunkSize) {
        const buffer = await fileData.slice(offset, offset + chunkSize).arrayBuffer()
        hasher.update(new Uint8Array(buffer))
      }
    } else if (fileData instanceof Uint8Array || fileData instanceof ArrayBuffer) {
      const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData)
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        hasher.update(bytes.subarray(offset, offset + chunkSize))
      }
    } else {
      throw new Error('不支持的文件数据类型')
    }
    return hasher.digest()
  }
}
