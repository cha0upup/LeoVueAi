import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { TaskStatus, TaskType } from '@/constants/task.js'
import { useAssetDiscoveryTasks } from './useAssetDiscoveryTasks.js'

const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const task = (id, sessionId, status = TaskStatus.SCANNING) => ({
  id,
  sessionId,
  status,
  type: TaskType.SCAN,
  scanKind: 'network_workflow',
  createdAt: 1
})

function fixture(initialTasks) {
  const listeners = new Map()
  const engine = {
    tasks: initialTasks,
    getTasksBySession: (sessionId) => engine.tasks.filter((item) => item.sessionId === sessionId),
    syncNetworkWorkflowTasks: vi.fn().mockResolvedValue([]),
    queryScanTask: vi.fn().mockResolvedValue({}),
    on: (name, listener) => listeners.set(name, listener),
    off: (name) => listeners.delete(name),
    emit: (name, value) => listeners.get(name)?.(value)
  }
  const sessionId = ref('one')
  const scope = effectScope()
  const errors = vi.fn()
  const view = scope.run(() =>
    useAssetDiscoveryTasks({ sessionId, taskEngine: engine, onError: errors })
  )
  return { scope, engine, sessionId, view, errors, listeners }
}

describe('asset discovery task synchronization', () => {
  let current
  afterEach(() => {
    current?.scope.stop()
    vi.useRealTimers()
  })

  it('coalesces refreshes and waits for completion before polling again', async () => {
    vi.useFakeTimers()
    current = fixture([task('scan', 'one')])
    const waiting = deferred()
    current.engine.syncNetworkWorkflowTasks.mockReturnValueOnce(waiting.promise)
    const first = current.view.syncTasks()
    expect(current.view.syncTasks()).toBe(first)
    await vi.advanceTimersByTimeAsync(6000)
    expect(current.engine.syncNetworkWorkflowTasks).toHaveBeenCalledTimes(1)
    expect(current.engine.queryScanTask).not.toHaveBeenCalled()
    waiting.resolve([])
    await first
    await vi.advanceTimersByTimeAsync(2000)
    expect(current.engine.queryScanTask).toHaveBeenCalledTimes(2)
    expect(current.engine.syncNetworkWorkflowTasks).toHaveBeenCalledTimes(1)
    current.scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(current.listeners.size).toBe(0)
  })

  it('ignores old-session responses and never resumes polling after disposal', async () => {
    vi.useFakeTimers()
    current = fixture([task('old', 'one'), task('new', 'two')])
    const waiting = deferred()
    current.engine.syncNetworkWorkflowTasks.mockReturnValueOnce(waiting.promise)
    const old = current.view.syncTasks()
    await Promise.resolve()
    current.sessionId.value = 'two'
    await current.view.syncTasks()
    expect(current.view.selectedTaskId.value).toBe('new')
    expect(current.view.tasks.value.map((item) => item.id)).toEqual(['new'])
    current.scope.stop()
    waiting.resolve([])
    await old
    expect(current.engine.queryScanTask.mock.calls.map(([item]) => item.id)).toEqual(['new'])
    expect(current.errors).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('repairs a removed selection and publishes fresh snapshots of mutable engine tasks', async () => {
    current = fixture([task('first', 'one'), task('second', 'one', TaskStatus.COMPLETED)])
    await current.view.syncTasks()
    const before = current.view.activeTask.value
    current.engine.tasks[0].progress = 50
    current.engine.emit('taskProgress', current.engine.tasks[0])
    expect(current.view.activeTask.value).not.toBe(before)
    expect(current.view.activeTask.value.progress).toBe(50)
    const removed = current.engine.tasks.shift()
    current.engine.emit('taskRemoved', removed)
    await nextTick()
    expect(current.view.selectedTaskId.value).toBe('second')
    expect(current.engine.queryScanTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'second' })
    )
  })

  it('distinguishes initial loading, a failed load and a successful empty retry', async () => {
    current = fixture([])
    current.engine.syncNetworkWorkflowTasks.mockRejectedValueOnce(new Error('连接断开'))
    expect(current.view.loading.value).toBe(true)
    expect(current.view.hasLoaded.value).toBe(false)
    await current.view.syncTasks()
    expect(current.view.loading.value).toBe(false)
    expect(current.view.hasLoaded.value).toBe(true)
    expect(current.view.loadError.value).toBe('连接断开')
    await current.view.syncTasks()
    expect(current.view.loadError.value).toBe('')
    expect(current.view.tasks.value).toEqual([])
  })
})
