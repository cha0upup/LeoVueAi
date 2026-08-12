import { describe, expect, it } from 'vitest'

import { resolvePuppetSessionEntry } from './puppetSessionEntry.js'

describe('resolvePuppetSessionEntry', () => {
  it('creates a session when the host has no active session', () => {
    expect(resolvePuppetSessionEntry([]).action).toBe('create')
  })

  it('reuses the only active session', () => {
    const session = { sessionId: 'session-1' }
    expect(resolvePuppetSessionEntry([session])).toEqual({
      action: 'reuse',
      session,
      sessions: [session]
    })
  })

  it('opens the chooser for multiple active sessions', () => {
    expect(resolvePuppetSessionEntry([{ sessionId: '1' }, { sessionId: '2' }]).action).toBe(
      'choose'
    )
  })
})
