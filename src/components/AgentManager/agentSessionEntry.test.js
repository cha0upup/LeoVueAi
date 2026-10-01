import { describe, expect, it } from 'vitest'

import { resolveAgentSessionEntry } from './agentSessionEntry.js'

describe('resolveAgentSessionEntry', () => {
  it('creates a session when the host has no active session', () => {
    expect(resolveAgentSessionEntry([]).action).toBe('create')
  })

  it('reuses the only active session', () => {
    const session = { sessionId: 'session-1' }
    expect(resolveAgentSessionEntry([session])).toEqual({
      action: 'reuse',
      session,
      sessions: [session]
    })
  })

  it('opens the chooser for multiple active sessions', () => {
    expect(resolveAgentSessionEntry([{ sessionId: '1' }, { sessionId: '2' }]).action).toBe(
      'choose'
    )
  })
})
