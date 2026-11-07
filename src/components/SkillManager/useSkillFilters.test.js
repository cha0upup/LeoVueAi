import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useSkillFilters } from './useSkillFilters.js'

const scopes = []
function mount() {
  const scope = effectScope()
  const base = { valid: true, status: 'published', enabled: true, risk: 'low', category: 'discovery', platforms: ['linux'], pack: 'base' }
  const skills = ref([
    { ...base, name: 'alpha', platforms: ['windows', 'linux'] },
    { ...base, name: 'beta', enabled: false, category: 'collection', risk: 'high', platforms: ['windows'], pack: 'extra' },
    { ...base, name: 'warning', issues: [{ severity: 'WARNING' }] },
    { ...base, name: 'invalid', valid: false }
  ])
  const taxonomy = ref({ domains: ['operation'], risks: ['low', 'high'], statuses: ['published'], accessModes: ['read-only'] })
  const catalogMode = ref('simple'), activeScope = ref('agent-node'), searchKeyword = ref(''), searchResults = ref(null), onChange = vi.fn()
  const model = scope.run(() => useSkillFilters({ skills, taxonomy, catalogMode, activeScope, searchKeyword, searchResults, onChange }))
  scopes.push(scope)
  return { ...model, skills, taxonomy, catalogMode, activeScope, searchKeyword, searchResults, onChange, dispose: () => scope.stop() }
}
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop() })

describe('pure Skill filter model', () => {
  it('derives counters and available options from the complete catalog rather than search results', () => {
    const view = mount()
    expect(view.catalogSummary.value).toEqual({ total: 4, runtime: 2, controlled: 1, problems: 2 })
    expect(view.catalogFilterFields.value.map(field => field.key)).toEqual(['category', 'platform', 'risk', 'availability'])
    expect(view.catalogFilterFields.value.find(field => field.key === 'category').options).toEqual(['collection', 'discovery'])
    expect(view.catalogFilterFields.value.find(field => field.key === 'platform').options).toEqual(['linux', 'windows'])
    view.searchKeyword.value = 'beta'; view.searchResults.value = [view.skills.value[1]]
    expect(view.filteredSkills.value.map(skill => skill.name)).toEqual(['beta'])
    expect(view.catalogSummary.value.total).toBe(4)
    expect(view.catalogFilterFields.value[0].options).toEqual(['collection', 'discovery'])
  })

  it('combines filters and invalidates batch selection synchronously', () => {
    const view = mount()
    view.setFilter('category', 'discovery')
    expect(view.onChange).toHaveBeenCalledOnce()
    view.setFilter('platform', 'windows')
    expect(view.filteredSkills.value.map(skill => skill.name)).toEqual(['alpha'])
    expect(view.activeFilterEntries.value).toEqual([
      { key: 'category', label: '分类', value: 'discovery' }, { key: 'platform', label: '平台', value: 'windows' }
    ])
  })

  it('exposes the complete governance field schema and live taxonomy dictionaries', () => {
    const view = mount()
    view.catalogMode.value = 'governance'
    expect(view.catalogFilterFields.value.map(field => field.key)).toEqual(['domain', 'category', 'pack', 'platform', 'risk', 'accessMode', 'status', 'availability', 'approval', 'health'])
    expect(view.catalogFilterFields.value.find(field => field.key === 'pack').options).toEqual(['base', 'extra'])
    view.taxonomy.value = { ...view.taxonomy.value, risks: ['medium'] }
    expect(view.catalogFilterFields.value.find(field => field.key === 'risk').options).toEqual(['medium'])
  })

  it('drops governance-only criteria on simple mode while preserving visible fields and the problems quick filter', () => {
    const view = mount()
    view.catalogMode.value = 'governance'
    for (const [key, value] of Object.entries({ domain: 'operation', category: 'discovery', platform: 'linux', risk: 'low',
      status: 'published', accessMode: 'read-only', pack: 'base', approval: 'required', health: 'problems', availability: 'runtime' })) view.setFilter(key, value)
    view.catalogMode.value = 'simple'
    expect(view.filters.value).toEqual({ domain: '', category: 'discovery', platform: 'linux', risk: 'low', status: '', accessMode: '', pack: '', approval: '', health: 'problems', availability: 'runtime' })
    expect(view.filteredSkills.value.map(skill => skill.name)).toEqual(['warning'])
  })

  it.each([
    ['availability', 'invalid', '可用性', '不可运行'],
    ['health', 'invalid', '健康', '存在错误'],
    ['status', 'draft', '生命周期', '草稿'],
    ['status', 'published', '生命周期', 'published']
  ])('resolves the %s/%s chip from field-specific choices', (key, value, label, expected) => {
    const view = mount()
    view.setFilter(key, value)
    expect(view.activeFilterEntries.value).toEqual([{ key, label, value: expected }])
    if (key !== 'status') {
      view.catalogMode.value = 'governance'
      expect(view.catalogFilterFields.value.find(field => field.key === key).options)
        .toContainEqual({ value, label: expected })
    }
  })

  it('drops hidden health filters instead of leaving invisible simple-mode restrictions', () => {
    const view = mount()
    view.catalogMode.value = 'governance'; view.setFilter('health', 'healthy')
    view.catalogMode.value = 'simple'
    expect(view.filters.value.health).toBe('')
    expect(view.filteredSkills.value).toHaveLength(4)
  })

  it.each([['runtime', 'availability', 'runtime'], ['controlled', 'availability', 'controlled'],
    ['draft', 'availability', 'draft'], ['problems', 'health', 'problems'], ['warning', 'health', 'warning'], ['invalid', 'health', 'invalid']])('keeps the %s quick-filter contract and resets unrelated criteria', (kind, key, value) => {
      const view = mount()
      view.setFilter('category', 'collection'); view.applyQuickFilter(kind)
      expect(view.filters.value[key]).toBe(value)
      expect(view.filters.value.category).toBe('')
      expect(view.activeFilterEntries.value).toHaveLength(1)
    })

  it('clears all criteria for all/unknown quick filters and supports individual chip removal', () => {
    const view = mount()
    view.setFilter('approval', 'required'); view.setFilter('availability', 'controlled')
    expect(view.activeFilterEntries.value).toContainEqual({ key: 'approval', label: '授权', value: '需要显式授权' })
    view.removeFilter('approval')
    expect(view.filters.value.approval).toBe('')
    view.applyQuickFilter('all'); expect(view.activeFilterEntries.value).toEqual([])
    view.setFilter('risk', 'high'); view.applyQuickFilter('unknown'); expect(view.activeFilterEntries.value).toEqual([])
  })

  it('uses an empty result set during a search and returns to the full catalog for blank keywords', () => {
    const view = mount()
    view.searchKeyword.value = 'pending'
    for (const result of [null, undefined, {}, []]) {
      view.searchResults.value = result
      expect(view.filteredSkills.value).toEqual([])
    }
    view.searchKeyword.value = '  '
    expect(view.filteredSkills.value).toHaveLength(4)
  })

  it('clears criteria on every scope transition, including programmatic changes', () => {
    const view = mount()
    view.setFilter('category', 'collection'); view.onChange.mockClear()
    view.activeScope.value = 'platform'
    expect(view.activeFilterEntries.value).toEqual([])
    expect(view.onChange).toHaveBeenCalledOnce()
    view.setFilter('risk', 'high'); view.activeScope.value = 'agent-node'
    expect(view.activeFilterEntries.value).toEqual([])
  })

  it('accepts only known filter keys and normalizes empty select values', () => {
    const view = mount()
    const original = view.filters.value
    for (const key of ['__proto__', 'constructor', 'unknown']) view.setFilter(key, 'bad')
    expect(view.filters.value).toBe(original)
    expect(view.onChange).not.toHaveBeenCalled()
    view.setFilter('risk', undefined)
    expect(view.filters.value.risk).toBe('')
    expect(view.activeFilterEntries.value).toEqual([])
  })

  it('treats controlled value echoes as no-ops rather than invalidating a user selection', () => {
    const view = mount()
    view.setFilter('category', 'discovery')
    const current = view.filters.value
    view.onChange.mockClear()
    view.setFilter('category', 'discovery')
    view.setFilter('risk', undefined)
    expect(view.filters.value).toBe(current)
    expect(view.onChange).not.toHaveBeenCalled()
  })

  it('isolates instances and disposes selection invalidation watchers', () => {
    const first = mount(), second = mount()
    first.setFilter('risk', 'high')
    expect(second.filters.value.risk).toBe('')
    first.dispose(); first.onChange.mockClear()
    first.setFilter('risk', 'low')
    expect(first.onChange).not.toHaveBeenCalled()
  })
})
