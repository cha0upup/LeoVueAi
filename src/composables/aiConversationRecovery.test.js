import { describe, expect, it } from 'vitest'
import { shouldRecoverAiConversation } from './aiConversationRecovery.js'

describe('shared AI conversation recovery', () => {
  it.each(['queued', 'running', 'cancelling', 'waiting_for_user'])(
    'recovers authoritative %s state even if local state is terminal', status => {
      expect(shouldRecoverAiConversation({ runStatus: status }, { status: 'completed' })).toBe(true)
      expect(shouldRecoverAiConversation({ runStatus: 'idle' }, { status })).toBe(true)
    })

  it('recovers pending questions and execution flags independently of status', () => {
    expect(shouldRecoverAiConversation({ pendingUserInput: { questionId: 'q' } })).toBe(true)
    expect(shouldRecoverAiConversation({}, { pendingUserInput: { questionId: 'q' } })).toBe(true)
    expect(shouldRecoverAiConversation({ executing: true })).toBe(true)
    expect(shouldRecoverAiConversation({}, { recovering: true })).toBe(true)
    expect(shouldRecoverAiConversation({ runStatus: 'completed' }, { status: 'idle' })).toBe(false)
  })
})
