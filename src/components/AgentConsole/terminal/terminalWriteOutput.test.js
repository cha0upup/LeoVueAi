import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTerminalSessionController } from './createTerminalSessionController.js'
import { createTerminalSession } from './terminalWorkspaceModel.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const output = (sequence, data = '', extra = {}) => ({
  code: 200,
  instanceId: 'instance',
  outputSequence: sequence,
  data: btoa(data),
  alive: true,
  eof: false,
  hasMore: false,
  ...extra
})
const response = (data) => ({ data })
const written = (chunk) => response({ code: 200, alive: true, output: chunk })
const flush = async () => {
  for (let i = 0; i < 40; i += 1) await Promise.resolve()
}

describe('output carried by terminal writes', () => {
  const controllers = []
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
  })
  afterEach(async () => {
    await Promise.all(controllers.splice(0).map((controller) => controller.dispose()))
    vi.useRealTimers()
  })
  function setup(transport, metadata = {}) {
    const session = createTerminalSession({ id: 'process', hostSessionId: 'host' })
    Object.assign(session, { viewportReady: true, pty: true, resizable: false, ...metadata })
    const executeCommand = vi.fn((p) =>
      p.type === 'stop' ? response({ code: 200 }) : transport(p)
    )
    const onOutput = vi.fn()
    const controller = createTerminalSessionController({ session, executeCommand, onOutput })
    controllers.push(controller)
    const remote = () =>
      onOutput.mock.calls
        .filter(([, value]) => value)
        .map(([text]) => text)
        .join('')
    return { controller, session, executeCommand, onOutput, remote }
  }

  it('renders a completed PHP command from one write and resumes idle polling', async () => {
    const { controller, executeCommand, remote } = setup(
      (p) =>
        p.type === 'write'
          ? written(output(1, 'hello\r\n$ ', { busy: false, backend: 'unix-command' }))
          : response(output(2)),
      { pty: false, backend: 'unix-command' }
    )
    expect(await controller.write('echo hello\r')).toBe(true)
    expect(remote()).toBe('hello\r\n$ ')
    expect(executeCommand).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'write', includeOutput: true })
    )
    await vi.advanceTimersByTimeAsync(2999)
    await controller.poll()
    expect(executeCommand).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await controller.poll()
    expect(executeCommand.mock.lastCall[0].type).toBe('read')
  })

  it('orders split UTF-8 and EOF when a read response arrives before the earlier write response', async () => {
    const pending = deferred()
    const bytes = new TextEncoder().encode('中')
    const { controller, session, executeCommand, remote } = setup(
      (p) => {
        if (p.type === 'read')
          return response(
            output(2, String.fromCharCode(...bytes.slice(1)), { alive: false, eof: true })
          )
        return p.cmd === '\r' ? pending.promise : response({ code: 200, alive: true })
      },
      { pty: false, backend: 'unix-command' }
    )
    const writing = controller.write('\r')
    await flush()
    await controller.poll()
    expect(remote()).toBe('')
    expect(session.ended).toBe(false)
    // Input stays usable, but consumes no additional output while the earlier response is pending.
    await controller.interrupt()
    expect(executeCommand.mock.lastCall[0].includeOutput).toBeUndefined()
    pending.resolve(written(output(1, String.fromCharCode(bytes[0]))))
    expect(await writing).toBe(true)
    expect(remote()).toBe('中')
    expect(session.ended).toBe(true)
    await controller.poll()
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'read')).toHaveLength(1)
  })

  it('orders a write response behind an earlier in-flight long poll without blocking input', async () => {
    const pending = deferred()
    const { controller, executeCommand, remote } = setup(
      (p) => (p.type === 'read' ? pending.promise : written(output(2, 'second'))),
      { longPolling: true }
    )
    const reading = controller.poll()
    await flush()
    expect(await controller.write('\r')).toBe(true)
    expect(remote()).toBe('')
    expect(executeCommand).toHaveBeenCalledTimes(2)
    pending.resolve(response(output(1, 'first')))
    await reading
    expect(remote()).toBe('firstsecond')
  })

  it('keeps PHP command output streaming and accepts an interrupt while the write executes', async () => {
    const running = deferred()
    const { controller, remote } = setup(
      (p) => {
        if (p.type === 'read') return response(output(1, 'running', { busy: true }))
        if (p.cmd === '\x03') return written(output(2, '^C', { busy: true }))
        return running.promise
      },
      { pty: false, backend: 'unix-command' }
    )
    const writing = controller.write('sleep 10\r')
    await flush()
    await controller.poll()
    expect(remote()).toBe('running')
    expect(await controller.interrupt()).toBe(true)
    running.resolve(written(output(3, '\r\n$ ', { busy: false })))
    expect(await writing).toBe(true)
    expect(remote()).toBe('running^C\r\n$ ')
  })

  it('does not resend successful input when the attached output fails', async () => {
    const { controller, executeCommand, onOutput } = setup((p) =>
      p.type === 'write'
        ? written({ code: 500, msg: 'output is busy' })
        : response(output(1, 'recovered'))
    )
    expect(await controller.write('\r')).toBe(true)
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('output is busy'), false)
    await vi.advanceTimersByTimeAsync(1000)
    await controller.poll()
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'write')).toHaveLength(1)
    expect(onOutput).toHaveBeenCalledWith('recovered', true)
  })

  it('continues after a lost output response with a visible gap, without replaying the write', async () => {
    const pending = deferred()
    const { controller, executeCommand, remote, onOutput } = setup((p) =>
      p.type === 'read' ? pending.promise : written(output(2, 'remaining'))
    )
    const reading = controller.poll()
    await flush()
    await controller.write('\r')
    pending.reject(new Error('connection lost'))
    await reading
    expect(remote()).toBe('remaining')
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('部分终端输出响应未送达'), false)
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'write')).toHaveLength(1)
  })

  it('drains attached remaining output on the next poll without idle delays', async () => {
    const { controller, session, remote } = setup((p) =>
      p.type === 'write'
        ? written(output(1, 'first', { alive: false, hasMore: true }))
        : response(output(2, 'last', { alive: false, eof: true }))
    )
    await controller.write('\r')
    expect(session.ended).toBe(false)
    await controller.poll()
    expect(remote()).toBe('firstlast')
    expect(session.ended).toBe(true)
  })

  it('closes without waiting for a write and discards its late output', async () => {
    const pending = deferred()
    const { controller, executeCommand, remote } = setup(() => pending.promise)
    const writing = controller.write('\r')
    await flush()
    const closing = controller.dispose()
    await closing
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'stop')).toHaveLength(1)
    pending.resolve(written(output(1, 'stale')))
    await Promise.all([writing, closing])
    expect(remote()).toBe('')
    expect(executeCommand.mock.calls.filter(([p]) => p.type === 'stop')).toHaveLength(1)
  })

  it('ignores a duplicate output sequence without rendering its bytes twice', async () => {
    const { controller, remote } = setup((p) =>
      p.type === 'write' ? written(output(1, 'once')) : response(output(1, 'once'))
    )
    await controller.write('\r')
    await controller.poll()
    expect(remote()).toBe('once')
  })

  it('waits for earlier output before ending a missing process', async () => {
    const pending = deferred()
    const { controller, session, remote } = setup((p) =>
      p.type === 'read'
        ? response({ code: 200, alive: false, missing: true, eof: true, data: '' })
        : pending.promise
    )
    const writing = controller.write('\r')
    await flush()
    await controller.poll()
    expect(session.ended).toBe(false)
    pending.resolve(written(output(1, 'final output')))
    await writing
    expect(remote()).toBe('final output')
    expect(session.ended).toBe(true)
  })

  it('renders initialization output before the first poll', async () => {
    const { controller, executeCommand, remote } = setup(
      () => written(output(1, 'ready$ ', { pty: true, resizable: false })),
      { viewportReady: false }
    )
    expect(await controller.initialize()).toBe(true)
    expect(remote()).toBe('ready$ ')
    expect(executeCommand).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'init', cmd: '', includeOutput: true })
    )
  })

  it('rejects output without a sequence instead of silently using the obsolete protocol', async () => {
    const { controller, remote, onOutput } = setup(() => written({ code: 200, data: btoa('old') }))
    expect(await controller.write('\r')).toBe(true)
    expect(remote()).toBe('')
    expect(onOutput).toHaveBeenCalledWith(
      expect.stringContaining('同步更新服务器和节点组件'),
      false
    )
  })

  it('keeps a write successful when releasing buffered output reveals malformed bytes', async () => {
    const { controller, executeCommand, onOutput } = setup(() =>
      written(output(2, '', { data: 'not-base64!' }))
    )
    expect(await controller.write('\r')).toBe(true)
    expect(executeCommand).toHaveBeenCalledTimes(1)
    expect(onOutput).toHaveBeenCalledWith(expect.stringContaining('Base64'), false)
  })
})
