import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskStatus } from '@/constants/task.js'
import { createScanTask } from '../taskFactories.js'
import { deferred } from '@/test-support/deferred.js'

vi.mock('@/services/http.js', () => ({ default: { post: vi.fn() } }))
vi.mock('@/services/api/scan.js', () => ({
  pauseNetworkProbeWorkflowApi: vi.fn(),
  resumeNetworkProbeWorkflowApi: vi.fn(),
  stopNetworkProbeWorkflowApi: vi.fn(),
  queryNetworkProbeWorkflowApi: vi.fn(),
  listNetworkProbeWorkflowTasksApi: vi.fn()
}))

import { applyScanExecutor } from './scanExecutor.js'
import {
  queryNetworkProbeWorkflowApi,
  stopNetworkProbeWorkflowApi,
  listNetworkProbeWorkflowTasksApi
} from '@/services/api/scan.js'

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
    const next = deferred()
    queryNetworkProbeWorkflowApi.mockReturnValueOnce(next.promise)
    const current = engine.queryScanTask(task)
    finishQuery({ data: { status: 'RUNNING', progress: 10 } })
    await expect(pending).resolves.toBeNull()
    const duplicate = engine.queryScanTask(task)
    expect(queryNetworkProbeWorkflowApi).toHaveBeenCalledTimes(2)
    next.resolve({ data: { status: 'STOPPED', outcome: 'CANCELLED' } })
    await Promise.all([current, duplicate])
    expect(task.status).toBe(TaskStatus.CANCELLED)
  })

  it('coalesces failed queries and allows a fresh retry', async () => {
    const { engine, task } = await fixture()
    const waiting = deferred()
    queryNetworkProbeWorkflowApi.mockReturnValueOnce(waiting.promise)
    const results = Promise.allSettled([engine.queryScanTask(task), engine.queryScanTask(task)])
    expect(queryNetworkProbeWorkflowApi).toHaveBeenCalledTimes(1)
    waiting.reject(new Error('offline'))
    expect(await results).toMatchObject([{ status: 'rejected' }, { status: 'rejected' }])
    queryNetworkProbeWorkflowApi.mockResolvedValueOnce({ data: { status: 'RUNNING', progress: 25 } })
    await engine.queryScanTask(task)
    expect(queryNetworkProbeWorkflowApi).toHaveBeenCalledTimes(2)
    expect(task.progress).toBe(25)
  })

  it('preserves a running task and surfaces a failed stop', async () => {
    const { engine, task } = await fixture()
    stopNetworkProbeWorkflowApi.mockRejectedValueOnce(new Error('node unavailable'))
    await expect(engine.stopTask(task.id)).rejects.toThrow('node unavailable')
    expect(task.status).toBe(TaskStatus.SCANNING)
    expect(task.isCancelled).toBe(false)
    expect(task.endTime).toBeNull()
  })

  it.each(['removed', 'detached'])('ignores a query after its local task was %s', async (action) => {
    const { engine, task } = await fixture()
    let finishQuery
    queryNetworkProbeWorkflowApi.mockImplementationOnce(() => new Promise(resolve => { finishQuery = resolve }))
    const pending = engine.queryScanTask(task)
    if (action === 'detached') engine.detach()
    else engine.removeTaskById(task.id)
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
    await expect(pending).resolves.toMatchObject({ tasks: [] })
    expect(engine.sessionTasks.has('session')).toBe(false)
  })

  it('does not recreate a removed task from an earlier list response', async () => {
    const { engine, task } = await fixture()
    let finishList
    listNetworkProbeWorkflowTasksApi.mockImplementationOnce(() => new Promise(resolve => { finishList = resolve }))
    const pending = engine.syncNetworkWorkflowTasks('session')
    engine.removeTaskById(task.id)
    finishList({ data: { tasks: [{ taskId: 'backend', status: 'RUNNING' }] } })
    await expect(pending).resolves.toMatchObject({ tasks: [] })
    expect(engine.getTasksBySession('session')).toEqual([])
  })

  it('passes cursors and live scope while preserving already loaded pages', async () => {
    const { engine, task } = await fixture()
    listNetworkProbeWorkflowTasksApi.mockResolvedValueOnce({ data: {
      tasks: [{ taskId: 'older', status: 'FAILED', reachableHostCount: 3 }],
      hasMore: true, nextCursor: 'next'
    } })
    const page = await engine.syncNetworkWorkflowTasks('session', { scope: 'active', cursor: 'before' })
    expect(listNetworkProbeWorkflowTasksApi).toHaveBeenCalledWith({
      sessionId: 'session', scope: 'active', cursor: 'before', pageSize: 100
    })
    expect(page).toMatchObject({ hasMore: true, nextCursor: 'next', tasks: [{
      backendTaskId: 'older', status: TaskStatus.FAILED, detailsLoaded: false
    }] })
    expect(engine.getTaskById(task.id)).toBe(task)
  })

  it('invalidates cached details when a list summary reports a terminal transition', async () => {
    const { engine, task } = await fixture()
    task.detailsLoaded = true
    listNetworkProbeWorkflowTasksApi.mockResolvedValueOnce({ data: { tasks: [{
      taskId: 'backend', status: 'STOPPED', outcome: 'COMPLETED'
    }] } })
    await engine.syncNetworkWorkflowTasks('session')
    expect(task).toMatchObject({ status: TaskStatus.COMPLETED, detailsLoaded: false })
  })

  it('does not let an older summary overwrite newly loaded full details', async () => {
    const { engine, task } = await fixture()
    let finishList
    listNetworkProbeWorkflowTasksApi.mockImplementationOnce(() => new Promise(resolve => { finishList = resolve }))
    const pending = engine.syncNetworkWorkflowTasks('session')
    queryNetworkProbeWorkflowApi.mockResolvedValueOnce({ data: {
      status: 'STOPPED', outcome: 'FAILED', error: 'detail error', reachableHostList: []
    } })
    await engine.queryScanTask(task)
    finishList({ data: { tasks: [{ taskId: 'backend', status: 'RUNNING' }] } })
    await pending
    expect(task).toMatchObject({ status: TaskStatus.FAILED, error: 'detail error', detailsLoaded: true })
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

    const { tasks: [task] } = await engine.syncNetworkWorkflowTasks('session')

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
      detailsLoaded: false
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

  it('counts probe work separately from hosts and preserves it across partial snapshots', () => {
    const { engine, task } = fixture()
    engine.hydrateScanTask(task.id, {
      status: 'RUNNING', targetCount: 2,
      stages: [{ name: 'REACHABILITY', completed: 10, total: 10 }, { name: 'PORT_SCAN', completed: 60, total: 200 }]
    })
    expect(task).toMatchObject({ probeCompleted: 70, targetCount: 2 })
    engine.hydrateScanTask(task.id, { status: 'PAUSED' })
    expect(task.probeCompleted).toBe(70)
    expect(task.stages[1].total).toBe(200)
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
      reachableHostCount: 0, reachableHostList: [],
      openCount: 0, serviceCount: 0, fingerprintCount: 0,
      identifiedApplicationCount: 0
    })
    expect(task.progress).toBe(10)
  })
})
