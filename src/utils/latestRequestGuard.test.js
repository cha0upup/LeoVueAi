import { describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
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

  it.each(['resolve', 'reject'])('shares pending work and releases it after %s', async outcome => {
    const guard = createLatestRequestGuard(['status'])
    const pending = deferred()
    const action = vi.fn(() => pending.promise)
    const request = guard.coalesce('status', action)
    expect(guard.coalesce('status', action)).toBe(request)
    expect(action).toHaveBeenCalledOnce()
    const settled = outcome === 'resolve'
      ? expect(request).resolves.toBe('result') : expect(request).rejects.toBe('result')
    pending[outcome]('result')
    await settled
    await expect(guard.coalesce('status', () => 'next')).resolves.toBe('next')
  })

  it.each(['resolve', 'reject'])('keeps replacement work when invalidated work later %s', async outcome => {
    const guard = createLatestRequestGuard(['status', 'meta'])
    const old = deferred(), latest = deferred(), meta = deferred()
    let isOldCurrent
    const stale = guard.coalesce('status', isCurrent => {
      isOldCurrent = isCurrent
      return old.promise
    }).catch(() => null)
    const independent = guard.coalesce('meta', () => meta.promise)
    expect(isOldCurrent()).toBe(true)
    guard.invalidate(['status'])
    expect(isOldCurrent()).toBe(false)
    const replacement = guard.coalesce('status', () => latest.promise)
    old[outcome]('stale')
    await stale
    expect(guard.coalesce('status', () => null)).toBe(replacement)
    expect(guard.coalesce('meta', () => null)).toBe(independent)
    guard.invalidate()
    await expect(guard.coalesce('status', () => 'reset')).resolves.toBe('reset')
    latest.resolve('latest'); meta.resolve('meta')
    await Promise.all([replacement, independent])
  })

  it('propagates synchronous errors and permits a retry', async () => {
    const guard = createLatestRequestGuard(['status'])
    await expect(guard.coalesce('status', () => { throw new Error('failed') })).rejects.toThrow('failed')
    await expect(guard.coalesce('status', () => 'retry')).resolves.toBe('retry')
  })
})
