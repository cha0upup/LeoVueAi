import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirmAction: vi.fn(),
  confirmDelete: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/utils/apiUtils.js', () => ({
  async executeRequest(requestFn, { loadingRef } = {}) {
    if (loadingRef) loadingRef.value = true
    try {
      return await requestFn()
    } finally {
      if (loadingRef) loadingRef.value = false
    }
  }
}))

vi.mock('@/utils/confirmUtils.js', () => ({
  confirmAction: mocks.confirmAction,
  confirmDelete: mocks.confirmDelete
}))

vi.mock('@/utils/messageUtils.js', () => ({
  showSuccess: mocks.showSuccess
}))

import { useScanTaskLifecycle } from './useScanTaskLifecycle.js'

function createLifecycle(overrides = {}) {
  const scope = effectScope()
  const sessionIdRef = ref('session-1')
  const queryApi =
    overrides.queryApi ??
    vi.fn(async () => ({
      data: { result: { status: 'RUNNING' } }
    }))
  const pauseApi = overrides.pauseApi ?? vi.fn(async () => ({}))
  const resumeApi = overrides.resumeApi ?? vi.fn(async () => ({}))
  const stopApi = overrides.stopApi ?? vi.fn(async () => ({}))
  const syncTask = overrides.syncTask ?? vi.fn()

  let lifecycle
  scope.run(() => {
    lifecycle = useScanTaskLifecycle({
      sessionIdRef,
      queryApi,
      pauseApi,
      resumeApi,
      stopApi,
      syncTask,
      pollingIntervalMs: 100,
      taskName: '测试扫描任务'
    })
  })

  return { scope, lifecycle, sessionIdRef, queryApi, pauseApi, resumeApi, stopApi, syncTask }
}

const createTask = () => ({
  taskId: 'task-1',
  status: 'RUNNING',
  result: null,
  isQuerying: false
})

describe('useScanTaskLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.confirmAction.mockResolvedValue(true)
    mocks.confirmDelete.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deduplicates overlapping result queries for the same task', async () => {
    let resolveQuery
    const queryApi = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve
        })
    )
    const { scope, lifecycle } = createLifecycle({ queryApi })
    const task = lifecycle.addTask(createTask())

    const first = lifecycle.queryResult(task.taskId)
    const second = lifecycle.queryResult(task.taskId)

    expect(second).toBe(first)
    expect(queryApi).toHaveBeenCalledTimes(1)
    expect(task.isQuerying).toBe(true)

    resolveQuery({ data: { result: { status: 'PAUSED', completed: 3 } } })
    await first

    expect(task.status).toBe('PAUSED')
    expect(task.result.completed).toBe(3)
    expect(task.isQuerying).toBe(false)
    scope.stop()
  })

  it('fetches the final result snapshot after a task is stopped', async () => {
    const finalResult = { status: 'STOPPED', completed: 8, total: 8 }
    const queryApi = vi.fn(async () => ({ data: { result: finalResult } }))
    const { scope, lifecycle, stopApi } = createLifecycle({ queryApi })
    const task = lifecycle.addTask(createTask())

    await lifecycle.stop(task.taskId)

    expect(stopApi).toHaveBeenCalledWith({ sessionId: 'session-1', taskId: 'task-1' })
    expect(queryApi).toHaveBeenCalledTimes(1)
    expect(task.status).toBe('STOPPED')
    expect(task.result).toEqual(finalResult)
    scope.stop()
  })

  it('does not apply a late query result after the task has been removed', async () => {
    let resolveQuery
    const queryApi = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve
        })
    )
    const syncTask = vi.fn()
    const { scope, lifecycle } = createLifecycle({ queryApi, syncTask })
    const task = lifecycle.addTask(createTask())
    const pendingQuery = lifecycle.queryResult(task.taskId)

    await lifecycle.remove(task.taskId)
    resolveQuery({ data: { result: { status: 'STOPPED', completed: 99 } } })
    await pendingQuery

    expect(lifecycle.tasks.value).toHaveLength(0)
    expect(syncTask).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('stops every polling timer when its effect scope is disposed', async () => {
    vi.useFakeTimers()
    const { scope, lifecycle, queryApi } = createLifecycle()
    const task = lifecycle.addTask(createTask())

    lifecycle.startPolling(task.taskId)
    await vi.advanceTimersByTimeAsync(250)
    expect(queryApi.mock.calls.length).toBeGreaterThanOrEqual(3)

    const callsBeforeDispose = queryApi.mock.calls.length
    scope.stop()
    await vi.advanceTimersByTimeAsync(500)

    expect(queryApi).toHaveBeenCalledTimes(callsBeforeDispose)
  })

  it('reports the number of tasks actually removed in a batch', () => {
    const { scope, lifecycle } = createLifecycle()
    lifecycle.addTask(createTask())

    const removed = lifecycle.batchRemove(['task-1', 'missing-task'])

    expect(removed).toBe(1)
    expect(lifecycle.tasks.value).toHaveLength(0)
    expect(mocks.showSuccess).toHaveBeenCalledWith('已删除 1 个任务')
    scope.stop()
  })

  it('resets tasks and ignores a late query after the session changes', async () => {
    let resolveQuery
    const queryApi = vi.fn(() => new Promise(resolve => { resolveQuery = resolve }))
    const { scope, lifecycle, sessionIdRef, syncTask } = createLifecycle({ queryApi })
    const task = lifecycle.addTask(createTask())
    const query = lifecycle.queryResult(task.taskId)

    sessionIdRef.value = 'session-2'
    await nextTick()
    resolveQuery({ data: { result: { status: 'STOPPED', completed: 99 } } })
    await query

    expect(lifecycle.tasks.value).toHaveLength(0)
    expect(syncTask).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('keeps the latest control state when control requests finish out of order', async () => {
    let resolvePause
    const pauseApi = vi.fn(() => new Promise(resolve => { resolvePause = resolve }))
    const { scope, lifecycle } = createLifecycle({ pauseApi })
    const task = lifecycle.addTask(createTask())

    const pausing = lifecycle.pause(task.taskId)
    await lifecycle.resume(task.taskId)
    resolvePause({})
    await pausing

    expect(task.status).toBe('RUNNING')
    scope.stop()
  })

  it('does not let a pre-stop query overwrite the final stopped snapshot', async () => {
    let resolveOldQuery
    const queryApi = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveOldQuery = resolve }))
      .mockResolvedValueOnce({ data: { result: { status: 'STOPPED', completed: 8 } } })
    const { scope, lifecycle } = createLifecycle({ queryApi })
    const task = lifecycle.addTask(createTask())

    const oldQuery = lifecycle.queryResult(task.taskId)
    const stopping = lifecycle.stop(task.taskId)
    await vi.waitFor(() => expect(queryApi).toHaveBeenCalledTimes(2))
    resolveOldQuery({ data: { result: { status: 'RUNNING', completed: 1 } } })
    await Promise.all([oldQuery, stopping])

    expect(task.status).toBe('STOPPED')
    expect(task.result).toEqual({ status: 'STOPPED', completed: 8 })
    scope.stop()
  })
})
