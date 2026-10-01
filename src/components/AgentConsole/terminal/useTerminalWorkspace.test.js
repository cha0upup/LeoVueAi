import { deferred } from '@/test-support/deferred.js'
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTerminalWorkspace } from './useTerminalWorkspace.js'
import { testTerminalTransport } from './test-support/terminalTransport.js'

const scopes = []
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function flushRequests() {
  for (let i = 0; i < 30; i += 1) await Promise.resolve()
}

function createWorkspace(executeCommand, options = {}) {
  const scope = effectScope()
  scopes.push(scope)
  const hostSessionId = ref('host-a')
  const ids = ['process-a', 'process-b', 'process-c']
  const workspace = scope.run(() =>
    useTerminalWorkspace({
      hostSessionId,
      executeCommand: testTerminalTransport(executeCommand),
      createProcessId: () => ids.shift(),
      pollingConfig: { interval: 60000 },
      ...options
    })
  )
  return { scope, hostSessionId, workspace }
}

describe('useTerminalWorkspace', () => {
  it('refreshes only the visible terminal and removes the visibility listener on disposal', async () => {
    const page = new globalThis.EventTarget()
    page.hidden = false
    vi.stubGlobal('document', page)
    const executeCommand = vi.fn(() =>
      Promise.resolve({
        data: { code: 200, alive: true, pty: false, resizable: false }
      })
    )
    const { scope, workspace } = createWorkspace(executeCommand)
    await workspace.handleViewportReady(workspace.sessions.value[0].id)
    const selected = await workspace.createSession()
    await workspace.handleViewportReady(selected.id)
    await flushRequests()
    executeCommand.mockClear()
    page.hidden = true
    page.dispatchEvent(new globalThis.Event('visibilitychange'))
    await flushRequests()
    expect(executeCommand).not.toHaveBeenCalled()
    page.hidden = false
    page.dispatchEvent(new globalThis.Event('visibilitychange'))
    await flushRequests()
    expect(executeCommand.mock.calls.map(([params]) => params.processId)).toEqual([selected.id])
    scope.stop()
    await flushRequests()
    executeCommand.mockClear()
    page.dispatchEvent(new globalThis.Event('visibilitychange'))
    await flushRequests()
    expect(executeCommand).not.toHaveBeenCalled()
  })

  it('slows background reads and refreshes immediately when a terminal is selected', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    const executeCommand = vi.fn(() =>
      Promise.resolve({
        data: {
          code: 200,
          alive: true,
          pty: false,
          resizable: false,
          longPolling: true,
          lineInput: true
        }
      })
    )
    const { workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 250 }
    })
    const first = workspace.sessions.value[0]
    await workspace.handleViewportReady(first.id)
    const second = await workspace.createSession()
    await workspace.handleViewportReady(second.id)
    await vi.advanceTimersByTimeAsync(250)
    executeCommand.mockClear()
    await vi.advanceTimersByTimeAsync(1000)
    expect(
      executeCommand.mock.calls.filter(
        ([params]) => params.type === 'read' && params.processId === first.id
      )
    ).toHaveLength(0)
    workspace.activateSession(first.id)
    await nextTick()
    await flushRequests()
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'read', processId: first.id, cmd: '10000' })
    )
  })

  it('defaults to a pipe and creates a separate PTY without stopping the first process', async () => {
    const executeCommand = vi.fn((p) =>
      Promise.resolve({
        data: {
          alive: true,
          pty: p.terminalMode === 'python-pty',
          terminalModes: ['pipe', 'python-pty']
        }
      })
    )
    const { workspace } = createWorkspace(executeCommand)
    const pipe = workspace.sessions.value[0]
    await workspace.handleViewportReady(pipe.id)
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        cmd: '',
        processId: pipe.id,
        terminalMode: 'pipe'
      })
    )
    const pty = await workspace.createSession('python-pty')
    await workspace.handleViewportReady(pty.id)
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        cmd: '',
        processId: pty.id,
        terminalMode: 'python-pty'
      })
    )
    expect(workspace.sessions.value).toHaveLength(2)
    expect(workspace.activeSessionId.value).toBe(pty.id)
    expect(executeCommand.mock.calls.some(([p]) => p.type === 'stop')).toBe(false)
    await workspace.handleTerminalInput('echo pipe\n', pipe)
    expect(executeCommand).toHaveBeenCalledWith({
      sessionId: 'host-a',
      processId: pipe.id,
      type: 'write',
      includeOutput: true,
      cmd: 'echo pipe\n'
    })
  })

  it('uses the reported modes and keeps Java mode selection out of PHP initialization', async () => {
    const executeCommand = vi.fn(() =>
      Promise.resolve({ data: { pty: false, terminalModes: ['pipe'] } })
    )
    const java = createWorkspace(executeCommand)
    await java.workspace.handleViewportReady(java.workspace.sessions.value[0].id)
    expect(
      java.workspace.terminalModeOptions.value.find((mode) => mode.value === 'python-pty').disabled
    ).toBe(true)
    executeCommand.mockClear()
    const php = createWorkspace(executeCommand, { runtime: ref('php') })
    await php.workspace.handleViewportReady(php.workspace.sessions.value[0].id)
    const initialization = executeCommand.mock.calls.find(([p]) => p.type === 'init')[0]
    expect(initialization).not.toHaveProperty('terminalMode')
    expect(php.workspace.terminalModeOptions.value).toEqual([])
  })

  it('stops old processes with their captured host session when the host changes', async () => {
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { hostSessionId, workspace } = createWorkspace(executeCommand)
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
  })

  it('drops queued writes and stays empty after the last session is closed', async () => {
    const firstWrite = deferred()
    const executeCommand = vi.fn((params) => {
      if (params.type === 'write' && params.cmd === 'first') return firstWrite.promise
      return Promise.resolve({ data: { data: '' } })
    })
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true

    workspace.handleTerminalInput('first', session)
    workspace.handleTerminalInput('second', session)
    workspace.removeSession(session.id)
    firstWrite.resolve({})
    await flushRequests()

    expect(executeCommand.mock.calls.some(([params]) => params.cmd === 'second')).toBe(false)
    expect(workspace.sessions.value).toHaveLength(0)
    expect(workspace.activeSessionId.value).toBe('')
    expect((await workspace.createSession()).id).toBe('process-b')
  })

  it('does not render read output after a host session switch', async () => {
    const pendingRead = deferred()
    const executeCommand = vi.fn((params) => {
      if (params.type === 'read') return pendingRead.promise
      return Promise.resolve({ data: { data: '' } })
    })
    const { hostSessionId, workspace } = createWorkspace(executeCommand)
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
  })

  it('deduplicates repeated viewport initialization events', async () => {
    const init = deferred()
    const executeCommand = vi.fn((params) =>
      params.type === 'init' ? init.promise : Promise.resolve({ data: { data: '' } })
    )
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = await workspace.createSession('python-pty')

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

    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'init')).toHaveLength(1)
    expect(session.viewportReady).toBe(true)
    expect(session).toMatchObject({
      pty: true,
      resizable: true,
      backend: 'python3-pty',
      instanceId: 'instance-a'
    })
  })

  it('serializes early terminal input behind backend initialization', async () => {
    const init = deferred()
    const executeCommand = vi.fn((params) =>
      params.type === 'init' ? init.promise : Promise.resolve({ data: { data: '' } })
    )
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]

    const initializing = workspace.handleViewportReady(session.id)
    const writing = workspace.handleTerminalInput('whoami\n', session)
    await Promise.resolve()
    expect(executeCommand.mock.calls.some(([params]) => params.cmd === 'whoami\n')).toBe(false)

    init.resolve({})
    await Promise.all([initializing, writing])
    expect(executeCommand.mock.calls.some(([params]) => params.cmd === 'whoami\n')).toBe(true)
  })

  it('releases queued write state when terminal initialization fails', async () => {
    const init = deferred()
    const executeCommand = vi.fn((params) =>
      params.type === 'init' ? init.promise : Promise.resolve({ data: { data: '' } })
    )
    const onError = vi.fn()
    const { workspace } = createWorkspace(executeCommand, { onError })
    await nextTick()
    const session = workspace.sessions.value[0]

    const initializing = workspace.handleViewportReady(session.id)
    const writing = workspace.handleTerminalInput('whoami\n', session)
    init.resolve(Promise.reject(new Error('startup failed')))
    await Promise.all([initializing, writing])

    expect(session).toMatchObject({
      ended: true,
      endReason: '终端初始化失败: startup failed'
    })
    expect(onError).toHaveBeenCalledWith('终端初始化失败: startup failed')
  })

  it('continues low-frequency reads after a session becomes idle', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 10, idleIntervals: [20] }
    })
    await nextTick()
    await workspace.handleViewportReady(workspace.sessions.value[0].id)

    executeCommand.mockClear()
    await vi.advanceTimersByTimeAsync(30)

    expect(executeCommand.mock.calls.some(([params]) => params.type === 'read')).toBe(true)
  })

  it('uses bounded long polling after the backend advertises support', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn((params) => {
      if (params.type === 'init') {
        return Promise.resolve({ data: { alive: true, longPolling: true, data: '' } })
      }
      return Promise.resolve({ data: { alive: true, data: '' } })
    })
    const { workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 250, longPollWait: 750 }
    })
    await nextTick()
    const session = workspace.sessions.value[0]
    await workspace.handleViewportReady(session.id)
    executeCommand.mockClear()

    await workspace.handleTerminalInput('echo live\n', session)
    expect(executeCommand.mock.calls.some(([p]) => p.type === 'read')).toBe(false)
    await vi.advanceTimersByTimeAsync(250)

    expect(executeCommand).toHaveBeenCalledWith({
      sessionId: 'host-a',
      processId: 'process-a',
      cmd: '750',
      type: 'read'
    })
    expect(session.longPolling).toBe(true)
  })

  it('stops polling and writing after the backend reports an ended terminal', async () => {
    const executeCommand = vi.fn((params) => {
      if (params.type === 'read') {
        return Promise.resolve({ data: { alive: false, missing: true, data: '' } })
      }
      return Promise.resolve({ data: { alive: true, data: '' } })
    })
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    const viewport = { write: vi.fn(), fit: vi.fn(), focus: vi.fn() }
    workspace.setViewportRef(viewport, session.id)
    session.viewportReady = true

    await workspace.handleTerminalInput('exit\n', session)
    await flushRequests()
    const writeCount = executeCommand.mock.calls.filter(
      ([params]) => params.type === 'write'
    ).length
    await workspace.handleTerminalInput('echo stale\n', session)

    expect(session).toMatchObject({ ended: true, endReason: '终端会话记录已失效' })
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'write')).toHaveLength(
      writeCount
    )
    expect(viewport.write).toHaveBeenCalledWith(expect.stringContaining('创建新终端'))
  })

  it('backs off repeated read failures', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    const executeCommand = vi.fn((params) =>
      params.type === 'read'
        ? Promise.reject(new Error('temporary read failure'))
        : Promise.resolve({ data: { alive: true, data: '' } })
    )
    const { workspace } = createWorkspace(executeCommand, {
      pollingConfig: {
        interval: 10,
        errorBaseInterval: 100,
        errorMaxInterval: 1000
      }
    })
    await nextTick()
    await workspace.handleViewportReady(workspace.sessions.value[0].id)

    await vi.advanceTimersByTimeAsync(90)
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'read')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(30)
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'read')).toHaveLength(2)
  })

  it('debounces terminal resize and sends the latest PTY dimensions', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { workspace } = createWorkspace(executeCommand)
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
  })

  it('keeps the local viewport fitted without sending resize to fixed backends', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true
    session.resizable = false

    workspace.handleTerminalResize({ cols: 120, rows: 36 }, session)
    await vi.advanceTimersByTimeAsync(120)

    expect(session).toMatchObject({ cols: 120, rows: 36 })
    expect(executeCommand.mock.calls.some(([params]) => params.type === 'resize')).toBe(false)
  })

  it('detects terminal requests routed to a different service instance', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn((params) => {
      if (params.type === 'write') return Promise.resolve({ data: { instanceId: 'instance-b' } })
      if (params.type === 'read') {
        return Promise.resolve({
          data: { instanceId: 'instance-b', alive: false, missing: true, data: '' }
        })
      }
      return Promise.resolve({ data: { data: '' } })
    })
    const { workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 250 }
    })
    await nextTick()
    const session = workspace.sessions.value[0]
    const viewport = { write: vi.fn(), fit: vi.fn(), focus: vi.fn() }
    workspace.setViewportRef(viewport, session.id)
    session.viewportReady = true
    session.instanceId = 'instance-a'

    await workspace.handleTerminalInput('echo route\n', session)
    await vi.advanceTimersByTimeAsync(250)

    expect(session.routingMismatch).toBe(true)
    expect(session.ended).toBe(false)
    expect(viewport.write).toHaveBeenCalledWith(expect.stringContaining('会话粘性路由'))
  })

  it('rejects a component error returned inside a successful HTTP response', async () => {
    const executeCommand = vi.fn((params) =>
      Promise.resolve({
        data: params.type === 'stop' ? { code: 200 } : { code: 500, msg: 'startup failed' }
      })
    )
    const onError = vi.fn()
    const { workspace } = createWorkspace(executeCommand, { onError })
    await nextTick()
    const session = workspace.sessions.value[0]
    await workspace.handleViewportReady(session.id)
    await workspace.handleTerminalInput('whoami\n', session)
    expect(session).toMatchObject({ viewportReady: false, ended: true })
    expect(onError).toHaveBeenCalledWith('终端初始化失败: startup failed')
    expect(executeCommand.mock.calls.some(([p]) => p.cmd === 'whoami\n')).toBe(false)
  })

  it('sends subsequent input while a long read is still pending', async () => {
    const read = deferred()
    const executeCommand = vi.fn((p) =>
      p.type === 'read' ? read.promise : Promise.resolve({ data: { code: 200, alive: true } })
    )
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true
    session.longPolling = true
    await workspace.handleTerminalInput('a', session)
    await workspace.handleTerminalInput('b', session)
    await workspace.interruptSession(session.id)
    expect(
      executeCommand.mock.calls.filter(([p]) => p.type === 'write').map(([p]) => p.cmd)
    ).toEqual(['a', 'b', '\x03'])
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'read')).toHaveLength(1)
    read.resolve({ data: { alive: true, data: '' } })
    await flushRequests()
  })

  it('interrupts a running command without waiting for its write response', async () => {
    const running = deferred()
    const executeCommand = vi.fn((p) =>
      p.cmd === 'sleep 10\n'
        ? running.promise
        : Promise.resolve({ data: { code: 200, alive: true } })
    )
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    session.viewportReady = true
    session.backend = 'unix-command'
    const first = workspace.handleTerminalInput('sleep 10\n', session)
    for (let i = 0; i < 8; i += 1) await Promise.resolve()
    const queued = workspace.handleTerminalInput('stale input', session)
    await workspace.handleTerminalInput('\x03', session)
    expect(executeCommand.mock.calls.some(([p]) => p.cmd === '\x03')).toBe(true)
    running.resolve({ data: { code: 200, alive: true } })
    await Promise.all([first, queued])
    expect(executeCommand.mock.calls.some(([p]) => p.cmd === 'stale input')).toBe(false)
  })

  it('drains output after process exit and preserves UTF-8 across reads', async () => {
    vi.useFakeTimers()
    const bytes = new TextEncoder().encode('中')
    const encode = (chunk) => btoa(String.fromCharCode(...chunk))
    const chunks = [
      { alive: false, eof: false, data: encode(bytes.slice(0, 1)) },
      { alive: false, eof: false, data: '' },
      { alive: false, eof: true, data: encode(bytes.slice(1)) }
    ]
    const executeCommand = vi.fn((p) =>
      Promise.resolve({ data: p.type === 'read' ? chunks.shift() : { code: 200, alive: false } })
    )
    const { workspace } = createWorkspace(executeCommand, {
      pollingConfig: { interval: 10 }
    })
    await nextTick()
    const session = workspace.sessions.value[0]
    const viewport = { write: vi.fn(), fit: vi.fn(), focus: vi.fn() }
    workspace.setViewportRef(viewport, session.id)
    session.viewportReady = true
    await workspace.handleTerminalInput('exit\n', session)
    await flushRequests()
    expect(session).toMatchObject({ processExited: true, ended: false })
    await workspace.handleTerminalInput('ignored', session)
    await vi.advanceTimersByTimeAsync(25)
    expect(session.ended).toBe(true)
    expect(viewport.write).toHaveBeenCalledWith('中')
    expect(executeCommand.mock.calls.some(([p]) => p.cmd === 'ignored')).toBe(false)
    const count = executeCommand.mock.calls.length
    await vi.advanceTimersByTimeAsync(40)
    expect(executeCommand.mock.calls).toHaveLength(count)
  })

  it('stops again after a removed session finishes initialization', async () => {
    const init = deferred()
    const executeCommand = vi.fn((p) =>
      p.type === 'init' ? init.promise : Promise.resolve({ data: { code: 200 } })
    )
    const { workspace } = createWorkspace(executeCommand)
    await nextTick()
    const session = workspace.sessions.value[0]
    const initializing = workspace.handleViewportReady(session.id)
    await Promise.resolve()
    workspace.removeSession(session.id)
    for (let i = 0; i < 8; i += 1) await Promise.resolve()
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'stop')).toHaveLength(1)
    init.resolve({ data: { code: 200, alive: true } })
    await initializing
    for (let i = 0; i < 8; i += 1) await Promise.resolve()
    expect(
      executeCommand.mock.calls.filter(([p]) => p.type === 'stop' && p.processId === session.id)
    ).toHaveLength(2)
  })

  it('retries failed cleanup and reports an exhausted retry budget', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const executeCommand = vi.fn(() => Promise.resolve({ data: { code: 500, msg: 'offline' } }))
    const { scope, workspace } = createWorkspace(executeCommand, { onError })
    await nextTick()
    workspace.removeSession(workspace.sessions.value[0].id)
    await vi.advanceTimersByTimeAsync(800)
    expect(executeCommand.mock.calls.filter(([p]) => p.processId === 'process-a')).toHaveLength(3)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('清理失败: offline'))
    executeCommand.mockImplementation(() => Promise.resolve({ data: { code: 200 } }))
    scope.stop()
    await vi.runOnlyPendingTimersAsync()
  })
})
