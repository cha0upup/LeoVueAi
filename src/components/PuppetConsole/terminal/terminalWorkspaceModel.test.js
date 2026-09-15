import { describe, expect, it } from 'vitest'
import {
  decodeTerminalOutput,
  describeTerminalCapability
} from './terminalWorkspaceModel.js'

describe('terminalWorkspaceModel', () => {
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
