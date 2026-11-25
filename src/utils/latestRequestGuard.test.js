import { describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { createLatestRequestGuard } from './latestRequestGuard.js'

describe('createLatestRequestGuard', () => {
  it('shares pending work and releases it after failure or success', async () => {
    const guard = createLatestRequestGuard(['status'])
    const pending = deferred()
    const action = vi.fn(() => pending.promise)
    const request = guard.coalesce('status', action)
    expect(guard.coalesce('status', action)).toBe(request)
    expect(action).toHaveBeenCalledOnce()
    const failure = new Error('request failed')
    pending.reject(failure)
    await expect(request).rejects.toBe(failure)
    await expect(guard.coalesce('status', () => 'recovered')).resolves.toBe('recovered')
    await expect(guard.coalesce('status', () => 'next')).resolves.toBe('next')
  })

  it('keeps replacement and independent work when invalidated work fails late', async () => {
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
    old.reject(new Error('stale request'))
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
