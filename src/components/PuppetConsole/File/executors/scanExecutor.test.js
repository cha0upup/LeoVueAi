import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskStatus } from '@/constants/task.js'
import { createScanTask } from '../taskFactories.js'

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
    const id = engine.createScanTask('session', 'scan', { targetCount: 3, backendTaskId: 'backend' })
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

  it('restores a persisted workflow using target counts and canonical local state', async () => {
    const { engine } = await fixture()
    const createdAt = '2026-09-27T10:00:00Z'
    listNetworkProbeWorkflowTasksApi.mockResolvedValueOnce({ data: { tasks: [{
      taskId: 'restored',
      name: '历史扫描',
      status: 'STOPPED',
      outcome: 'COMPLETED',
      targetCount: 24,
      stageCount: 3,
      currentStage: null,
      createdAt
    }] } })

    const [task] = await engine.syncNetworkWorkflowTasks('session')

    expect(task).toMatchObject({
      backendTaskId: 'restored',
      scanKind: 'network_workflow',
      targetLabel: '历史扫描',
      fileName: '一键扫描 · 历史扫描',
      targetCount: 24,
      processedCount: 24,
      status: TaskStatus.COMPLETED,
      progress: 100,
      currentStage: null,
      createdAt: Date.parse(createdAt),
      reachableHostCount: 0,
      reachabilityLoaded: false
    })
  })
})

describe('scan executor task hydration', () => {
  beforeEach(() => vi.clearAllMocks())

  function fixture() {
    const task = createScanTask({
      taskId: 'local-task',
      sessionId: 'session',
      targetLabel: 'scan',
      options: { targetCount: 1 }
    })
    Object.assign(task, {
      status: TaskStatus.SCANNING,
      progress: 10
    })
    const events = []
    class FakeTaskEngine {
      getTaskById(taskId) { return taskId === task.id ? task : null }
      emit(...event) { events.push(event) }
    }
    applyScanExecutor(FakeTaskEngine)

    return { engine: new FakeTaskEngine(), task, events }
  }

  it('hydrates a running canonical workflow snapshot', () => {
    const { engine, task, events } = fixture()
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
    const { engine, task } = fixture()
    Object.assign(task, {
      currentStage: 'REACHABILITY',
      progress: 87
    })
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

  it('preserves progress and summary counts across partial pause and resume snapshots', () => {
    const { engine, task, events } = fixture()
    const hosts = ['10.0.0.1', '10.0.0.2']
    engine.hydrateScanTask(task.id, {
      status: 'RUNNING',
      progress: 67,
      currentStage: 'PORT_SCAN',
      targetCount: 50,
      reachableHostCount: 40,
      reachableHostList: hosts,
      openCount: 9,
      serviceCount: 5,
      fingerprintCount: 3,
      identifiedApplicationCount: 2
    })
    engine.hydrateScanTask(task.id, { status: 'PAUSED' })

    expect(task).toMatchObject({
      status: TaskStatus.PAUSED,
      progress: 67,
      currentStage: 'PORT_SCAN',
      targetCount: 50,
      reachableHostCount: 40,
      reachableHostList: hosts,
      reachabilityLoaded: true,
      openCount: 9,
      serviceCount: 5,
      fingerprintCount: 3,
      identifiedApplicationCount: 2
    })
    expect(events.at(-1)?.[0]).toBe('taskPaused')

    engine.hydrateScanTask(task.id, { status: 'RUNNING' })
    expect(task.status).toBe(TaskStatus.SCANNING)
    expect(task.progress).toBe(67)
    expect(events.at(-1)?.[0]).toBe('taskResumed')
  })

  it('applies explicit zero counts and empty results without retaining older values', () => {
    const { engine, task } = fixture()
    Object.assign(task, {
      reachableHostCount: 4, reachableHostList: ['10.0.0.1'],
      openCount: 3, serviceCount: 2, fingerprintCount: 2,
      identifiedApplicationCount: 1
    })
    engine.hydrateScanTask(task.id, {
      reachableHostCount: 0, reachableHostList: [],
      openCount: 0, serviceCount: 0, fingerprintCount: 0,
      identifiedApplicationCount: 0
    })

    expect(task).toMatchObject({
      reachableHostCount: 0, reachableHostList: [], reachabilityLoaded: true,
      openCount: 0, serviceCount: 0, fingerprintCount: 0,
      identifiedApplicationCount: 0
    })
    expect(task.progress).toBe(10)
  })
})
