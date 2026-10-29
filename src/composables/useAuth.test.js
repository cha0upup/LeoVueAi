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

  it('reads the first-deployment state and server password policy without creating an identity', async () => {
    getLoginStatusApi.mockResolvedValue({ data: {
      isLoggedIn: false, initializationRequired: true, passwordMinLength: 12, passwordMaxLength: 256
    } })
    const auth = useAuth()
    await auth.fetchAuth()
    expect(auth.currentUser.value).toBeNull()
    expect(auth.initializationRequired.value).toBe(true)
    expect(auth.passwordMinLength.value).toBe(12)
    expect(auth.passwordMaxLength.value).toBe(256)
    getLoginStatusApi.mockResolvedValue({ data: { isLoggedIn: false, initializationRequired: false } })
    await auth.fetchAuth({ force: true })
    expect(auth.initializationRequired.value).toBe(false)
  })

  it('discards stale setup status after a session reset', async () => {
    const response = deferred()
    getLoginStatusApi.mockReturnValue(response.promise)
    const auth = useAuth()
    const request = auth.fetchAuth()
    auth.resetAuth()
    response.resolve({ data: { initializationRequired: true, passwordMinLength: 12 } })
    await request
    expect(auth.initializationRequired.value).toBe(false)
    expect(auth.passwordMinLength.value).toBe(8)
  })

  it('does not cache a failed check as a configured or anonymous deployment and can retry', async () => {
    const auth = useAuth()
    getLoginStatusApi.mockRejectedValue({ response: { data: { msg: '系统正在准备' }, status: 503 } })
    await auth.fetchAuth()
    expect(auth.authFetched.value).toBe(false)
    expect(auth.authCheckState.value).toBe('error')
    expect(auth.authError.value).toBe('系统正在准备')
    getLoginStatusApi.mockResolvedValue({ data: { isLoggedIn: false, initializationRequired: true } })
    await auth.fetchAuth()
    expect(auth.authCheckState.value).toBe('required')
    expect(auth.authError.value).toBe('')
    expect(auth.authFetched.value).toBe(true)
    expect(getLoginStatusApi).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed status responses instead of guessing a login state', async () => {
    getLoginStatusApi.mockResolvedValue({ data: {} })
    const auth = useAuth()
    await auth.fetchAuth()
    expect(auth.authCheckState.value).toBe('error')
    expect(auth.authFetched.value).toBe(false)
  })
})
