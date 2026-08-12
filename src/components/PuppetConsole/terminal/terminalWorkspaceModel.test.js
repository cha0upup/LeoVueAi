import { describe, expect, it } from 'vitest'
import {
  createTerminalSession,
  decodeTerminalOutput,
  describeTerminalCapability,
  formatTerminalRelativeTime
} from './terminalWorkspaceModel.js'

describe('terminalWorkspaceModel', () => {
  it('creates an isolated backend session context', () => {
    const session = createTerminalSession({
      id: 'process-1',
      title: '终端 1',
      hostSessionId: 'host-1',
      now: 100
    })
    expect(session).toMatchObject({
      id: 'process-1',
      hostSessionId: 'host-1',
      pendingWrites: 0,
      viewportReady: false,
      cols: 80,
      rows: 24,
      pty: null,
      resizable: null,
      backend: 'detecting',
      backendFailures: [],
      instanceId: '',
      routingMismatch: false,
      disposed: false,
      lastActivityTime: 100
    })
  })

  it('formats relative timestamps at stable boundaries', () => {
    expect(formatTerminalRelativeTime(0, 1000)).toBe('--')
    expect(formatTerminalRelativeTime(9000, 10000)).toBe('刚刚')
    expect(formatTerminalRelativeTime(1000, 11000)).toBe('10 秒前')
    expect(formatTerminalRelativeTime(1000, 121000)).toBe('2 分钟前')
  })

  it('decodes the command response data field', () => {
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode('hello 世界')))
    expect(decodeTerminalOutput({ data: { data: encoded } })).toBe('hello 世界')
    expect(decodeTerminalOutput({ data: { data: 'not-base64!' } })).toBe('')
  })

  it('describes negotiated PTY, fallback, and detecting terminal modes', () => {
    expect(
      describeTerminalCapability({ pty: true, resizable: true, backend: 'python3-pty' })
    ).toMatchObject({
      mode: 'PTY',
      resizeMode: 'RESIZE',
      streamMode: 'POLL',
      shellLabel: 'PTY SHELL',
      degraded: false
    })
    expect(
      describeTerminalCapability({
        pty: false,
        resizable: false,
        backend: 'unix-pipe',
        backendFailures: ['python3-pty: startup failed']
      })
    ).toMatchObject({
      mode: 'PIPE',
      resizeMode: 'FIXED',
      streamMode: 'POLL',
      shellLabel: 'PIPE SHELL',
      degraded: true,
      details: expect.stringContaining('python3-pty: startup failed')
    })
    expect(describeTerminalCapability(null)).toMatchObject({
      mode: 'DETECTING',
      resizeMode: 'WAIT',
      streamMode: 'WAIT',
      degraded: false
    })
    expect(
      describeTerminalCapability({ ended: true, endReason: '退出码 0', backend: 'python3-pty' })
    ).toMatchObject({
      mode: 'ENDED',
      resizeMode: 'N/A',
      streamMode: 'STOPPED',
      shellLabel: 'SHELL ENDED',
      degraded: true
    })
  })
})
