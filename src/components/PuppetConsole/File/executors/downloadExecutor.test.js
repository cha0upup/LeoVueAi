import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDownloadExecutor } from './downloadExecutor.js'
import { downloadEngineProgressApi, downloadEngineStartApi } from '@/services/api.js'
import { TaskStatus } from '@/constants/task.js'

vi.mock('@/services/api.js', () => ({
  downloadEngineStartApi: vi.fn(),
  downloadEngineProgressApi: vi.fn(),
  downloadEngineCancelApi: vi.fn()
}))

class Engine {
  emit = vi.fn()
}
applyDownloadExecutor(Engine)
afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('download finalization', () => {
  it.each([false, true])(
    'applies zero progress and cleared errors from snapshots (wrapped=%s)',
    async (wrapped) => {
      const response = (snapshot) => ({
        data: wrapped
          ? {
              taskId: snapshot.taskId,
              state: snapshot.state,
              meta: snapshot
            }
          : snapshot
      })
      const engine = new Engine()
      const task = {
        options: {},
        sessionId: 's',
        filePath: '/tmp/',
        fileName: 'file',
        status: TaskStatus.DOWNLOADING
      }
      const emitted = []
      engine.emit.mockImplementation((event, value) => emitted.push({ event, ...value }))
      downloadEngineStartApi.mockResolvedValue(
        response({
          taskId: 'd',
          state: 'RUNNING',
          expectedLength: 10,
          downloadedBytes: 8,
          totalChunks: 5,
          doneChunks: 4,
          speedBytesPerSec: 8,
          lastError: 'old error',
          errorStage: 'TRANSFERRING',
          downloadPath: 'downloads/file'
        })
      )
      downloadEngineProgressApi.mockResolvedValue(
        response({
          taskId: 'd',
          state: 'PAUSED',
          expectedLength: 0,
          downloadedBytes: 0,
          totalChunks: 0,
          doneChunks: 0,
          speedBytesPerSec: 0,
          lastError: null,
          errorStage: null
        })
      )
      await engine.executeDownloadTask(task)
      expect(emitted[0]).toMatchObject({ event: 'taskProgress', fileSize: 10, progress: 80 })
      expect(task).toMatchObject({
        engineTaskId: 'd',
        status: TaskStatus.PAUSED,
        fileSize: 0,
        downloadedSize: 0,
        totalChunks: 0,
        completedChunksCount: 0,
        speed: 0,
        progress: 0,
        lastError: null,
        errorStage: null,
        downloadPath: 'downloads/file'
      })
      expect(downloadEngineProgressApi).toHaveBeenCalledWith({ taskId: 'd' })
    }
  )

  it('completes an empty file only when the server reports completion', async () => {
    const engine = new Engine()
    const task = { engineTaskId: 'd', options: {}, filePath: '/tmp/', fileName: 'empty' }
    downloadEngineProgressApi.mockResolvedValue({
      data: { state: 'COMPLETED', expectedLength: 0, downloadedBytes: 0 }
    })
    await engine.executeDownloadTask(task)
    expect(task).toMatchObject({ status: TaskStatus.COMPLETED, fileSize: 0, progress: 100 })
    expect(engine.emit).toHaveBeenCalledExactlyOnceWith('taskCompleted', task)
  })

  it('waits for verification even at 100% and reports a later checksum failure', async () => {
    vi.useFakeTimers()
    const engine = new Engine()
    const task = {
      engineTaskId: 'd',
      options: {},
      filePath: '/tmp/',
      fileName: 'file',
      status: TaskStatus.DOWNLOADING
    }
    const transferred = { expectedLength: 5, downloadedBytes: 5, downloadPath: 'downloads/file' }
    downloadEngineProgressApi
      .mockResolvedValueOnce({
        data: { ...transferred, state: 'RUNNING', currentStage: 'VERIFYING_LOCAL' }
      })
      .mockResolvedValueOnce({
        data: { ...transferred, state: 'FAILED', lastError: 'checksum mismatch' }
      })
    const pending = engine.executeDownloadTask(task)
    const rejection = expect(pending).rejects.toThrow('checksum mismatch')
    await Promise.resolve()
    expect(task.status).toBe(TaskStatus.DOWNLOADING)
    expect(engine.emit.mock.calls.some(([event]) => event === 'taskCompleted')).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    await rejection
    expect(task.status).toBe(TaskStatus.FAILED)
    expect(engine.emit.mock.calls.some(([event]) => event === 'taskCompleted')).toBe(false)
  })
})
