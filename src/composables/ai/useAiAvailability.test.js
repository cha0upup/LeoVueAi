import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { platformAiAvailabilityApi } from '@/services/api/platform-ai.js'
import { resetSessionState } from '@/services/sessionLifecycle.js'
import { useAiAvailability } from './useAiAvailability.js'

vi.mock('@/services/api/platform-ai.js', () => ({ platformAiAvailabilityApi: vi.fn() }))

describe('AI availability login scope', () => {
  beforeEach(() => {
    resetSessionState()
    vi.resetAllMocks()
  })

  it('clears availability and fetches it again for the next login', async () => {
    platformAiAvailabilityApi.mockResolvedValue({ data: { available: true, enabledCount: 2 } })
    const state = useAiAvailability({ autoFetch: false })
    await state.refresh()
    expect(state.available.value).toBe(true)
    resetSessionState()
    expect(state.available.value).toBe(false)
    useAiAvailability()
    expect(platformAiAvailabilityApi).toHaveBeenCalledTimes(2)
    await state.refresh()
  })

  it('discards late data and preserves a newer request in flight', async () => {
    const oldResponse = deferred()
    const nextResponse = deferred()
    platformAiAvailabilityApi.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(nextResponse.promise)
    const state = useAiAvailability({ autoFetch: false })
    const oldFetch = state.refresh()
    resetSessionState()
    const nextFetch = state.refresh()
    oldResponse.resolve({ data: { available: true, enabledCount: 999 } })
    await oldFetch
    expect(state.available.value).toBe(false)
    expect(state.loading.value).toBe(true)
    const shared = state.refresh()
    expect(platformAiAvailabilityApi).toHaveBeenCalledTimes(2)
    nextResponse.resolve({ data: { available: true, enabledCount: 1 } })
    await Promise.all([nextFetch, shared])
    expect(state.available.value).toBe(true)
  })
})
