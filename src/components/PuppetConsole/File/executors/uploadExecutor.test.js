import { deferred } from '@/test-support/deferred.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskStatus } from '@/constants/task.js'
import { applyUploadExecutor } from './uploadExecutor.js'
import { createUploadTask } from '../taskFactories.js'
import { deleteFileApi, getFileMd5Api, moveFileApi, newFileApi } from '@/services/api.js'

vi.mock('@/services/api.js', () => ({
  deleteFileApi: vi.fn(),
  getFileMd5Api: vi.fn(),
  moveFileApi: vi.fn(),
  newFileApi: vi.fn()
}))
function fixture(content = 'abc') {
  class Engine {}
  applyUploadExecutor(Engine)
  const engine = new Engine()
  engine.emit = vi.fn()
  engine.uploadChunk = vi.fn().mockResolvedValue({ bytesWritten: 1 })
  const task = createUploadTask({
    taskId: 'test-upload',
    sessionId: 's',
    serverPath: '/tmp/',
    fileName: 'file',
    fileSize: content.length,
    fileData: new Blob([content]),
    options: { chunkSize: 1, concurrency: 3, maxRetries: 0 }
  })
  task.status = TaskStatus.UPLOADING
  task.startTime = Date.now()
  return { engine, task }
}
beforeEach(() => vi.resetAllMocks())
describe('upload commit lifecycle', () => {
  it('does not commit when cancelled during checksum verification', async () => {
    const { engine, task } = fixture()
    const checksum = deferred()
    const started = deferred()
    getFileMd5Api.mockImplementation(() => {
      started.resolve()
      return checksum.promise
    })
    const running = engine.executeUploadTask(task)
    await started.promise
    task.isCancelled = true
    checksum.resolve({ data: { md5: '900150983cd24fb0d6963f7d28e17f72' } })
    await running
    expect(moveFileApi).not.toHaveBeenCalled()
    expect(deleteFileApi).toHaveBeenCalledOnce()
    expect(task.status).toBe(TaskStatus.CANCELLED)
  })
  it('waits for every pending write before removing a failed upload', async () => {
    const { engine, task } = fixture('ab')
    const first = deferred()
    const second = deferred()
    const started = deferred()
    engine.uploadChunk
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => {
        started.resolve()
        return second.promise
      })
    const running = engine.executeUploadTask(task)
    await started.promise
    first.reject(new Error('write failed'))
    await Promise.resolve()
    expect(deleteFileApi).not.toHaveBeenCalled()
    second.resolve({ bytesWritten: 1 })
    await running
    expect(deleteFileApi).toHaveBeenCalledOnce()
    expect(moveFileApi).not.toHaveBeenCalled()
    expect(task.status).toBe(TaskStatus.FAILED)
  })
  it('commits an empty file only after verification', async () => {
    const { engine, task } = fixture('')
    getFileMd5Api.mockResolvedValue({ data: { md5: 'd41d8cd98f00b204e9800998ecf8427e' } })
    await engine.executeUploadTask(task)
    expect(newFileApi).toHaveBeenCalledOnce()
    expect(moveFileApi).toHaveBeenCalledOnce()
    expect(engine.uploadChunk).not.toHaveBeenCalled()
    expect(task.status).toBe(TaskStatus.COMPLETED)
  })
  it('hashes blobs in bounded slices and respects typed-array offsets', async () => {
    const { engine } = fixture()
    const blob = new Blob(['abc'])
    const fullRead = vi.spyOn(blob, 'arrayBuffer')
    expect(await engine.calculateLocalFileMD5(blob)).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(fullRead).not.toHaveBeenCalled()
    const bytes = new TextEncoder().encode('xabcx')
    expect(await engine.calculateLocalFileMD5(bytes.subarray(1, 4))).toBe(
      '900150983cd24fb0d6963f7d28e17f72'
    )
  })
})
