import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/services/api.js', () => ({
  createAiModelCapabilityApi: mocks.create,
  deleteAiModelCapabilityApi: mocks.remove,
  listAiModelCapabilitiesApi: mocks.list,
  updateAiModelCapabilityApi: mocks.update
}))

vi.mock('@/utils/messageUtils.js', () => ({
  showError: mocks.showError,
  showSuccess: mocks.showSuccess
}))

import { useAiCapabilityRegistry } from './useAiCapabilityRegistry.js'

describe('useAiCapabilityRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue({
      data: [
        { modelName: 'gpt-a', source: 'manual' },
        { modelName: 'reasoner-b', source: 'probe' }
      ]
    })
    mocks.create.mockResolvedValue({})
  })

  it('loads, filters and resolves normalized model names', async () => {
    const registry = useAiCapabilityRegistry()
    await registry.loadCapabilities()
    registry.capabilitySearchKeyword.value = 'reasoner'

    expect(registry.filteredCapabilities.value.map((item) => item.modelName)).toEqual([
      'reasoner-b'
    ])
    expect(registry.findCapabilityByModelName('openai/gpt-a', 'custom')).toMatchObject({
      modelName: 'gpt-a'
    })
  })

  it('persists a new capability and refreshes dependent model state', async () => {
    const onChanged = vi.fn(async () => {})
    const registry = useAiCapabilityRegistry({ onChanged })
    registry.capabilityFormRef.value = { validate: vi.fn(async () => {}) }
    registry.capabilityForm.modelName = 'new-model'

    expect(await registry.submitCapability()).toBe(true)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        modelName: 'new-model',
        supportsTextGeneration: 1
      })
    )
    expect(onChanged).toHaveBeenCalledOnce()
  })
})
