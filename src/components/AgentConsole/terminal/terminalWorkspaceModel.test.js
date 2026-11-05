import { describe, expect, it } from 'vitest'
import { createTerminalSession, describeTerminalCapability } from './terminalWorkspaceModel.js'

describe('terminalWorkspaceModel', () => {
  it('keeps SSH identity separate from native terminal modes and drops credentials', () => {
    const session = createTerminalSession({ id: 'child', hostSessionId: 'parent', connectionType: 'ssh',
      endpoint: 'fixture@ssh.internal:22', password: 'request-only', privateKey: 'request-only' })
    expect(session).toMatchObject({ connectionType: 'ssh', terminalMode: null, endpoint: 'fixture@ssh.internal:22' })
    expect(session).not.toHaveProperty('password')
    expect(session).not.toHaveProperty('privateKey')
    expect(describeTerminalCapability({ ...session, pty: true, resizable: true, longPolling: true, backend: 'ssh' }))
      .toMatchObject({ mode: 'PTY', streamMode: 'LONG-POLL', resizeMode: 'RESIZE' })
  })
  it('describes negotiated PTY, fallback, and detecting terminal modes', () => {
    expect(describeTerminalCapability({ pty: false, backend: 'unix-command' })).toMatchObject({
      mode: 'COMMAND',
      details: expect.stringContaining('20 秒')
    })
    expect(
      describeTerminalCapability({ pty: true, resizable: true, backend: 'python3-pty' })
    ).toMatchObject({
      mode: 'PTY',
      resizeMode: 'RESIZE',
      streamMode: 'POLL'
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
      details: expect.stringContaining('python3-pty: startup failed')
    })
    expect(describeTerminalCapability(null)).toMatchObject({
      mode: 'DETECTING',
      resizeMode: 'WAIT',
      streamMode: 'WAIT'
    })
    expect(
      describeTerminalCapability({ ended: true, endReason: '退出码 0', backend: 'python3-pty' })
    ).toMatchObject({
      mode: 'ENDED',
      resizeMode: 'N/A',
      streamMode: 'STOPPED'
    })
  })
})
