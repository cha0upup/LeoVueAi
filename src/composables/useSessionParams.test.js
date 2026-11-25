import { expect, it } from 'vitest'
import { reactive } from 'vue'
import { useSessionParams } from './useSessionParams.js'

it('uses the active session on each request without mutating its parameters', () => {
  const props = reactive({ sessionId: 'first' })
  const { withSession } = useSessionParams(() => props.sessionId)
  expect(withSession()).toEqual({ sessionId: 'first' })

  props.sessionId = 'second'
  const params = { source: 'System' }
  expect(withSession(params)).toEqual({ sessionId: 'second', source: 'System' })
  expect(params).toEqual({ source: 'System' })
})
