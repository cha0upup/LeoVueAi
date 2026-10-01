import { describe, expect, it } from 'vitest'
import { resolveAgentRuntimeStatus } from './agentRuntimeStatus.js'

describe('resolveAgentRuntimeStatus', () => {
  it('prioritizes active sessions', () => {
    expect(
      resolveAgentRuntimeStatus({
        agent: { connLink: 'http://localhost' },
        sessions: [{ sessionId: 'one' }, { sessionId: 'two' }],
        isTesting: true,
        connectionResult: { success: false }
      })
    ).toEqual({ status: 'online', label: '2 会话' })
  })

  it('maps connection state when no session is active', () => {
    expect(
      resolveAgentRuntimeStatus({
        agent: { connLink: 'http://localhost' },
        connectionResult: { success: false }
      })
    ).toEqual({ status: 'failed', label: '失败' })
  })

  it('falls back to configuration state', () => {
    expect(resolveAgentRuntimeStatus({ agent: { connLink: 'http://localhost' } })).toEqual({
      status: 'untested',
      label: '未测试'
    })
    expect(resolveAgentRuntimeStatus({ agent: {} })).toEqual({
      status: 'offline',
      label: '离线'
    })
  })
})
