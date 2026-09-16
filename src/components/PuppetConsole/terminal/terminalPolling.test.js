import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTerminalSessionController } from './createTerminalSessionController.js'
import { testTerminalTransport } from './test-support/terminalTransport.js'
import { createTerminalSession } from './terminalWorkspaceModel.js'

const response = (data = {}) => ({ data: { code: 200, alive: true, eof: false, ...data } })
const flush = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve()
}

describe('adaptive terminal polling', () => {
  const controllers = []
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
  })
  afterEach(async () => {
    await Promise.all(controllers.splice(0).map((controller) => controller.dispose()))
    vi.useRealTimers()
  })

  function setup({ foreground = true, longPolling = false } = {}) {
    const session = createTerminalSession({ id: 'process', hostSessionId: 'host' })
    Object.assign(session, { viewportReady: true, pty: false, lineInput: true, longPolling })
    const visibility = { foreground }
    const read = vi.fn(() => response())
    const executeCommand = vi.fn((params) => (params.type === 'read' ? read(params) : response()))
    const onOutput = vi.fn()
    const controller = createTerminalSessionController({
      session,
      executeCommand: testTerminalTransport(executeCommand),
      onOutput,
      isForeground: () => visibility.foreground
    })
    controllers.push(controller)
    return { controller, session, read, executeCommand, visibility, onOutput }
  }

  async function expectNextReadAfter(controller, read, delay) {
    const count = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(delay - 1)
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(count)
    await vi.advanceTimersByTimeAsync(1)
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(count + 1)
  }

  it.each([
    { foreground: true, intervals: [3000, 5000, 10000, 20000, 20000] },
    { foreground: false, intervals: [5000, 5000, 10000, 20000, 20000] }
  ])(
    'backs off empty reads with foreground=$foreground and caps the delay',
    async ({ foreground, intervals }) => {
      const { controller, read } = setup({ foreground })
      await controller.poll()
      for (const interval of intervals) await expectNextReadAfter(controller, read, interval)
      expect(read.mock.calls.every(([params]) => params.cmd === '')).toBe(true)
    }
  )

  it('reissues foreground long polls without an extra idle gap and allows input during a read', async () => {
    const { controller, read, executeCommand } = setup({ longPolling: true })
    read.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(response()), 10000))
    )
    const pending = controller.poll()
    await flush()
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ cmd: '10000' }))
    await vi.advanceTimersByTimeAsync(9999)
    await controller.write('echo hello\r')
    controller.poll()
    await flush()
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'write-line', cmd: 'echo hello\n' })
    )
    expect(read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    controller.poll()
    await flush()
    expect(read).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10000)
  })

  it('starts the idle interval after a slow response finishes', async () => {
    const { controller, read } = setup()
    read.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(response()), 7000))
    )
    const pending = controller.poll()
    await vi.advanceTimersByTimeAsync(7000)
    await pending
    await expectNextReadAfter(controller, read, 3000)
  })

  it('offers only negotiated nonblocking reads to the batch transport', async () => {
    const { controller, session, read, visibility } = setup({ longPolling: true })
    session.batchRead = true
    await controller.poll()
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ cmd: '10000' }))
    expect(read.mock.lastCall[0].batchRead).toBeUndefined()
    visibility.foreground = false
    await expectNextReadAfter(controller, read, 5000)
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ cmd: '', batchRead: true }))
    session.batchRead = false
    await expectNextReadAfter(controller, read, 5000)
    expect(read.mock.lastCall[0].batchRead).toBeUndefined()
  })

  it('does not let a late empty response undo new local input activity', async () => {
    const { controller, read, executeCommand } = setup()
    await controller.poll()
    for (const delay of [3000, 5000, 10000]) await expectNextReadAfter(controller, read, delay)
    let complete
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    await vi.advanceTimersByTimeAsync(20000)
    const pending = controller.poll()
    await flush()
    await controller.write('a')
    expect(executeCommand.mock.calls.some(([params]) => params.type === 'write-line')).toBe(false)
    complete(response())
    await pending
    const count = read.mock.calls.length
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(count + 1)
    await expectNextReadAfter(controller, read, 3000)
  })

  it('refreshes an activated terminal immediately and resets its background delay', async () => {
    const { controller, read, visibility } = setup({ foreground: false, longPolling: true })
    await controller.poll()
    for (const delay of [5000, 5000, 10000]) await expectNextReadAfter(controller, read, delay)
    visibility.foreground = true
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(5)
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ cmd: '10000' }))
    visibility.foreground = false
    await expectNextReadAfter(controller, read, 5000)
    expect(read).toHaveBeenLastCalledWith(expect.objectContaining({ cmd: '' }))
  })

  it('resets idle backoff on output even when UTF-8 decoding needs another chunk', async () => {
    const { controller, read, onOutput } = setup()
    await controller.poll()
    for (const delay of [3000, 5000, 10000]) await expectNextReadAfter(controller, read, delay)
    const bytes = new TextEncoder().encode('中')
    const encode = (chunk) => btoa(String.fromCharCode(...chunk))
    read.mockReturnValueOnce(response({ data: encode(bytes.slice(0, 1)) }))
    await expectNextReadAfter(controller, read, 20000)
    expect(onOutput).not.toHaveBeenCalled()
    read.mockReturnValueOnce(response({ data: encode(bytes.slice(1)) }))
    await vi.advanceTimersByTimeAsync(250)
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(6)
    expect(onOutput).toHaveBeenCalledWith('中', true)
    await controller.poll()
    await expectNextReadAfter(controller, read, 3000)
  })

  it('drains known buffered output and exit responses without background delays', async () => {
    const { controller, session, read } = setup({ foreground: false, longPolling: true })
    read
      .mockReturnValueOnce(response({ hasMore: true }))
      .mockReturnValueOnce(response({ alive: false, eof: false }))
      .mockReturnValueOnce(response({ alive: false, eof: true }))
    await controller.poll()
    await controller.poll()
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(3)
    expect(read.mock.calls.every(([params]) => params.cmd === '')).toBe(true)
    expect(session.ended).toBe(true)
    await vi.advanceTimersByTimeAsync(20000)
    await controller.poll()
    expect(read).toHaveBeenCalledTimes(3)
  })
})
