import {
  deleteFileApi,
  getFileMd5Api,
  moveFileApi,
  newFileApi
} from '@/services/api.js'
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

    try {
      // 同目录临时文件保证最终提交不跨文件系统。创建空文件同时完成截断，
      // 覆盖了零字节文件以及“小文件覆盖旧大文件”的场景。
      await newFileApi({
        sessionId: task.sessionId,
        path: tempPath,
        content: ''
      })
      task.currentStage = 'TRANSFERRING'

      // 计算分块数量
      const chunkSize = task.options.chunkSize
      const totalChunks = Math.ceil(task.fileSize / chunkSize)
      task.totalChunks = totalChunks

      // 创建分块任务
      const createChunkTask = async (chunkIndex, retryAttempt = 0) => {
        if (task.isCancelled) {
          throw new Error('任务已取消')
        }

        if (task.isPaused) {
          throw new Error('任务已暂停')
        }

        const offset = chunkIndex * chunkSize
        const size = Math.min(chunkSize, task.fileSize - offset)

        try {
          const chunk = task.fileData.slice(offset, offset + size)
          const arrayBuffer = await chunk.arrayBuffer()

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

        await Promise.all(batch)

        if (task.isCancelled || task.isPaused) {
          throw new Error(task.isCancelled ? '任务已取消' : '任务已暂停')
        }
      }

      task.currentStage = 'VERIFYING_LOCAL'
      const [localMD5, checksumResponse] = await Promise.all([
        this.calculateLocalFileMD5(task.fileData),
        getFileMd5Api({ sessionId: task.sessionId, path: tempPath })
      ])
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

  // 读取文件分块
  TaskEngine.prototype.readFileChunk = async function (fileData, offset, size) {
    let chunk

    // 如果是File对象，使用FileReader读取
    if (fileData instanceof File || fileData instanceof Blob) {
      chunk = await new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target.result
            const uint8Array = new Uint8Array(arrayBuffer)
            resolve(uint8Array)
          } catch {
            reject(new Error('读取文件分块失败'))
          }
        }

        reader.onerror = () => reject(new Error('读取文件分块失败'))

        // 读取指定范围的文件数据
        const blob = fileData.slice(offset, offset + size)
        reader.readAsArrayBuffer(blob)
      })
    }
    // 如果是Uint8Array，直接切片
    else if (fileData instanceof Uint8Array) {
      chunk = fileData.slice(offset, offset + size)
    }
    // 如果是字符串，直接切片
    else if (typeof fileData === 'string') {
      chunk = fileData.slice(offset, offset + size)
    }
    // 如果是ArrayBuffer，转换为Uint8Array后切片
    else if (fileData instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(fileData)
      chunk = uint8Array.slice(offset, offset + size)
    } else {
      throw new Error(`不支持的文件数据类型: ${typeof fileData}`)
    }

    // 验证分块大小
    if (!chunk || chunk.length !== size) {
      throw new Error(`分块大小不匹配: 期望=${size}, 实际=${chunk ? chunk.length : 0}`)
    }

    return chunk
  }

  // 设置服务器MD5值
  TaskEngine.prototype.setServerMD5 = function (taskId, serverMD5) {
    const task = this.getTaskById(taskId)
    if (task) {
      task.serverMD5 = serverMD5
    }
  }

  // 获取文件MD5
  TaskEngine.prototype.getFileMD5ForTask = async function (task) {
    // 如果已经有服务器MD5，直接返回
    if (task.serverMD5) {
      return task.serverMD5
    }

    try {
      const response = await getFileMd5Api({
        sessionId: task.sessionId,
        path: task.uploadPath || formatFilePath(task.filePath + task.fileName)
      })

      if (response.data.fileSize && response.data.fileSize > 0) {
        task.fileSize = response.data.fileSize
      }
      task.serverMD5 = response.data.md5 // 保存服务器MD5
      return response.data.md5
    } catch {
      // 静默处理获取MD5失败
    }
    return null
  }

  TaskEngine.prototype.getUploadedFileMD5 = async function (task) {
    const response = await getFileMd5Api({
      sessionId: task.sessionId,
      path: task.uploadPath || formatFilePath(task.serverPath + task.fileName)
    })

    const md5 = response.data.md5

    if (md5) {
      return md5
    } else {
      throw new Error('响应中未找到MD5值')
    }
  }

  // 计算本地文件的MD5
  TaskEngine.prototype.calculateLocalFileMD5 = async function (fileData) {
    // 使用与服务端一致的8KB缓冲区读取方式计算MD5
    return await this.calculateMD5LikeServer(fileData)
  }

  // 读取文件为ArrayBuffer
  TaskEngine.prototype.readFileAsArrayBuffer = async function (fileData) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        resolve(e.target.result)
      }

      reader.onerror = () => reject(new Error('读取文件失败'))

      reader.readAsArrayBuffer(fileData)
    })
  }

  // 模拟服务端8KB缓冲区读取的MD5计算
  TaskEngine.prototype.calculateMD5LikeServer = async function (fileData) {
    let arrayBuffer
    if (fileData instanceof File || fileData instanceof Blob) {
      arrayBuffer = await this.readFileAsArrayBuffer(fileData)
    } else if (fileData instanceof Uint8Array) {
      arrayBuffer = fileData.buffer
    } else if (fileData instanceof ArrayBuffer) {
      arrayBuffer = fileData
    } else {
      throw new Error('不支持的文件数据类型')
    }

    const uint8Array = new Uint8Array(arrayBuffer)
    const bufferSize = 8192 // 8KB，与服务端一致
    let offset = 0

    // 模拟服务端的8KB缓冲区读取
    const hasher = createMd5Hasher()

    while (offset < uint8Array.length) {
      const chunkSize = Math.min(bufferSize, uint8Array.length - offset)
      const chunk = uint8Array.slice(offset, offset + chunkSize)

      hasher.update(chunk)

      offset += chunkSize
    }

    const result = hasher.digest()
    return result
  }
}
