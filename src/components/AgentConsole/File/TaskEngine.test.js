import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { resetSessionState } from '@/services/sessionLifecycle.js'
import { taskEngine } from './TaskEngine.js'
import { downloadEngineProgressApi, downloadEngineStartApi } from '@/services/api/agent-files.js'
import { TaskStatus } from '@/constants/task.js'

vi.hoisted(() => { globalThis.window = {} })
vi.mock('@/services/api/agent-files.js', () => Object.fromEntries([
  'deleteFileApi', 'downloadEngineCancelApi', 'downloadEnginePauseApi', 'downloadEngineProgressApi',
  'downloadEngineResumeApi', 'downloadEngineRetryApi', 'downloadEngineStartApi', 'getFileMd5Api',
  'moveFileApi', 'newFileApi', 'uploadFileChunkApi'
].map(name => [name, vi.fn()])))
vi.mock('@/services/api/scan.js', () => Object.fromEntries([
  'listNetworkProbeWorkflowTasksApi', 'pauseNetworkProbeWorkflowApi',
  'queryNetworkProbeWorkflowApi', 'resumeNetworkProbeWorkflowApi', 'stopNetworkProbeWorkflowApi'
].map(name => [name, vi.fn()])))
vi.mock('@/services/api/sql.js', () => Object.fromEntries([
  'pauseSqlExportTaskApi', 'resumeSqlExportTaskApi', 'stopSqlExportTaskApi'
].map(name => [name, vi.fn()])))

describe('task engine login scope', () => {
  beforeEach(() => {
    resetSessionState()
    vi.clearAllMocks()
  })

  afterEach(() => vi.restoreAllMocks())

  it('emits one failure event when a server download reports failure', async () => {
    const listener = vi.fn()
    taskEngine.on('taskFailed', listener)
    downloadEngineStartApi.mockResolvedValueOnce({ data: { taskId: 'server-download', state: 'RUNNING' } })
    downloadEngineProgressApi.mockResolvedValueOnce({ data: { taskId: 'server-download', state: 'FAILED', lastError: 'fixture failure' } })
    const id = taskEngine.createDownloadTask('session', '/tmp/', 'fixture.bin', 8)
    await expect(taskEngine.startTask(id)).rejects.toThrow('fixture failure')
    expect(listener).toHaveBeenCalledOnce()
    expect(taskEngine.getTaskById(id).status).toBe(TaskStatus.FAILED)
    expect(taskEngine.activeTasks.size).toBe(0)
  })

  it.each(['NEW', 'PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'])(
    'hydrates database export state from the shared engine mapping: %s', state => {
      const id = taskEngine.createDbExportTask('session', 'fixture', 1)
      taskEngine.hydrateDbExportTask(id, { taskId: 'server-export', status: state, progress: 25 })
      const expected = { NEW: TaskStatus.PENDING, PENDING: TaskStatus.PENDING, RUNNING: TaskStatus.DB_EXPORTING,
        PAUSED: TaskStatus.PAUSED, COMPLETED: TaskStatus.COMPLETED, FAILED: TaskStatus.FAILED, CANCELLED: TaskStatus.CANCELLED }
      expect(taskEngine.getTaskById(id)).toMatchObject({ serverTaskId: 'server-export', status: expected[state], progress: 25 })
    }
  )

  it('releases tasks, upload data and observers when the identity resets', () => {
    const listener = vi.fn()
    const id = taskEngine.createUploadTask('old', '/tmp/', 'file', 3, new Blob(['abc']))
    const task = taskEngine.getTaskById(id)
    taskEngine.activeTasks.add(id)
    taskEngine.on('taskProgress', listener)
    const stop = vi.spyOn(taskEngine, 'stopTask')
    resetSessionState()
    expect(task).toMatchObject({ isDetached: true, fileData: null })
    expect(taskEngine.getTaskById(id)).toBeNull()
    expect(taskEngine.sessionTasks.size).toBe(0)
    expect(taskEngine.activeTasks.size).toBe(0)
    expect(taskEngine.eventListeners.size).toBe(0)
    expect(stop).not.toHaveBeenCalled()
    taskEngine.on('taskProgress', listener)
    taskEngine.emit('taskProgress', task)
    expect(listener).not.toHaveBeenCalled()
  })

  it.each([TaskStatus.PENDING, TaskStatus.FAILED])('releases upload data when stopping a %s task', async status => {
    const id = taskEngine.createUploadTask('session', '/tmp/', 'fixture.bin', 3, new Blob(['abc']))
    const task = taskEngine.getTaskById(id)
    task.status = status
    await taskEngine.stopTask(id)
    expect(task).toMatchObject({ status: TaskStatus.CANCELLED, isCancelled: true, fileData: null })
  })

  it('isolates a late task failure from the next login and its concurrency slots', async () => {
    const oldExecution = deferred()
    const newExecution = deferred()
    vi.spyOn(taskEngine, 'executeDownloadTask')
      .mockReturnValueOnce(oldExecution.promise)
      .mockReturnValueOnce(newExecution.promise)
    const oldId = taskEngine.createDownloadTask('old', '/tmp/', 'old', 1)
    const oldRunning = taskEngine.startTask(oldId)
    resetSessionState()
    const listener = vi.fn()
    taskEngine.on('taskFailed', listener)
    const newId = taskEngine.createDownloadTask('new', '/tmp/', 'new', 1)
    const newRunning = taskEngine.startTask(newId)
    oldExecution.reject(new Error('old request failed'))
    await oldRunning
    expect(taskEngine.activeTasks.has(newId)).toBe(true)
    expect(taskEngine.getTaskById(oldId)).toBeNull()
    expect(listener).not.toHaveBeenCalled()
    newExecution.resolve()
    await newRunning
    expect(taskEngine.activeTasks.size).toBe(0)
  })
})
