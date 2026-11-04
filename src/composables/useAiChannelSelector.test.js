import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useAiChannelSelector } from './useAiChannelSelector.js'

vi.mock('@/services/api/platform-ai.js', () => ({ listAvailableAiModelsApi: vi.fn() }))

const scopes = []
const selectorFixture = options => {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useAiChannelSelector(options))
}
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

describe('AI channel selection', () => {
  it('lists enabled channels and defaults to the active channel', async () => {
    const loadConfigs = vi.fn().mockResolvedValue({ data: [
      { id: 1, enabled: 0, isActive: 0 }, { id: 2, enabled: 1, isActive: 1 },
      { id: 3, enabled: 1, protocol: 'responses', isActive: 0 }
    ] })
    const selector = selectorFixture({ loadConfigs })
    await selector.fetchConfigs()
    expect(selector.configs.value.map(item => item.id)).toEqual([2, 3])
    expect(selector.selectedConfigId.value).toBe(2)
    expect(selector.configs.value[1].protocol).toBe('responses')
    expect(selector.configs.value[0]).not.toHaveProperty('protocol')
  })

  it('retains a manual selection while refreshing the catalog', async () => {
    const selector = selectorFixture({ loadConfigs: async () => ({ data: [
      { id: 2, enabled: 1, isActive: 1 }, { id: 3, enabled: 1, isActive: 0 }
    ] }) })
    selector.selectedConfigId.value = 3
    await selector.fetchConfigs()
    expect(selector.selectedConfigId.value).toBe(3)
  })

  it('leaves an empty deployment unselected', async () => {
    const selector = selectorFixture({ loadConfigs: async () => ({ data: [] }) })
    await selector.fetchConfigs()
    expect(selector.configs.value).toEqual([])
    expect(selector.selectedConfigId.value).toBeNull()
  })

  it('starts with the model default and immediately discards unsupported effort on model switches', async () => {
    const selector = selectorFixture({ loadConfigs: async () => ({ data: [
      { id: 1, isActive: 1, supportsReasoning: true, requestOptions: { source: 'official', reasoningEfforts: ['low', 'high', 'max'] } },
      { id: 2, supportsReasoning: true, requestOptions: { source: 'official', reasoningEfforts: [] } }
    ] }) })
    expect(selector.reasoningEffort.value).toBe('auto')
    await selector.fetchConfigs()
    selector.reasoningEffort.value = 'medium'
    expect(selector.reasoningEffort.value).toBe('auto')
    selector.reasoningEffort.value = 'max'
    expect(selector.reasoningEffort.value).toBe('max')
    selector.selectedConfigId.value = 2
    expect(selector.reasoningEffort.value).toBe('auto')
    selector.selectedConfigId.value = 1
    expect(selector.reasoningEffort.value).toBe('auto')
  })

  it('revalidates effort after a catalog refresh closes thinking or changes supported grades', async () => {
    const loadConfigs = vi.fn().mockResolvedValue({ data: [
      { id: 1, isActive: 1, supportsReasoning: true, requestOptions: { reasoningEfforts: ['high', 'max'] } }
    ] })
    const selector = selectorFixture({ loadConfigs })
    await selector.fetchConfigs()
    selector.reasoningEffort.value = 'max'
    loadConfigs.mockResolvedValue({ data: [
      { id: 1, isActive: 1, supportsReasoning: true, requestOptions: { reasoningEfforts: ['high'] } }
    ] })
    await selector.fetchConfigs()
    expect(selector.reasoningEffort.value).toBe('auto')
    selector.reasoningEffort.value = 'high'
    selector.configs.value[0].thinkingEnabled = 0
    expect(selector.reasoningEffort.value).toBe('auto')
  })

  it('preserves a compatible manual grade and never invents grades from the boolean capability flag', async () => {
    const selector = selectorFixture({ loadConfigs: async () => ({ data: [
      { id: 1, isActive: 1, supportsReasoning: true, requestOptions: { reasoningEfforts: ['high'] } },
      { id: 2, supportsReasoning: true, requestOptions: { reasoningEfforts: ['low', 'high'] } },
      { id: 3, supportsReasoning: true }
    ] }) })
    await selector.fetchConfigs()
    selector.reasoningEffort.value = 'high'
    selector.selectedConfigId.value = 2
    expect(selector.reasoningEffort.value).toBe('high')
    selector.selectedConfigId.value = 3
    expect(selector.reasoningEffort.value).toBe('auto')
    selector.reasoningEffort.value = 'medium'
    expect(selector.reasoningEffort.value).toBe('auto')
  })
})
