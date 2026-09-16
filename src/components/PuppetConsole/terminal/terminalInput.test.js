import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTerminalSessionController } from './createTerminalSessionController.js'
import { testTerminalTransport } from './test-support/terminalTransport.js'
import { createTerminalSession } from './terminalWorkspaceModel.js'

const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('terminal input batching and polling', () => {
  const controllers = []
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
  })
  afterEach(async () => {
    await Promise.all(controllers.splice(0).map((controller) => controller.dispose()))
    vi.useRealTimers()
  })
  const setup = ({ metadata = {}, transport, ...options } = {}) => {
    const session = createTerminalSession({ id: 'process', hostSessionId: 'host' })
    const executeCommand = vi.fn(
      transport ||
        (() =>
          Promise.resolve({
            data: {
              code: 200,
              alive: true,
              pty: true,
              resizable: false,
              ...metadata
            }
          }))
    )
    const onOutput = vi.fn()
    const controller = createTerminalSessionController({
      session,
      executeCommand: testTerminalTransport(executeCommand),
      onOutput,
      ...options
    })
    controllers.push(controller)
    return { controller, session, executeCommand, onOutput }
  }
  const writes = (transport) =>
    transport.mock.calls
      .map(([params]) => params)
      .filter((params) => ['write', 'write-line'].includes(params.type))

  it('reduces a typed PIPE command to one write with immediate local echo', async () => {
    const { controller, executeCommand, onOutput } = setup({
      metadata: { pty: false, lineInput: true }
    })
    await controller.initialize()
    for (const character of 'echo hello') expect(await controller.write(character)).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(writes(executeCommand)).toHaveLength(0)
    expect(onOutput.mock.calls.map(([text]) => text).join('')).toBe('echo hello')
    await controller.write('\r')
    expect(writes(executeCommand)).toEqual([
      expect.objectContaining({ type: 'write-line', cmd: 'echo hello\n' })
    ])
  })

  it('edits Unicode locally and normalizes split CRLF without sending control bytes', async () => {
    const { controller, executeCommand, onOutput } = setup({
      metadata: { pty: false, lineInput: true }
    })
    await controller.initialize()
    await controller.write('echo 中😀e\u0301')
    await controller.write('\x7f\x7f')
    await controller.write('\x1b[')
    await controller.write('A')
    await controller.write('\r')
    await controller.write('\n')
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['echo 中\n'])
    expect(onOutput.mock.calls.map(([text]) => text).join('')).toContain('\b \b'.repeat(3))
    await controller.write('discard\x15echo kept\nsecond\npartial')
    expect(writes(executeCommand).at(-1).cmd).toBe('echo kept\nsecond\n')
    await controller.write('\x03')
    expect(writes(executeCommand)).toHaveLength(2)
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('已清空输入'), false)
  })

  it('only enables local editing when the node explicitly advertises it', async () => {
    const { controller, executeCommand, onOutput } = setup({ metadata: { pty: false } })
    await controller.initialize()
    const writing = controller.write('a')
    expect(onOutput).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(await writing).toBe(true)
    expect(writes(executeCommand)[0]).toMatchObject({ type: 'write', cmd: 'a' })
  })

  it('batches PTY keystrokes over 100ms without moving the deadline', async () => {
    const { controller, executeCommand } = setup()
    await controller.initialize()
    const first = controller.write('a')
    await vi.advanceTimersByTimeAsync(75)
    const second = controller.write('b')
    await vi.advanceTimersByTimeAsync(24)
    expect(writes(executeCommand)).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['ab'])
  })

  it('flushes Enter, Tab and Ctrl+C immediately in input order', async () => {
    const { controller, executeCommand } = setup()
    await controller.initialize()
    const typing = controller.write('ls')
    await controller.write('\t')
    await typing
    await controller.write('\r')
    await controller.write('\x03')
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['ls\t', '\r', '\x03'])
  })

  it('merges pending keystrokes while another write is in flight', async () => {
    const pending = deferred()
    const { controller, executeCommand } = setup({
      transport: (params) =>
        params.cmd === 'a' ? pending.promise : Promise.resolve({ data: { code: 200, pty: true } })
    })
    await controller.initialize()
    const first = controller.write('a')
    await vi.advanceTimersByTimeAsync(100)
    const second = controller.write('b')
    const third = controller.write('c')
    const enter = controller.write('\r')
    await vi.advanceTimersByTimeAsync(200)
    expect(writes(executeCommand)).toHaveLength(1)
    pending.resolve({ data: { code: 200 } })
    expect(await Promise.all([first, second, third, enter])).toEqual([true, true, true, true])
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['a', 'bc\r'])
  })

  it('cancels buffered input on disposal and never transmits it after its timer fires', async () => {
    const { controller, executeCommand } = setup()
    await controller.initialize()
    const writing = controller.write('never sent')
    await controller.dispose()
    expect(await writing).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(writes(executeCommand)).toHaveLength(0)
  })

  it('drops queued commands after an uncertain write failure without retrying', async () => {
    const pending = deferred()
    const { controller, executeCommand } = setup({
      transport: (params) =>
        params.cmd === 'first\r'
          ? pending.promise
          : Promise.resolve({ data: { code: 200, pty: true } })
    })
    await controller.initialize()
    const first = controller.write('first\r')
    const second = controller.write('must not execute\r')
    pending.resolve({ data: { code: 500, msg: 'write failed' } })
    expect(await Promise.all([first, second])).toEqual([false, false])
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['first\r'])
  })

  it('bounds pending input and cancels an oversized paste as a whole', async () => {
    const { controller, executeCommand, onOutput } = setup({
      metadata: { pty: false, lineInput: true }
    })
    await controller.initialize()
    expect(await controller.write('echo should-not-execute\n' + 'x'.repeat(1024 * 1024))).toBe(
      false
    )
    expect(writes(executeCommand)).toHaveLength(0)
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('已取消'), false)
    await controller.write('echo recovered\n')
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['echo recovered\n'])
  })

  it('cancels queued PIPE commands when a later paste overflows the local editor', async () => {
    const pending = deferred()
    const { controller, executeCommand } = setup({
      transport: (params) =>
        params.cmd === 'first\n'
          ? pending.promise
          : Promise.resolve({ data: { code: 200, pty: false, lineInput: true } })
    })
    await controller.initialize()
    const first = controller.write('first\n')
    const queued = controller.write('cancelled\n')
    expect(await controller.write('x'.repeat(1024 * 1024))).toBe(false)
    expect(await queued).toBe(false)
    pending.resolve({ data: { code: 200 } })
    expect(await first).toBe(true)
    expect(writes(executeCommand).map((params) => params.cmd)).toEqual(['first\n'])
  })

  it('uses a 10s foreground long poll and a 5s minimum background interval', async () => {
    let foreground = true
    const { controller, executeCommand } = setup({
      metadata: { longPolling: true },
      isForeground: () => foreground
    })
    await controller.initialize()
    await controller.poll()
    expect(executeCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'read', cmd: '10000' })
    )
    foreground = false
    executeCommand.mockClear()
    for (let index = 0; index < 19; index += 1) {
      await vi.advanceTimersByTimeAsync(250)
      await controller.poll()
    }
    expect(executeCommand.mock.calls.filter(([params]) => params.type === 'read')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(250)
    await controller.poll()
    expect(executeCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'read', cmd: '' })
    )
    foreground = true
    await controller.poll()
    expect(executeCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'read', cmd: '10000' })
    )
  })
})
