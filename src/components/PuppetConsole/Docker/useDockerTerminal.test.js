import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDockerTerminal } from './useDockerTerminal.js'
import { testTerminalTransport } from '../terminal/test-support/terminalTransport.js'

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createTerminal(options = {}) {
  const scope = effectScope()
  const sessionId = ref('session-a')
  let terminal
  scope.run(() => {
    terminal = useDockerTerminal({
      sessionId,
      createProcessId: () => 'process-a',
      ...options,
      executeCommand: testTerminalTransport(options.executeCommand)
    })
  })
  return { scope, sessionId, terminal }
}

describe('useDockerTerminal', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps reading an idle container and uses the negotiated PTY size', async () => {
    vi.useFakeTimers()
    const executeCommand = vi.fn(() =>
      Promise.resolve({
        data: {
          code: 200,
          alive: true,
          pty: true,
          resizable: true,
          data: ''
        }
      })
    )
    const { scope, terminal } = createTerminal({
      executeCommand,
      pollingInterval: 10
    })
    await terminal.openContainerTerminal({ id: 'web' })
    await terminal.handleContainerTerminalReady()
    terminal.handleContainerTerminalResize({ cols: 101, rows: 33 })
    await vi.advanceTimersByTimeAsync(120)
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'resize', cmd: '101,33' })
    )
    executeCommand.mockClear()
    await vi.advanceTimersByTimeAsync(3000)
    expect(executeCommand.mock.calls.some(([p]) => p.type === 'read')).toBe(true)
    scope.stop()
  })

  it('does not attach after a component initialization failure', async () => {
    const onError = vi.fn()
    const executeCommand = vi.fn((p) =>
      Promise.resolve({
        data: p.type === 'stop' ? { code: 200 } : { code: 500, msg: 'startup failed' }
      })
    )
    const { scope, terminal } = createTerminal({ executeCommand, onError })
    await terminal.openContainerTerminal({ id: 'web' })
    await terminal.handleContainerTerminalReady()
    expect(terminal.terminalReady.value).toBe(false)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('startup failed'))
    expect(executeCommand.mock.calls.some(([p]) => p.cmd.startsWith('docker exec'))).toBe(false)
    scope.stop()
  })

  it('attaches without requesting a TTY when the host uses pipes', async () => {
    const executeCommand = vi.fn(() =>
      Promise.resolve({ data: { code: 200, alive: true, pty: false, backend: 'unix-pipe' } })
    )
    const { scope, terminal } = createTerminal({ executeCommand })
    await terminal.openContainerTerminal({ id: 'web' })
    await terminal.handleContainerTerminalReady()
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: "docker exec -i 'web' /bin/sh\n" })
    )
    expect(terminal.terminalReady.value).toBe(true)
    scope.stop()
  })

  it('uses negotiated line input for both container attachment and subsequent commands', async () => {
    const executeCommand = vi.fn(() =>
      Promise.resolve({
        data: {
          code: 200,
          alive: true,
          pty: false,
          resizable: false,
          lineInput: true,
          backend: 'unix-pipe'
        }
      })
    )
    const { scope, terminal } = createTerminal({ executeCommand })
    terminal.openContainerTerminal({ id: 'web' })
    await terminal.handleContainerTerminalReady()
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'write-line',
        cmd: "docker exec -i 'web' /bin/sh\n"
      })
    )
    executeCommand.mockClear()
    await terminal.handleContainerTerminalInput('ls')
    expect(executeCommand.mock.calls.some(([params]) => params.type === 'write-line')).toBe(false)
    await terminal.handleContainerTerminalInput('\r')
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'write-line', cmd: 'ls\n' })
    )
    scope.stop()
  })

  it('ends unsupported command sessions without attaching a container', async () => {
    const executeCommand = vi.fn(() =>
      Promise.resolve({ data: { code: 200, alive: true, pty: false, backend: 'unix-command' } })
    )
    const { scope, terminal } = createTerminal({ executeCommand })
    await terminal.openContainerTerminal({ id: 'web' })
    await terminal.handleContainerTerminalReady()
    expect(terminal.terminalSession.value).toMatchObject({ ended: true, processExited: true })
    expect(terminal.terminalReady.value).toBe(false)
    expect(executeCommand.mock.calls.some(([p]) => p.cmd.startsWith('docker exec'))).toBe(false)
    expect(executeCommand.mock.calls.some(([p]) => p.type === 'stop')).toBe(true)
    scope.stop()
  })

  it('invalidates an attachment that finishes after another container opens', async () => {
    const firstInit = deferred()
    const calls = []
    const executeCommand = vi.fn((params) => {
      calls.push(params)
      if (params.type === 'init') return firstInit.promise
      return Promise.resolve({ data: { data: '' } })
    })
    const { scope, terminal } = createTerminal({ executeCommand })

    await terminal.openContainerTerminal({ id: 'old-container' })
    const attaching = terminal.handleContainerTerminalReady()
    await terminal.openContainerTerminal({ id: 'new-container' })
    firstInit.resolve({})
    await attaching

    expect(calls.some((call) => call.cmd.includes?.('old-container'))).toBe(false)
    expect(terminal.terminalContainerId.value).toBe('new-container')
    scope.stop()
  })

  it('uses the captured session when a session switch closes the process', async () => {
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { scope, sessionId, terminal } = createTerminal({ executeCommand })
    await terminal.openContainerTerminal({ id: 'web' })

    sessionId.value = 'session-b'
    await nextTick()

    expect(executeCommand).toHaveBeenCalledWith({
      sessionId: 'session-a',
      processId: 'process-a',
      cmd: '',
      type: 'stop'
    })
    expect(terminal.terminalActive.value).toBe(false)
    scope.stop()
  })

  it('quotes the container identifier before attaching', async () => {
    const executeCommand = vi.fn(() => Promise.resolve({ data: { data: '' } }))
    const { scope, terminal } = createTerminal({ executeCommand })
    await terminal.openContainerTerminal({ id: "web container's" })
    await terminal.handleContainerTerminalReady()

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: "docker exec -it 'web container'\"'\"'s' /bin/sh\n" })
    )
    scope.stop()
  })
})
