import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { resetSessionState } from '@/services/sessionLifecycle.js'
import { taskEngine } from './TaskEngine.js'

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
