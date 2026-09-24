import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskStatus, TaskType } from '@/constants/task.js'

vi.mock('@/services/api.js', () => ({
  pauseNetworkProbeWorkflowApi: vi.fn(),
  resumeNetworkProbeWorkflowApi: vi.fn(),
  stopNetworkProbeWorkflowApi: vi.fn(),
  queryNetworkProbeWorkflowApi: vi.fn(),
  listNetworkProbeWorkflowTasksApi: vi.fn()
}))

import { applyScanExecutor } from './scanExecutor.js'
import { queryNetworkProbeWorkflowApi, stopNetworkProbeWorkflowApi, listNetworkProbeWorkflowTasksApi } from '@/services/api.js'

describe('scan executor request lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('window', {}) })
  afterEach(() => vi.unstubAllGlobals())

  async function fixture() {
    const { taskEngine } = await import('../TaskEngine.js')
    const engine = new taskEngine.constructor()
    const id = engine.createScanTask('session', 'network_workflow', 'scan', 3, { backendTaskId: 'backend' })
    engine.hydrateScanTask(id, { status: 'RUNNING' })
    return { engine, task: engine.getTaskById(id) }
  }

  it('does not overwrite a successful stop with an older query', async () => {
    const { engine, task } = await fixture()
    let finishQuery
    queryNetworkProbeWorkflowApi.mockImplementationOnce(() => new Promise(resolve => { finishQuery = resolve }))
    const pending = engine.queryScanTask(task)
    await engine.stopTask(task.id)
    finishQuery({ data: { status: 'RUNNING', progress: 10 } })
    await expect(pending).resolves.toBeNull()
    expect(task.status).toBe(TaskStatus.CANCELLED)
  })

  it('preserves a running task and surfaces a failed stop', async () => {
    const { engine, task } = await fixture()
    stopNetworkProbeWorkflowApi.mockRejectedValueOnce(new Error('node unavailable'))
    await expect(engine.stopTask(task.id)).rejects.toThrow('node unavailable')
    expect(task.status).toBe(TaskStatus.SCANNING)
    expect(task.isCancelled).toBe(false)
    expect(task.endTime).toBeNull()
  })

  it('ignores a query after its local task was removed', async () => {
    const { engine, task } = await fixture()
    let finishQuery
    queryNetworkProbeWorkflowApi.mockImplementationOnce(() => new Promise(resolve => { finishQuery = resolve }))
    const pending = engine.queryScanTask(task)
    engine.removeTaskById(task.id)
    finishQuery({ data: { status: 'STOPPED', outcome: 'COMPLETED' } })
    await expect(pending).resolves.toBeNull()
    expect(task.status).toBe(TaskStatus.SCANNING)
  })

  it('does not restore tasks into a destroyed session from a late list response', async () => {
    const { engine } = await fixture()
    let finishList
    listNetworkProbeWorkflowTasksApi.mockImplementationOnce(() => new Promise(resolve => { finishList = resolve }))
    const pending = engine.syncNetworkWorkflowTasks('session')
    engine.sessionTasks.delete('session')
    finishList({ data: { tasks: [{ taskId: 'backend', status: 'RUNNING' }] } })
    await expect(pending).resolves.toEqual([])
    expect(engine.sessionTasks.has('session')).toBe(false)
  })

  it('does not recreate a removed task from an earlier list response', async () => {
    const { engine, task } = await fixture()
    let finishList
    listNetworkProbeWorkflowTasksApi.mockImplementationOnce(() => new Promise(resolve => { finishList = resolve }))
    const pending = engine.syncNetworkWorkflowTasks('session')
    engine.removeTaskById(task.id)
    finishList({ data: { tasks: [{ taskId: 'backend', status: 'RUNNING' }] } })
    await expect(pending).resolves.toEqual([])
    expect(engine.getTasksBySession('session')).toEqual([])
  })
})

describe('scan executor task hydration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hydrates a running canonical workflow snapshot', () => {
    const task = {
      id: 'local-task',
      type: TaskType.SCAN,
      scanKind: 'network_workflow',
      status: TaskStatus.SCANNING,
      progress: 10,
      targetCount: 1,
      processedCount: 0
    }
    const events = []
    class FakeTaskEngine {
      getTaskById(taskId) { return taskId === task.id ? task : null }
      emit(...event) { events.push(event) }
    }
    applyScanExecutor(FakeTaskEngine)

    const engine = new FakeTaskEngine()
    engine.hydrateScanTask(task.id, {
      taskId: 'backend-task',
      scanKind: 'network_workflow',
      status: 'RUNNING',
      progress: 30
    })

    expect(task.scanKind).toBe('network_workflow')
    expect(task.backendTaskId).toBe('backend-task')
    expect(task.status).toBe(TaskStatus.SCANNING)
    expect(events.at(-1)?.[0]).toBe('taskProgress')
  })

  it('clears the current stage and completes target progress from a durable terminal snapshot', () => {
    const task = {
      id: 'local-task',
      type: TaskType.SCAN,
      scanKind: 'network_workflow',
      status: TaskStatus.SCANNING,
      currentStage: 'REACHABILITY',
      progress: 87,
      targetCount: 1,
      processedCount: 0
    }
    class FakeTaskEngine {
      getTaskById(taskId) { return taskId === task.id ? task : null }
      emit() {}
    }
    applyScanExecutor(FakeTaskEngine)

    const engine = new FakeTaskEngine()
    engine.hydrateScanTask(task.id, {
      taskId: 'backend-task',
      scanKind: 'network_workflow',
      status: 'STOPPED',
      outcome: 'COMPLETED',
      currentStage: null,
      progress: 100,
      targetCount: 1
    })

    expect(task.status).toBe(TaskStatus.COMPLETED)
    expect(task.currentStage).toBeNull()
    expect(task.processedCount).toBe(1)
  })
})
