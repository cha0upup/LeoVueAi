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

vi.mock('@/services/api/admin.js', () => ({
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

  it('loads the Kimi preset, discovers models and saves their inherited connection', async () => {
    const preset = {
      key: 'kimi', label: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.cn/v1',
      protocol: 'chat_completions', completionsPath: '/chat/completions',
      popularModels: ['kimi-k3.1-pro', 'kimi-k2.6']
    }
    mocks.getPresets.mockResolvedValue({ data: [preset] })
    mocks.fetchModels.mockResolvedValue({ data: ['kimi-k3.1-pro', 'kimi-k2.6'] })
    const findCapabilityByModelName = vi.fn(() => ({ source: 'system' }))
    const manager = useAiProviderManager({
      modelRows: ref([]), loadModels: vi.fn(async () => {}),
      ensureCapabilitiesLoaded: vi.fn(async () => {}), findCapabilityByModelName,
      testConnection: vi.fn()
    })
    manager.openProviderCreate()
    await manager.loadProviders()
    manager.selectProviderPreset(manager.providers.value[0])
    expect(manager.selectedProviderKey.value).toBe('kimi')
    expect(manager.providerForm.models).toEqual([
      { model: 'kimi-k3.1-pro', name: 'kimi-k3.1-pro', checked: false },
      { model: 'kimi-k2.6', name: 'kimi-k2.6', checked: false }
    ])
    expect(manager.providerForm).toMatchObject({
      providerKey: 'kimi', name: preset.label, baseUrl: preset.baseUrl,
      protocol: 'chat_completions', completionsPath: '/chat/completions'
    })
    manager.providerForm.apiKey = 'test-key'
    await manager.fetchProviderFormModels()
    expect(mocks.fetchModels).toHaveBeenCalledExactlyOnceWith({
      baseUrl: preset.baseUrl, apiKey: 'test-key', providerKey: 'kimi',
      protocol: 'chat_completions', completionsPath: '/chat/completions'
    })

    expect(await manager.submitProvider()).toBe(true)
    expect(mocks.createProvider).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      providerKey: 'kimi', baseUrl: preset.baseUrl, protocol: 'chat_completions',
      completionsPath: '/chat/completions', apiKey: 'test-key',
      models: [
        expect.objectContaining({ model: 'kimi-k3.1-pro', isActive: 1, reasoningEffort: 'auto' }),
        expect.objectContaining({ model: 'kimi-k2.6', isActive: 0, reasoningEffort: 'auto' })
      ]
    }))
    expect(findCapabilityByModelName).toHaveBeenCalledWith('kimi-k3.1-pro', 'kimi')
    expect(mocks.showError).not.toHaveBeenCalled()
  })
})
