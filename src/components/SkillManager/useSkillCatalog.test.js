import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'

const api = vi.hoisted(() => ({ list: vi.fn(), search: vi.fn(), taxonomy: vi.fn(), health: vi.fn(), error: vi.fn() }))
vi.mock('@/services/api/skills.js', () => ({ listSkillsApi: api.list, searchSkillsApi: api.search, getSkillTaxonomyApi: api.taxonomy, getSkillHealthApi: api.health }))
vi.mock('@/utils/messageUtils.js', () => ({ showError: api.error }))
import { useSkillCatalog } from './useSkillCatalog.js'

const scopes = []
function mount() {
  const scope = effectScope(), activeScope = ref('agent-node')
  const onScopeLoaded = vi.fn(), onSearchChanged = vi.fn()
  const catalog = scope.run(() => useSkillCatalog({ activeScope, scopes: ['agent-node', 'platform'], onScopeLoaded, onSearchChanged }))
  scopes.push(scope)
  return { ...catalog, activeScope, onScopeLoaded, onSearchChanged, dispose: () => scope.stop() }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  api.list.mockResolvedValue({ data: [] })
  api.search.mockResolvedValue({ data: [] })
  api.taxonomy.mockResolvedValue({ data: { categories: ['test'] } })
  api.health.mockResolvedValue({ data: { skills: [] } })
})
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); vi.useRealTimers() })

describe('Skill catalog read state', () => {
  it('loads both scopes and retains taxonomy defaults', async () => {
    const view = mount()
    api.list.mockImplementation(async (scope) => ({ data: [{ name: scope }] }))
    expect(await view.loadCatalog()).toBe(true)
    expect(view.scopeCatalog.value.platform[0].name).toBe('platform')
    expect(view.onScopeLoaded).toHaveBeenCalledTimes(2)
    await view.loadTaxonomy()
    expect(view.taxonomy.value).toEqual(expect.objectContaining({ categories: ['test'], domains: [], accessModes: [], statuses: [] }))
    expect(view.catalogLoading.value).toBe(false)
  })

  it('keeps loading until all scopes settle even when one scope fails', async () => {
    const view = mount(), pending = deferred()
    api.list.mockImplementation(scope => scope === 'platform' ? pending.promise : Promise.reject(new Error('failed')))
    const loading = view.loadCatalog()
    await Promise.resolve(); await Promise.resolve()
    expect(view.catalogLoading.value).toBe(true)
    pending.resolve({ data: [{ name: 'platform' }] })
    expect(await loading).toBe(false)
    expect(view.catalogLoading.value).toBe(false)
    expect(view.scopeCatalog.value.platform).toEqual([{ name: 'platform' }])
    expect(api.error).toHaveBeenCalledWith('加载 Skill Catalog 失败')
  })

  it('ignores stale scope data without clearing the pending refresh state', async () => {
    const view = mount(), old = deferred(), pending = deferred()
    api.list.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ name: 'latest' }] }).mockReturnValueOnce(pending.promise)
    const first = view.loadCatalog()
    const second = view.loadCatalog()
    old.resolve({ data: [{ name: 'stale' }] })
    await first
    expect(view.catalogLoading.value).toBe(true)
    expect(view.scopeCatalog.value['agent-node']).toEqual([{ name: 'latest' }])
    expect(view.onScopeLoaded.mock.calls.filter(([scope]) => scope === 'agent-node'))
      .toEqual([['agent-node', [{ name: 'latest' }]]])

    pending.resolve({ data: [{ name: 'platform' }] })
    await second
    expect(view.scopeCatalog.value.platform).toEqual([{ name: 'platform' }])
    expect(view.catalogLoading.value).toBe(false)
  })

  it('debounces typing and ignores superseded search results and errors', async () => {
    const view = mount(), old = deferred(), superseded = deferred(), latest = deferred()
    api.search.mockReturnValueOnce(old.promise).mockReturnValueOnce(superseded.promise).mockReturnValueOnce(latest.promise)
    view.searchKeyword.value = 'alpha'
    await vi.advanceTimersByTimeAsync(350)
    expect(api.search).toHaveBeenCalledWith('agent-node', 'alpha')
    view.searchKeyword.value = 'beta'
    old.resolve({ data: [{ name: 'alpha' }] })
    await Promise.resolve()
    expect(view.searchResults.value).toEqual([])
    expect(api.search).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(350)

    view.searchKeyword.value = ' gamma '
    await vi.advanceTimersByTimeAsync(350)
    superseded.reject(new Error('stale failure'))
    await vi.advanceTimersByTimeAsync(0)
    expect(view.searchError.value).toBe('')
    expect(view.searchLoading.value).toBe(true)
    latest.resolve({ data: [{ name: 'gamma' }] })
    await vi.advanceTimersByTimeAsync(0)
    expect(api.search.mock.calls).toEqual([['agent-node', 'alpha'], ['agent-node', 'beta'], ['agent-node', 'gamma']])
    expect(view.onSearchChanged).toHaveBeenCalledTimes(3)
    expect(view.searchResults.value).toEqual([{ name: 'gamma' }])
    expect(view.searchLoading.value).toBe(false)
  })

  it('clears searches synchronously when the scope changes, including A-to-B-to-A', async () => {
    const view = mount(), old = deferred()
    api.search.mockReturnValueOnce(old.promise)
    view.searchKeyword.value = 'alpha'
    await vi.advanceTimersByTimeAsync(350)
    view.activeScope.value = 'platform'
    view.activeScope.value = 'agent-node'
    old.resolve({ data: [{ name: 'stale' }] })
    await Promise.resolve()
    expect(view.searchKeyword.value).toBe('')
    expect(view.searchResults.value).toBeNull()
    expect(view.searchLoading.value).toBe(false)
  })

  it('cancels scheduled work and ignores pending failures on disposal', async () => {
    const view = mount(), old = deferred(), catalog = deferred()
    api.search.mockReturnValueOnce(old.promise)
    view.searchKeyword.value = 'active'; await vi.advanceTimersByTimeAsync(350)
    api.list.mockReturnValue(catalog.promise)
    const loading = view.loadCatalog()
    expect(view.catalogLoading.value).toBe(true)
    view.searchKeyword.value = 'scheduled'
    view.dispose()
    expect(view.catalogLoading.value).toBe(false)
    old.reject(new Error('late'))
    catalog.resolve({ data: [] }); await loading
    await vi.advanceTimersByTimeAsync(1000)
    await view.loadTaxonomy()
    expect(api.search).toHaveBeenCalledTimes(1)
    expect(api.taxonomy).not.toHaveBeenCalled()
    expect(api.error).not.toHaveBeenCalled()
    expect(view.searchResults.value).toBeNull()
    expect(view.catalogLoading.value).toBe(false)
  })

  it('clears the last error and cancels a queued search when the keyword is cleared', async () => {
    const view = mount()
    api.search.mockRejectedValueOnce({ response: { data: { msg: 'fixture error' } } })
    view.searchKeyword.value = 'alpha'; await vi.advanceTimersByTimeAsync(350)
    expect(view.searchError.value).toBe('fixture error')
    view.searchKeyword.value = 'queued'
    view.searchKeyword.value = ' '
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.search).toHaveBeenCalledOnce()
    expect(view.searchError.value).toBe('')
    expect(view.searchResults.value).toBeNull()
    expect(view.searchLoading.value).toBe(false)
  })

  it('returns health results only to the scope and revision that requested them', async () => {
    const view = mount(), old = deferred()
    api.health.mockReturnValueOnce(old.promise)
    const first = view.loadHealth()
    view.activeScope.value = 'platform'
    view.activeScope.value = 'agent-node'
    expect(await view.loadHealth()).toEqual({ data: { skills: [] } })
    old.resolve({ data: { skills: [{ name: 'stale' }] } })
    expect(await first).toBeNull()
  })

  it('suppresses health errors after disposal but reports current failures', async () => {
    const view = mount(), pending = deferred()
    api.health.mockRejectedValueOnce(new Error('failure'))
    expect(await view.loadHealth()).toBeNull()
    expect(api.error).toHaveBeenCalledWith('Skill 健康检查失败')
    api.error.mockClear()
    api.health.mockReturnValueOnce(pending.promise)
    const reading = view.loadHealth()
    view.dispose()
    pending.reject(new Error('late'))
    expect(await reading).toBeNull()
    expect(api.error).not.toHaveBeenCalled()
  })
})
