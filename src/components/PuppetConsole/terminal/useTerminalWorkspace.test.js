import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useTerminalWorkspace } from './useTerminalWorkspace.js'

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createWorkspace(executeCommand, options = {}) {
  const scope = effectScope()
  const hostSessionId = ref('host-a')
  const ids = ['process-a', 'process-b', 'process-c']
  let workspace
  scope.run(() => {
    workspace = useTerminalWorkspace({
      hostSessionId,
      executeCommand,
      createProcessId: () => ids.shift(),
      pollingConfig: { interval: 60000, idleTimeout: 60000 },
      ...options
    })
  })
  return { scope, hostSessionId, workspace }
}

describe('useTerminalWorkspace', () => {
  it('stops old processes with their captured host session when the host changes', async () => {
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { scope, hostSessionId, workspace } = createWorkspace(executeCommand)
    await nextTick()

    hostSessionId.value = 'host-b'
    await nextTick()

    expect(executeCommand).toHaveBeenCalledWith({
      sessionId: 'host-a',
      processId: 'process-a',
      cmd: '',
      type: 'stop'
    })
    expect(workspace.sessions.value).toHaveLength(1)
    expect(workspace.sessions.value[0]).toMatchObject({
      id: 'process-b',
      hostSessionId: 'host-b'
    })
    scope.stop()
  })

  it('drops queued writes after their terminal session is removed', async () => {
    const firstWrite = deferred()
    const executeCommand = vi.fn((params) => {
      if (params.type === 'write' && params.cmd === 'first') return firstWrite.promise
      return Promise.resolve({ data: { data: '' } })
    })
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true

    workspace.handleTerminalInput('first', session)
    workspace.handleTerminalInput('second', session)
    workspace.removeSession(session.id)
    firstWrite.resolve({})
    await session.writeChain

    expect(executeCommand.mock.calls.some(([params]) => params.cmd === 'second')).toBe(false)
    expect(workspace.sessions.value[0].id).toBe('process-b')
    scope.stop()
  })

  it('does not render read output after a host session switch', async () => {
    const pendingRead = deferred()
    const executeCommand = vi.fn((params) => {
      if (params.type === 'read') return pendingRead.promise
      return Promise.resolve({ data: { data: '' } })
    })
    const { scope, hostSessionId, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    const viewport = { write: vi.fn(), fit: vi.fn(), focus: vi.fn() }
    workspace.setViewportRef(viewport, session.id)
    session.viewportReady = true

    const write = workspace.handleTerminalInput('echo test\n', session)
    await Promise.resolve()
    hostSessionId.value = 'host-b'
    await nextTick()
    pendingRead.resolve({ data: { data: btoa('stale output') } })
    await write

    expect(viewport.write).not.toHaveBeenCalled()
    scope.stop()
  })

  it('deduplicates repeated viewport initialization events', async () => {
    const init = deferred()
    const executeCommand = vi.fn((params) =>
      params.cmd === 'init' ? init.promise : Promise.resolve({ data: { data: '' } })
    )
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]

    const first = workspace.handleViewportReady(session.id)
    const second = workspace.handleViewportReady(session.id)
    init.resolve({
      data: {
        pty: true,
        resizable: true,
        backend: 'python3-pty',
        instanceId: 'instance-a'
      }
    })
    await Promise.all([first, second])

    expect(executeCommand.mock.calls.filter(([params]) => params.cmd === 'init')).toHaveLength(1)
    expect(session.viewportReady).toBe(true)
    expect(session).toMatchObject({
      pty: true,
      resizable: true,
      backend: 'python3-pty',
      instanceId: 'instance-a'
    })
    scope.stop()
  })

  it('serializes early terminal input behind backend initialization', async () => {
    const init = deferred()
    const executeCommand = vi.fn((params) =>
      params.cmd === 'init' ? init.promise : Promise.resolve({ data: { data: '' } })
    )
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]

    const initializing = workspace.handleViewportReady(session.id)
    const writing = workspace.handleTerminalInput('whoami\n', session)
    await Promise.resolve()
    expect(executeCommand.mock.calls.some(([params]) => params.cmd === 'whoami\n')).toBe(false)

    init.resolve({})
    await Promise.all([initializing, writing])
    expect(executeCommand.mock.calls.some(([params]) => params.cmd === 'whoami\n')).toBe(true)
    scope.stop()
  })

  it('releases queued write state when terminal initialization fails', async () => {
    const init = deferred()
    const executeCommand = vi.fn((params) =>
      params.cmd === 'init' ? init.promise : Promise.resolve({ data: { data: '' } })
    )
    const onError = vi.fn()
    const { scope, workspace } = createWorkspace(executeCommand, { onError })
    await nextTick()
    const session = workspace.sessions.value[0]

    const initializing = workspace.handleViewportReady(session.id)
    const writing = workspace.handleTerminalInput('whoami\n', session)
    init.resolve(Promise.reject(new Error('startup failed')))
    await Promise.all([initializing, writing])

    expect(session).toMatchObject({
      pendingWrites: 0,
      isLoading: false,
      ended: true,
      endReason: '终端初始化失败: startup failed'
    })
    expect(onError).toHaveBeenCalledWith('终端初始化失败: startup failed')
    scope.stop()
  })

  it('continues low-frequency reads after a session becomes idle', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { scope, workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 10, idleTimeout: 5, idleInterval: 20 }
    })
    await nextTick()
    workspace.sessions.value[0].viewportReady = true

    await vi.advanceTimersByTimeAsync(20)

    expect(executeCommand.mock.calls.some(([params]) => params.type === 'read')).toBe(true)
    scope.stop()
    vi.useRealTimers()
  })

  it('uses bounded long polling after the backend advertises support', async () => {
    const executeCommand = vi.fn((params) => {
      if (params.cmd === 'init') {
        return Promise.resolve({ data: { alive: true, longPolling: true, data: '' } })
      }
      return Promise.resolve({ data: { alive: true, data: '' } })
    })
    const { scope, workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 60000, idleTimeout: 60000, longPollWait: 750 }
    })
    await nextTick()
    const session = workspace.sessions.value[0]
    await workspace.handleViewportReady(session.id)
    executeCommand.mockClear()

    await workspace.handleTerminalInput('echo live\n', session)

    expect(executeCommand).toHaveBeenCalledWith({
      sessionId: 'host-a',
      processId: 'process-a',
      cmd: '750',
      type: 'read'
    })
    expect(session.longPolling).toBe(true)
    scope.stop()
  })

  it('stops polling and writing after the backend reports an ended terminal', async () => {
    const executeCommand = vi.fn((params) => {
      if (params.type === 'read') {
        return Promise.resolve({ data: { alive: false, missing: true, data: '' } })
      }
      return Promise.resolve({ data: { alive: true, data: '' } })
    })
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    const viewport = { write: vi.fn(), fit: vi.fn(), focus: vi.fn() }
    workspace.setViewportRef(viewport, session.id)
    session.viewportReady = true

    await workspace.handleTerminalInput('exit\n', session)
    const writeCount = executeCommand.mock.calls.filter(([params]) => params.type === 'write').length
    await workspace.handleTerminalInput('echo stale\n', session)

    expect(session).toMatchObject({ ended: true, endReason: '终端会话记录已失效' })
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'write')).toHaveLength(
      writeCount
    )
    expect(viewport.write).toHaveBeenCalledWith(expect.stringContaining('创建新终端'))
    scope.stop()
  })

  it('backs off repeated read failures', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    const executeCommand = vi.fn((params) =>
      params.type === 'read'
        ? Promise.reject(new Error('temporary read failure'))
        : Promise.resolve({ data: { alive: true, data: '' } })
    )
    const { scope, workspace } = createWorkspace(executeCommand, {
      pollingConfig: {
        interval: 10,
        idleTimeout: 1000,
        idleInterval: 20,
        errorBaseInterval: 100,
        errorMaxInterval: 1000
      }
    })
    await nextTick()
    workspace.sessions.value[0].viewportReady = true

    await vi.advanceTimersByTimeAsync(90)
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'read')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(30)
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'read')).toHaveLength(2)

    scope.stop()
    vi.useRealTimers()
  })

  it('debounces terminal resize and sends the latest PTY dimensions', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true

    workspace.handleTerminalResize({ cols: 90, rows: 30 }, session)
    workspace.handleTerminalResize({ cols: 132, rows: 43 }, session)
    await vi.advanceTimersByTimeAsync(120)

    expect(executeCommand).toHaveBeenCalledWith({
      sessionId: 'host-a',
      processId: 'process-a',
      cmd: '132,43',
      type: 'resize'
    })
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'resize')).toHaveLength(1)
    scope.stop()
    vi.useRealTimers()
  })

  it('keeps the local viewport fitted without sending resize to fixed backends', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true
    session.resizable = false

    workspace.handleTerminalResize({ cols: 120, rows: 36 }, session)
    await vi.advanceTimersByTimeAsync(120)

    expect(session).toMatchObject({ cols: 120, rows: 36 })
    expect(executeCommand.mock.calls.some(([params]) => params.type === 'resize')).toBe(false)
    scope.stop()
    vi.useRealTimers()
  })

  it('detects terminal requests routed to a different service instance', async () => {
    const executeCommand = vi.fn((params) => {
      if (params.type === 'write') return Promise.resolve({ data: { instanceId: 'instance-a' } })
      if (params.type === 'read') {
        return Promise.resolve({
          data: { instanceId: 'instance-b', alive: false, missing: true, data: '' }
        })
      }
      return Promise.resolve({ data: { data: '' } })
    })
    const { scope, workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    const viewport = { write: vi.fn(), fit: vi.fn(), focus: vi.fn() }
    workspace.setViewportRef(viewport, session.id)
    session.viewportReady = true
    session.instanceId = 'instance-a'

    await workspace.handleTerminalInput('echo route\n', session)

    expect(session.routingMismatch).toBe(true)
    expect(session.ended).toBe(false)
    expect(viewport.write).toHaveBeenCalledWith(expect.stringContaining('会话粘性路由'))
    scope.stop()
  })
})
