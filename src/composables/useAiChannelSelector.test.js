import { describe, expect, it, vi } from 'vitest'
import { useAiChannelSelector } from './useAiChannelSelector.js'

vi.mock('@/services/api/platform-ai.js', () => ({ listAvailableAiModelsApi: vi.fn() }))

describe('AI channel selection', () => {
  it('lists enabled channels and defaults to the active channel', async () => {
    const loadConfigs = vi.fn().mockResolvedValue({ data: [
      { id: 1, enabled: 0, isActive: 0 }, { id: 2, enabled: 1, isActive: 1 },
      { id: 3, enabled: 1, protocol: 'anthropic', isActive: 0 }
    ] })
    const selector = useAiChannelSelector({ loadConfigs })
    await selector.fetchConfigs()
    expect(selector.configs.value.map(item => item.id)).toEqual([2, 3])
    expect(selector.selectedConfigId.value).toBe(2)
    expect(selector.configs.value[1].protocol).toBe('anthropic')
    expect(Object.keys(selector)).toEqual(['configs', 'selectedConfigId', 'fetchConfigs'])
  })

  it('retains a manual selection while refreshing the catalog', async () => {
    const selector = useAiChannelSelector({ loadConfigs: async () => ({ data: [
      { id: 2, enabled: 1, isActive: 1 }, { id: 3, enabled: 1, isActive: 0 }
    ] }) })
    selector.selectedConfigId.value = 3
    await selector.fetchConfigs()
    expect(selector.selectedConfigId.value).toBe(3)
  })

  it('leaves an empty deployment unselected', async () => {
    const selector = useAiChannelSelector({ loadConfigs: async () => ({ data: [] }) })
    await selector.fetchConfigs()
    expect(selector.configs.value).toEqual([])
    expect(selector.selectedConfigId.value).toBeNull()
  })
})
