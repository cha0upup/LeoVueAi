import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { getLoginStatusApi } from '@/services/api/auth.js'
import { useAuth } from './useAuth.js'

vi.mock('@/services/api/auth.js', () => ({ getLoginStatusApi: vi.fn() }))

describe('login identity cache', () => {
  beforeEach(() => {
    useAuth().resetAuth()
    vi.resetAllMocks()
  })

  it('shares a pending status request and caches the resolved identity', async () => {
    const response = deferred()
    getLoginStatusApi.mockReturnValue(response.promise)
    const auth = useAuth()
    const first = auth.fetchAuth()
    const second = auth.fetchAuth()
    expect(getLoginStatusApi).toHaveBeenCalledOnce()
    response.resolve({ data: { isLoggedIn: true, userId: 'a', privilege: 'admin' } })
    await Promise.all([first, second])
    expect(auth.currentUser.value.userId).toBe('a')
    expect(auth.isAdmin.value).toBe(true)
    await auth.fetchAuth()
    expect(getLoginStatusApi).toHaveBeenCalledOnce()
  })

  it.each(['resolve', 'reject'])('discards an old %s result without clearing the new inflight request', async outcome => {
    const oldResponse = deferred()
    const nextResponse = deferred()
    getLoginStatusApi.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(nextResponse.promise)
    const auth = useAuth()
    const oldFetch = auth.fetchAuth()
    auth.resetAuth()
    const nextFetch = auth.fetchAuth()
    if (outcome === 'resolve') oldResponse.resolve({ data: { isLoggedIn: true, userId: 'old' } })
    else oldResponse.reject(new Error('old failure'))
    await expect(oldFetch).resolves.toBeNull()
    expect(auth.currentUser.value).toBeNull()
    expect(auth.authLoading.value).toBe(true)
    expect(auth.authFetched.value).toBe(false)
    const shared = auth.fetchAuth()
    expect(getLoginStatusApi).toHaveBeenCalledTimes(2)
    nextResponse.resolve({ data: { isLoggedIn: true, userId: 'new' } })
    await Promise.all([nextFetch, shared])
    expect(auth.currentUser.value.userId).toBe('new')
    expect(auth.authLoading.value).toBe(false)
  })

  it('clears the cached identity and role on reset', async () => {
    getLoginStatusApi.mockResolvedValue({ data: { isLoggedIn: true, userId: 'a', privilege: 'admin' } })
    const auth = useAuth()
    await auth.fetchAuth()
    auth.resetAuth()
    expect(auth.currentUser.value).toBeNull()
    expect(auth.isAdmin.value).toBe(false)
    expect(auth.authFetched.value).toBe(false)
  })
})
