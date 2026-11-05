import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useAiCapabilityRegistry } from '@/composables/useAiCapabilityRegistry.js'
import { useAiProviderManager } from '@/composables/useAiProviderManager.js'
import { useAiModelRequestPreview } from '@/composables/useAiModelRequestPreview.js'
import * as settingsModel from './aiChannelSettingsModel.js'
import { icons } from '@/utils/icons.js'

const api = vi.hoisted(() => Object.fromEntries([
  'listAiModelConfigsApi', 'createAiModelConfigApi', 'updateAiModelConfigApi', 'activateAiModelConfigApi',
  'testAiModelConfigConnectionApi', 'probeAiModelCapabilitiesApi', 'listAiModelHealthApi',
  'createAiModelCapabilityApi', 'deleteAiModelCapabilityApi', 'listAiModelCapabilitiesApi', 'updateAiModelCapabilityApi',
  'createAiProviderApi', 'deleteAiProviderApi', 'fetchAiModelListApi', 'fetchAiProviderModelListApi',
  'getAiModelProvidersApi', 'listAiProvidersApi', 'updateAiProviderApi', 'previewAiModelRequestApi'
].map(name => [name, vi.fn()])))
const messages = vi.hoisted(() => ({ showError: vi.fn(), showSuccess: vi.fn() }))
vi.mock('@/services/api/admin.js', () => api)
vi.mock('@/utils/messageUtils.js', () => messages)

const childNames = [
  'AiCapabilityRegistryDialogs', 'AiCapabilityProbeDialog', 'AiModelConfigDialog',
  'AiModelDetailPanel', 'AiProviderCatalog', 'AiProviderDialog'
]
const Settings = compileClientComponent(new URL('./AiChannelSettings.vue', import.meta.url), {
  '@/utils/icons.js': { icons },
  '@/components/common/PageHeader.vue': { default: createSlotStub('PageHeader', ['default', 'actions']) },
  '@/services/api/admin.js': api,
  '@/utils/messageUtils.js': messages,
  '@/composables/useAiCapabilityRegistry.js': { useAiCapabilityRegistry },
  '@/composables/useAiProviderManager.js': { useAiProviderManager },
  '@/composables/useAiModelRequestPreview.js': { useAiModelRequestPreview },
  './aiChannelSettingsModel.js': settingsModel,
  ...Object.fromEntries(childNames.map(name => [`./${name}.vue`, { default: createSlotStub(name) }]))
})
const ModelDialog = compileClientComponent(new URL('./AiModelConfigDialog.vue', import.meta.url))

const flush = async () => { for (let i = 0; i < 6; i++) await nextTick() }
const apps = []

beforeEach(() => {
  vi.resetAllMocks()
  for (const name of ['listAiModelConfigsApi', 'listAiModelHealthApi', 'listAiModelCapabilitiesApi',
    'getAiModelProvidersApi', 'listAiProvidersApi']) api[name].mockResolvedValue({ data: [] })
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(Settings)
  for (const name of ['Icon', 'ElIcon', 'ElButton']) app.component(name, createSlotStub(name))
  const errors = []
  app.config.errorHandler = error => errors.push(error)
  apps.push(app)
  app.mount(renderer.root)
  await flush()
  return { errors, node: name => findNode(renderer.root, name), root: renderer.root }
}

describe('AI channel settings initialization', () => {
  it.each(['374px', '783px 360px'])('focuses model details only in a stacked layout (%s)', async columns => {
    vi.stubGlobal('window', { getComputedStyle: () => ({ gridTemplateColumns: columns }) })
    const view = await mount()
    const detail = { scrollIntoView: vi.fn(), focus: vi.fn() }
    const row = { scrollIntoView: vi.fn(), focus: vi.fn() }
    const layout = findNodes(view.root).find(node => node.props.class === 'access-layout')
    layout.querySelector = selector => selector === '.model-detail-panel' ? detail : row
    await view.node('AiProviderCatalog').props.onSelectModel({ id: 8 })
    await flush()
    expect(view.node('AiProviderCatalog').props['selected-model-id']).toBe(8)
    expect(detail.focus).toHaveBeenCalledTimes(columns === '374px' ? 1 : 0)
    expect(detail.scrollIntoView).toHaveBeenCalledTimes(columns === '374px' ? 1 : 0)
    if (columns === '374px') {
      view.node('AiModelDetailPanel').props.onBack()
      expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
      expect(row.focus).toHaveBeenCalledWith({ preventScroll: true })
    }
    expect(view.errors).toEqual([])
  })

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
    expect(view.node('AiModelConfigDialog').props['form-state']).not.toHaveProperty('protocol')
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
    expect(dialog()['form-state']).toMatchObject({ thinkingEnabled: null, reasoningEffort: 'auto', temperature: 0.7 })
    expect(dialog()['reasoning-options'].map(option => option.value)).toEqual(['auto'])
    expect(dialog()['reasoning-mode-options'].map(option => option.value)).toEqual([null, 1])
    expect(dialog()['temperature-configurable']).toBe(false)

    Object.assign(dialog()['form-state'], { providerKey: 'openai', model: 'gpt-6.1-sol' })
    await flush()
    expect(dialog()['reasoning-options'].map(option => option.value)).toEqual(['auto', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(dialog()['temperature-configurable']).toBe(true)
    expect(view.errors).toEqual([])
  })

  it('blocks persistence when local planning reports an invalid draft', async () => {
    api.previewAiModelRequestApi.mockResolvedValue({ data: {
      valid: false, contract: {}, parameters: [], requestParameters: {},
      errors: [{ field: 'temperature', message: '采样值超出范围' }]
    } })
    const view = await mount()
    view.node('AiModelDetailPanel').props.onEdit({ id: 7, providerId: 1, model: 'mimo-v2.6-pro' })
    await flush()
    await view.node('AiModelConfigDialog').props.onSubmit()
    expect(api.previewAiModelRequestApi).toHaveBeenCalledOnce()
    expect(api.updateAiModelConfigApi).not.toHaveBeenCalled()
    expect(messages.showError).toHaveBeenCalledExactlyOnceWith('采样值超出范围')
    expect(view.errors).toEqual([])
  })

  it('normalizes a stale grade after the authoritative preview arrives even without a registry match', async () => {
    vi.useFakeTimers()
    api.previewAiModelRequestApi.mockResolvedValue({ data: {
      valid: false, contract: { source: 'official', reasoningEfforts: [], thinkingRequired: true },
      errors: [{ field: 'reasoningEffort', message: '仅支持 auto' }]
    } })
    const view = await mount()
    view.node('AiModelDetailPanel').props.onEdit({ id: 7, providerId: 1, model: 'kimi-k2.7-code', reasoningEffort: 'high' })
    await flush()
    expect(view.node('AiModelConfigDialog').props['form-state'].reasoningEffort).toBe('high')
    await vi.advanceTimersByTimeAsync(250)
    await flush()
    const dialog = view.node('AiModelConfigDialog').props
    expect(dialog['form-state'].reasoningEffort).toBe('auto')
    expect(dialog['reasoning-options'].map(option => option.value)).toEqual(['auto'])
    expect(view.errors).toEqual([])
  })

  it('updates only model-owned fields and leaves provider editing state untouched', async () => {
    api.previewAiModelRequestApi.mockResolvedValue({ data: { valid: true } })
    api.updateAiModelConfigApi.mockResolvedValue({ data: {} })
    const view = await mount()
    view.node('AiModelDetailPanel').props.onEdit({
      id: 7, name: '  Model  ', providerId: 2, providerKey: 'mimo', providerName: 'Saved provider',
      model: 'mimo-v2.6-pro', baseUrl: 'https://example.test/v1', protocol: 'chat_completions',
      completionsPath: '/chat/completions', temperature: 0.7
    })
    await flush()
    view.node('AiModelConfigDialog').props['form-state'].temperature = null
    await view.node('AiModelConfigDialog').props.onSubmit()
    expect(api.updateAiModelConfigApi).toHaveBeenCalledExactlyOnceWith(7, {
      name: 'Model', providerId: 2, model: 'mimo-v2.6-pro',
      thinkingEnabled: null, reasoningEffort: 'auto', maxOutputTokens: null, contextWindowTokens: null,
      temperature: null, fallbackModelId: null, remark: '', enabled: 1, isActive: 0
    })
    expect(api.createAiModelConfigApi).not.toHaveBeenCalled()
    expect(view.node('AiProviderDialog').props['selected-provider-key']).toBe('')
    expect(view.errors).toEqual([])
  })

  it('renders effective parameters, dynamic bounds and field errors in the actual model dialog', async () => {
    const renderer = createTestRenderer()
    const state = reactive({ modelValue: true, rules: {},
      formState: { model: 'mimo-v2.6-pro', temperature: 0.7 },
      temperatureConfigurable: false, requestPreview: null,
      parameterRules: { maxOutputTokens: { maximum: 131072 }, contextWindowTokens: { maximum: 1000000 },
        temperature: { fixedValue: 1, maximum: 1.5 } }
    })
    const app = renderer.createApp({ render: () => h(ModelDialog, state) })
    for (const name of ['ElDialog', 'ElForm', 'ElFormItem', 'ElInput', 'ElInputNumber', 'ElSelect', 'ElOption',
      'ElCheckbox', 'ElCollapse', 'ElCollapseItem', 'ElRadioGroup', 'ElRadioButton', 'ElSegmented', 'ElButton', 'ElAlert']) {
      app.component(name, createSlotStub(name, name === 'ElDialog' ? ['default', 'footer'] : ['default']))
    }
    const errors = []
    app.config.errorHandler = error => errors.push(error)
    apps.push(app)
    app.mount(renderer.root)
    const text = node => findNodes(node).map(child => child.text).join(' ')
    expect(findNode(renderer.root, 'ElDialog').props.title).toBe('编辑模型配置')
    expect(findNodes(renderer.root, node => node.type === 'ElSelect')).toHaveLength(1)
    expect(text(renderer.root)).toContain('选择供应商并填写模型 ID 后自动预览')

    state.requestPreview = { valid: true, contract: { source: 'official', checkedAt: '2026-11-04' }, errors: [],
      requestParameters: { model: 'mimo-v2.6-pro', max_completion_tokens: 131072 },
      parameters: [{ field: 'temperature', configuredValue: 0.7, effectiveValue: 1, status: 'omitted', reason: '厂商固定' }] }
    await flush()
    expect(text(findNode(renderer.root, 'thead'))).toContain('参数 配置值 生效值 处理方式')
    expect(text(findNode(renderer.root, 'tbody'))).toContain('Temperature 0.7 1 省略')
    expect(text(findNode(renderer.root, 'pre'))).toContain('"max_completion_tokens": 131072')
    expect(findNodes(renderer.root, node => node.type === 'ElInputNumber').map(node => node.props.max))
      .toEqual([1000000, 131072])
    const clear = findNodes(renderer.root, node => node.type === 'ElButton')
      .find(node => text(node).includes('清除已配置采样值'))
    clear.props.onClick()
    expect(state.formState.temperature).toBeNull()

    state.requestPreview = { valid: false, errors: [{ field: 'temperature', message: '采样值超出范围' }] }
    await flush()
    expect(text(findNode(renderer.root, 'ul'))).toContain('Temperature：采样值超出范围')
    expect(findNode(renderer.root, 'table')).toBeNull()
    expect(errors).toEqual([])
  })
})
