import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabaseConnectionsApi } from '@/services/api/agent-manage.js'
import { deferred } from '@/test-support/deferred.js'
import { useDatabaseConnectionList } from './useDatabaseConnectionList.js'

vi.mock('@/services/api/agent-manage.js', () => ({ getDatabaseConnectionsApi: vi.fn() }))

describe('database connection list refresh', () => {
  let scope
  let sessionId
  let list

  beforeEach(() => {
    getDatabaseConnectionsApi.mockReset()
    scope = effectScope()
    sessionId = ref('session-1')
    list = scope.run(() => useDatabaseConnectionList(sessionId))
  })

  afterEach(() => scope.stop())

  it('keeps the latest list when an earlier refresh returns after a status change', async () => {
    const earlier = deferred()
    const latest = deferred()
    getDatabaseConnectionsApi.mockReturnValueOnce(earlier.promise).mockReturnValueOnce(latest.promise)

    const earlierLoad = list.loadSavedConfigs()
    const latestLoad = list.loadSavedConfigs({ silent: true })
    latest.resolve({ data: [{ connectionId: 'db', status: 0 }] })
    await latestLoad
    const loadingAfterLatest = list.savedLoading.value
    earlier.resolve({ data: [{ connectionId: 'db', status: 1 }] })
    await earlierLoad

    expect(list.savedConfigs.value).toEqual([{ connectionId: 'db', status: 0 }])
    expect(loadingAfterLatest).toBe(false)
    expect(getDatabaseConnectionsApi.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('ignores a superseded failure and keeps the spinner for the active refresh', async () => {
    const earlier = deferred()
    const latest = deferred()
    getDatabaseConnectionsApi.mockReturnValueOnce(earlier.promise).mockReturnValueOnce(latest.promise)

    const earlierLoad = list.loadSavedConfigs()
    const latestLoad = list.loadSavedConfigs({ silent: true })
    earlier.reject(new Error('obsolete request failed'))
    await earlierLoad
    const stateDuringLatest = [list.savedLoading.value, list.loadFailed.value]
    latest.resolve({ data: [] })
    await latestLoad

    expect(stateDuringLatest).toEqual([true, false])
    expect(list.savedLoading.value).toBe(false)
    expect(list.loadFailed.value).toBe(false)
  })

  it('clears the list when the session changes and ignores a response from the previous session', async () => {
    const earlier = deferred()
    const latest = deferred()
    getDatabaseConnectionsApi.mockResolvedValueOnce({ data: [{ connectionId: 'old-db' }] })
      .mockReturnValueOnce(earlier.promise)
      .mockReturnValueOnce(latest.promise)
    await list.loadSavedConfigs()

    const earlierLoad = list.loadSavedConfigs({ silent: true })
    sessionId.value = 'session-2'
    earlier.resolve({ data: [{ connectionId: 'old-db' }] })
    await earlierLoad

    expect(list.savedConfigs.value).toEqual([])
    expect(list.loadFailed.value).toBe(false)
    expect(getDatabaseConnectionsApi.mock.calls[1][1].signal.aborted).toBe(true)
    expect(getDatabaseConnectionsApi.mock.lastCall[0]).toEqual({ sessionId: 'session-2' })

    latest.resolve({ data: [{ connectionId: 'new-db' }] })
    await vi.waitFor(() => expect(list.savedConfigs.value).toEqual([{ connectionId: 'new-db' }]))
    expect(list.savedLoading.value).toBe(false)
  })
})
