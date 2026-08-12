import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useDockerTerminal } from './useDockerTerminal.js'

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
      delay: () => Promise.resolve(),
      ...options
    })
  })
  return { scope, sessionId, terminal }
}

describe('useDockerTerminal', () => {
  it('invalidates an attachment that finishes after another container opens', async () => {
    const firstInit = deferred()
    const calls = []
    const executeCommand = vi.fn((params) => {
      calls.push(params)
      if (params.cmd === 'init') return firstInit.promise
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
