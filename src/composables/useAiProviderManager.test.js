import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createModel: vi.fn(),
  createProvider: vi.fn(),
  deleteProvider: vi.fn(),
  fetchModels: vi.fn(),
  fetchProviderModels: vi.fn(),
  getPresets: vi.fn(),
  listProviders: vi.fn(),
  updateProvider: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/services/api.js', () => ({
  createAiModelConfigApi: mocks.createModel,
  createAiProviderApi: mocks.createProvider,
  deleteAiProviderApi: mocks.deleteProvider,
  fetchAiModelListApi: mocks.fetchModels,
  fetchAiProviderModelListApi: mocks.fetchProviderModels,
  getAiModelProvidersApi: mocks.getPresets,
  listAiProvidersApi: mocks.listProviders,
  updateAiProviderApi: mocks.updateProvider
}))

vi.mock('@/utils/messageUtils.js', () => ({
  showError: mocks.showError,
  showSuccess: mocks.showSuccess
}))

import { useAiProviderManager } from './useAiProviderManager.js'

describe('useAiProviderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createProvider.mockResolvedValue({})
    mocks.fetchProviderModels.mockResolvedValue({ data: [] })
    mocks.listProviders.mockResolvedValue({ data: [] })
  })

  it('creates a provider and includes selected discovered models', async () => {
    const loadModels = vi.fn(async () => {})
    const manager = useAiProviderManager({
      modelRows: ref([]),
      loadModels,
      ensureCapabilitiesLoaded: vi.fn(async () => {}),
      findCapabilityByModelName: vi.fn(() => null),
      testConnection: vi.fn()
    })
    manager.providerFormRef.value = { validate: vi.fn(async () => {}) }
    Object.assign(manager.providerForm, {
      name: 'Example',
      providerKey: 'custom',
      baseUrl: 'https://api.example.test',
      apiKey: 'secret',
      models: [
        { model: 'model-a', name: 'Model A', checked: true },
        { model: 'model-b', name: 'Model B', checked: false }
      ]
    })

    expect(await manager.submitProvider()).toBe(true)
    expect(mocks.createProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Example',
        apiKey: 'secret',
        models: [expect.objectContaining({ model: 'model-a', isActive: 1 })]
      })
    )
    expect(loadModels).toHaveBeenCalledOnce()
  })

  it('adds only missing models during provider synchronization', async () => {
    mocks.fetchProviderModels.mockResolvedValue({ data: ['model-a', 'model-b'] })
    const loadModels = vi.fn(async () => {})
    const manager = useAiProviderManager({
      modelRows: ref([{ id: 1 }]),
      loadModels,
      ensureCapabilitiesLoaded: vi.fn(async () => {}),
      findCapabilityByModelName: vi.fn(() => ({ modelName: 'known' })),
      testConnection: vi.fn()
    })

    await manager.syncProviderModels({
      id: 9,
      providerKey: 'custom',
      models: [{ model: 'model-a' }]
    })

    expect(mocks.createModel).toHaveBeenCalledTimes(1)
    expect(mocks.createModel).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 9,
        model: 'model-b',
        isActive: 0
      })
    )
  })
})
