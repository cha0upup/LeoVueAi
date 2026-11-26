import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/services/api/admin.js', () => ({
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

  it('shares the initial load, caches a valid empty result and preserves records on a failed refresh', async () => {
    const initial = deferred()
    mocks.list.mockReturnValueOnce(initial.promise)
    const registry = useAiCapabilityRegistry()
    const loading = registry.loadCapabilities()
    const opening = registry.openCapabilityManager()
    expect(mocks.list).toHaveBeenCalledOnce()

    initial.resolve({ data: [] })
    await Promise.all([loading, opening])
    await registry.openCapabilityManager()
    expect(mocks.list).toHaveBeenCalledOnce()

    await registry.loadCapabilities()
    mocks.list.mockResolvedValueOnce({ data: null })
    await registry.loadCapabilities()
    expect(registry.capabilityLoadError.value).toBe('能力库响应格式异常')
    expect(registry.filteredCapabilities.value.map(item => item.modelName)).toEqual(['gpt-a', 'reasoner-b'])
    expect(mocks.showError).not.toHaveBeenCalled()

    await registry.loadCapabilities()
    expect(registry.capabilityLoadError.value).toBe('')
  })

  it('persists a new capability and refreshes dependent model state', async () => {
    const onChanged = vi.fn(async () => {})
    const registry = useAiCapabilityRegistry({ onChanged })
    const previous = deferred()
    mocks.list.mockReturnValueOnce(previous.promise)
    const earlierLoad = registry.loadCapabilities()
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
    expect(mocks.list).toHaveBeenCalledTimes(2)
    previous.resolve({ data: [] })
    await earlierLoad
    expect(registry.filteredCapabilities.value).toHaveLength(2)
  })
})
