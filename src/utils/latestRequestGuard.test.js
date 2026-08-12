import { describe, expect, it } from 'vitest'
import { createLatestRequestGuard } from './latestRequestGuard.js'

describe('createLatestRequestGuard', () => {
  it('invalidates request types independently', () => {
    const guard = createLatestRequestGuard(['list', 'meta'])
    const list = guard.next('list')
    const meta = guard.next('meta')
    guard.invalidate(['list'])
    expect(guard.isCurrent('list', list)).toBe(false)
    expect(guard.isCurrent('meta', meta)).toBe(true)
  })

  it('supports request types created on demand', () => {
    const guard = createLatestRequestGuard()
    const first = guard.next('dynamic')
    expect(guard.isCurrent('dynamic', first)).toBe(true)
    expect(guard.next('dynamic')).toBe(first + 1)
  })
})
