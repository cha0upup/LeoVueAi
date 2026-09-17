import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { useFingerprintDetails } from './useFingerprintDetails.js'
import {
  queryNetworkFingerprintMatchesApi,
  queryNetworkFingerprintEvidenceApi
} from '@/services/api.js'

vi.mock('@/services/api.js', () => ({
  queryNetworkFingerprintMatchesApi: vi.fn(),
  queryNetworkFingerprintEvidenceApi: vi.fn()
}))
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('component evidence requests', () => {
  let scope
  afterEach(() => {
    scope?.stop()
    vi.resetAllMocks()
  })
  function fixture() {
    scope = effectScope()
    const props = reactive({
      sessionId: 'one',
      taskId: 'task',
      endpointId: 'endpoint',
      refreshToken: 0
    })
    const view = scope.run(() => useFingerprintDetails(props))
    return { props, view }
  }

  it('discards old-session list and evidence responses', async () => {
    const oldList = deferred()
    const oldEvidence = deferred()
    queryNetworkFingerprintMatchesApi
      .mockReturnValueOnce(oldList.promise)
      .mockResolvedValue({ data: { matches: [{ ruleName: 'new' }], total: 1 } })
    queryNetworkFingerprintEvidenceApi.mockReturnValueOnce(oldEvidence.promise)
    const { props, view } = fixture()
    const pendingEvidence = view.showEvidence({ matchKey: 'old' })
    props.sessionId = 'two'
    await nextTick()
    oldList.resolve({ data: { matches: [{ ruleName: 'old' }], total: 1 } })
    oldEvidence.resolve({ data: { match: { ruleName: 'old' } } })
    await pendingEvidence
    await nextTick()
    expect(view.matches.value).toEqual([{ ruleName: 'new' }])
    expect(view.evidence.value).toBeNull()
    expect(view.evidenceLoading.value).toBe(false)
  })

  it('keeps the latest selected evidence and ignores updates after disposal', async () => {
    queryNetworkFingerprintMatchesApi.mockResolvedValue({ data: { matches: [], total: 0 } })
    const old = deferred()
    queryNetworkFingerprintEvidenceApi
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ data: { match: { ruleName: 'new' } } })
    const { view } = fixture()
    const pending = view.showEvidence({ matchKey: 'old' })
    await view.showEvidence({ matchKey: 'new' })
    scope.stop()
    old.resolve({ data: { match: { ruleName: 'old' } } })
    await pending
    expect(view.evidence.value.match.ruleName).toBe('new')
  })

  it('reports failed loads and allows retry with pagination', async () => {
    queryNetworkFingerprintMatchesApi
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: { matches: [{ ruleName: 'Demo' }], total: 21 } })
    const { view } = fixture()
    await nextTick()
    expect(view.error.value).toBe('offline')
    view.page.value = 2
    await view.load()
    expect(view.error.value).toBe('')
    expect(view.total.value).toBe(21)
    expect(queryNetworkFingerprintMatchesApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 20 })
    )
  })
})
