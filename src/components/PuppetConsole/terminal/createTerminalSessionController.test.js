import { describe, expect, it, vi } from 'vitest'
import { createTerminalSessionController } from './createTerminalSessionController.js'
import { testTerminalTransport } from './test-support/terminalTransport.js'
import { createTerminalSession } from './terminalWorkspaceModel.js'

const flush = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve()
}

describe('terminal session controller lifecycle', () => {
  it('sends pasted init as input without reinitializing the remote shell', async () => {
    const executeCommand = vi.fn(() =>
      Promise.resolve({ data: { code: 200, alive: true, pty: false } })
    )
    const session = createTerminalSession({
      id: 'process',
      hostSessionId: 'host',
      terminalMode: 'pipe'
    })
    const controller = createTerminalSessionController({
      session,
      executeCommand: testTerminalTransport(executeCommand)
    })
    await controller.initialize()
    expect(await controller.write('init')).toBe(true)
    const writes = executeCommand.mock.calls
      .map(([params]) => params)
      .filter((params) => params.type === 'write')
    expect(writes.map((params) => params.cmd)).toEqual(['init'])
    expect(writes[0].terminalMode).toBeUndefined()
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        cmd: '',
        terminalMode: 'pipe',
        includeOutput: true
      })
    )
    await controller.dispose()
  })

  it('rejects and stops an endpoint that silently falls back from the requested PTY', async () => {
    const executeCommand = vi.fn(() => Promise.resolve({ data: { code: 200, pty: false } }))
    const session = createTerminalSession({
      id: 'process',
      hostSessionId: 'host',
      terminalMode: 'python-pty'
    })
    const onError = vi.fn()
    const controller = createTerminalSessionController({
      session,
      executeCommand: testTerminalTransport(executeCommand),
      onError
    })
    expect(await controller.initialize()).toBe(false)
    await flush()
    expect(session.ended).toBe(true)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('未按所选模式'))
    expect(executeCommand.mock.calls.some(([p]) => p.type === 'stop')).toBe(true)
    await controller.dispose()
  })

  it('compensates for a late initialization and shares repeated disposal', async () => {
    let releaseInit
    const pending = new Promise((resolve) => {
      releaseInit = resolve
    })
    const executeCommand = vi.fn((p) =>
      p.type === 'init' ? pending : Promise.resolve({ data: { code: 200 } })
    )
    const session = createTerminalSession({ id: 'process', hostSessionId: 'host' })
    const output = vi.fn()
    const controller = createTerminalSessionController({
      session,
      executeCommand: testTerminalTransport(executeCommand),
      onOutput: output
    })
    const initializing = controller.initialize()
    expect(controller.initialize()).toBe(initializing)
    const closing = controller.dispose()
    expect(controller.dispose()).toBe(closing)
    await flush()
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'stop')).toHaveLength(1)
    releaseInit({ data: { code: 200, alive: true } })
    await closing
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'stop')).toHaveLength(2)
    await controller.write('ignored')
    await controller.poll()
    expect(output).not.toHaveBeenCalled()
    expect(executeCommand).toHaveBeenCalledTimes(3)
  })

  it('isolates synchronous transport errors and never starts queued input after failure', async () => {
    const executeCommand = vi.fn((p) => {
      if (p.type === 'stop') return { data: { code: 200 } }
      throw new Error('transport unavailable')
    })
    const session = createTerminalSession({ id: 'process', hostSessionId: 'host' })
    const onError = vi.fn()
    const controller = createTerminalSessionController({
      session,
      executeCommand: testTerminalTransport(executeCommand),
      onError
    })
    const initializing = controller.initialize()
    const writing = controller.write('never sent')
    expect(await initializing).toBe(false)
    expect(await writing).toBe(false)
    expect(session.ended).toBe(true)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('transport unavailable'))
    expect(executeCommand.mock.calls.some(([p]) => p.cmd === 'never sent')).toBe(false)
    await flush()
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'stop')).toHaveLength(1)
    await controller.dispose()
  })
})
