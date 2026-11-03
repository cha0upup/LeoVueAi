import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { compileClientComponent, createSlotStub, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useAiCapabilityRegistry } from '@/composables/useAiCapabilityRegistry.js'
import { useAiProviderManager } from '@/composables/useAiProviderManager.js'
import * as settingsModel from './aiChannelSettingsModel.js'

const api = vi.hoisted(() => Object.fromEntries([
  'listAiModelConfigsApi', 'createAiModelConfigApi', 'updateAiModelConfigApi', 'activateAiModelConfigApi',
  'testAiModelConfigConnectionApi', 'probeAiModelCapabilitiesApi', 'listAiModelHealthApi',
  'createAiModelCapabilityApi', 'deleteAiModelCapabilityApi', 'listAiModelCapabilitiesApi', 'updateAiModelCapabilityApi',
  'createAiProviderApi', 'deleteAiProviderApi', 'fetchAiModelListApi', 'fetchAiProviderModelListApi',
  'getAiModelProvidersApi', 'listAiProvidersApi', 'updateAiProviderApi'
].map(name => [name, vi.fn()])))
const messages = vi.hoisted(() => ({ showError: vi.fn(), showSuccess: vi.fn() }))
vi.mock('@/services/api/admin.js', () => api)
vi.mock('@/utils/messageUtils.js', () => messages)

const childNames = [
  'AiCapabilityRegistryDialogs', 'AiCapabilityProbeDialog', 'AiModelConfigDialog',
  'AiModelDetailPanel', 'AiProviderCatalog', 'AiProviderDialog'
]
const Settings = compileClientComponent(new URL('./AiChannelSettings.vue', import.meta.url), {
  '@/services/api/admin.js': api,
  '@/utils/messageUtils.js': messages,
  '@/composables/useAiCapabilityRegistry.js': { useAiCapabilityRegistry },
  '@/composables/useAiProviderManager.js': { useAiProviderManager },
  './aiChannelSettingsModel.js': settingsModel,
  ...Object.fromEntries(childNames.map(name => [`./${name}.vue`, { default: createSlotStub(name) }]))
})

const flush = async () => { for (let i = 0; i < 6; i++) await nextTick() }
const apps = []

beforeEach(() => {
  vi.resetAllMocks()
  for (const name of ['listAiModelConfigsApi', 'listAiModelHealthApi', 'listAiModelCapabilitiesApi',
    'getAiModelProvidersApi', 'listAiProvidersApi']) api[name].mockResolvedValue({ data: [] })
})
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

async function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(Settings)
  const errors = []
  app.config.errorHandler = error => errors.push(error)
  apps.push(app)
  app.mount(renderer.root)
  await flush()
  return { errors, node: name => findNode(renderer.root, name) }
}

describe('AI channel settings initialization', () => {
  it('mounts the actual setup and loads configuration before displaying the model form', async () => {
    const view = await mount()

    expect(view.errors).toEqual([])
    expect(api.listAiModelConfigsApi).toHaveBeenCalledOnce()
    expect(api.listAiModelCapabilitiesApi).toHaveBeenCalledOnce()
    expect(api.getAiModelProvidersApi).toHaveBeenCalledOnce()
    expect(api.listAiProvidersApi).toHaveBeenCalledOnce()
    expect(view.node('AiModelConfigDialog').props['form-state']).toMatchObject({
      model: '', thinkingEnabled: null, reasoningEffort: 'auto', temperature: null
    })
    expect(messages.showError).not.toHaveBeenCalled()
  })

  it('applies reactive constraints after opening a model and switching its capability identity', async () => {
    api.listAiModelCapabilitiesApi.mockResolvedValue({ data: [
      { modelName: 'kimi-k2.7-code', requestOptions: {
        thinkingRequired: true, reasoningEfforts: [], temperatureConfigurable: false
      } },
      { modelName: 'gpt-6.1-sol', requestOptions: {
        thinkingRequired: true, reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'], temperatureConfigurable: true
      } }
    ] })
    const view = await mount()
    expect(view.errors).toEqual([])
    view.node('AiModelDetailPanel').props.onEdit({
      id: 1, providerId: 2, providerKey: 'kimi', model: 'kimi-k2.7-code',
      thinkingEnabled: 0, reasoningEffort: 'high', temperature: 0.7
    })
    await flush()
    const dialog = () => view.node('AiModelConfigDialog').props
    expect(dialog()['form-state']).toMatchObject({ thinkingEnabled: null, reasoningEffort: 'auto', temperature: null })
    expect(dialog()['reasoning-options'].map(option => option.value)).toEqual(['auto'])
    expect(dialog()['reasoning-mode-options'].map(option => option.value)).toEqual([null, 1])
    expect(dialog()['temperature-configurable']).toBe(false)

    Object.assign(dialog()['form-state'], { providerKey: 'openai', model: 'gpt-6.1-sol' })
    await flush()
    expect(dialog()['reasoning-options'].map(option => option.value)).toEqual(['auto', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(dialog()['temperature-configurable']).toBe(true)
    expect(view.errors).toEqual([])
  })
})
