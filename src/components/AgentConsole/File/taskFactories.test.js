import { describe, expect, it } from 'vitest'
import { TaskStatus } from '@/constants/task.js'
import { createDbExportTask, createDownloadTask, createUploadTask } from './taskFactories.js'

describe('current task factory state', () => {
  it('keeps download execution options without browser-owned chunk bookkeeping', () => {
    const task = createDownloadTask({ taskId: 'download', sessionId: 'session', filePath: '/tmp/',
      fileName: 'file', fileSize: 8, options: { chunkSize: 4, concurrency: 2, maxRetries: 99, background: false } })
    expect(task.options).toEqual({ chunkSize: 4, concurrency: 2 })
    for (const key of ['chunks', 'activeDownloads', 'totalChunks', 'completedChunksCount', 'failedChunksCount', 'retryCount']) {
      expect(task).not.toHaveProperty(key)
    }
    expect(task.status).toBe(TaskStatus.PENDING)
  })

  it('keeps upload retries including an explicit zero, without unused per-chunk state', () => {
    const task = createUploadTask({ taskId: 'upload', sessionId: 'session', serverPath: '/tmp/',
      fileName: 'file', fileSize: 3, fileData: new Blob(['abc']),
      options: { chunkSize: 1, concurrency: 2, maxRetries: 0, background: true } })
    expect(task.options).toEqual({ chunkSize: 1, concurrency: 2, maxRetries: 0 })
    for (const key of ['chunks', 'activeUploads', 'retryCount']) expect(task).not.toHaveProperty(key)
  })

  it('stores the export connection once and keeps explicit export choices', () => {
    const connection = { dialect: 'sqlite', file: '/tmp/fixture.db' }
    const task = createDbExportTask({ taskId: 'export', sessionId: 'session', databaseName: 'fixture',
      tableCount: 2, options: { connection, includeData: false, includeStructure: true, exportFormat: 'sql' } })
    expect(task.connection).toBe(connection)
    expect(task.options).toEqual({ includeData: false, includeStructure: true, exportFormat: 'sql' })
    expect(task).not.toHaveProperty('result')
    expect(task).not.toHaveProperty('retryCount')
  })
})
