import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'
import { useSessionParams } from './useSessionParams.js'

describe('session request parameters', () => {
  it('reads the current session getter for every request', () => {
    const props = reactive({ sessionId: 'first' })
    const { withSession } = useSessionParams(() => props.sessionId)
    expect(withSession()).toEqual({ sessionId: 'first' })
    props.sessionId = 'second'
    expect(withSession({ source: 'System' })).toEqual({ sessionId: 'second', source: 'System' })
  })

  it('resolves a reactive session ref rather than capturing its initial value', () => {
    const sessionId = ref('first')
    const { withSession } = useSessionParams(sessionId)
    sessionId.value = 'second'
    expect(withSession()).toEqual({ sessionId: 'second' })
  })

  it('merges parameters for a fixed session without modifying the source object', () => {
    const { withSession } = useSessionParams('fixed')
    const params = { source: 'System', limit: 10 }
    expect(withSession(params)).toEqual({ sessionId: 'fixed', ...params })
    expect(params).toEqual({ source: 'System', limit: 10 })
  })

  it('exposes only the request builder used by callers', () => {
    expect(Object.keys(useSessionParams('session'))).toEqual(['withSession'])
  })
})
