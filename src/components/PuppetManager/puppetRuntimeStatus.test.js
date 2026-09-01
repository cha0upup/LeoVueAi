import { describe, expect, it } from 'vitest'
import { resolvePuppetRuntimeStatus } from './puppetRuntimeStatus.js'

describe('resolvePuppetRuntimeStatus', () => {
  it('prioritizes active sessions', () => {
    expect(
      resolvePuppetRuntimeStatus({
        puppet: { connLink: 'http://localhost' },
        sessions: [{ sessionId: 'one' }, { sessionId: 'two' }],
        isTesting: true,
        connectionResult: { success: false }
      })
    ).toEqual({ status: 'online', label: '2 会话' })
  })

  it('maps connection state when no session is active', () => {
    expect(
      resolvePuppetRuntimeStatus({
        puppet: { connLink: 'http://localhost' },
        connectionResult: { success: false }
      })
    ).toEqual({ status: 'failed', label: '失败' })
  })

  it('falls back to configuration state', () => {
    expect(resolvePuppetRuntimeStatus({ puppet: { connLink: 'http://localhost' } })).toEqual({
      status: 'untested',
      label: '未测试'
    })
    expect(resolvePuppetRuntimeStatus({ puppet: {} })).toEqual({
      status: 'offline',
      label: '离线'
    })
  })
})
