import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { useAiCapabilityRegistry } from '@/composables/ai/useAiCapabilityRegistry.js'
import { useAiProviderManager } from '@/composables/ai/useAiProviderManager.js'
import { useAiModelRequestPreview } from '@/composables/ai/useAiModelRequestPreview.js'
import * as settingsModel from './aiChannelSettingsModel.js'
import { handleError } from '@/utils/errorHandler.js'
import { icons } from '@/utils/icons.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'

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
const settingsModules = {
  '@/utils/icons.js': { icons },
  '@/components/common/PageHeader.vue': { default: createSlotStub('PageHeader', ['default', 'actions']) },
  '@/services/api/admin.js': api,
  '@/utils/errorHandler.js': { handleError },
  '@/utils/latestRequestGuard.js': { createLatestRequestGuard },
  '@/utils/messageUtils.js': messages,
  '@/composables/ai/useAiCapabilityRegistry.js': { useAiCapabilityRegistry },
  '@/composables/ai/useAiProviderManager.js': { useAiProviderManager },
  '@/composables/ai/useAiModelRequestPreview.js': { useAiModelRequestPreview },
  './aiChannelSettingsModel.js': settingsModel,
  ...Object.fromEntries(childNames.map(name => [`./${name}.vue`, { default: createSlotStub(name) }]))
}
const Settings = compileClientComponent(new URL('./AiChannelSettings.vue', import.meta.url), settingsModules)
const Catalog = compileClientComponent(new URL('./AiProviderCatalog.vue', import.meta.url), {
  '@iconify/vue': { Icon: createSlotStub('Icon') },
  '@/components/common/StatsStrip.vue': { default: createSlotStub('StatsStrip') },
  '@/components/Admin/shared/AdminWorkspacePanel.vue': { default: createSlotStub('AdminWorkspacePanel', ['default', 'actions']) },
  '@/components/common/StatusIndicator.vue': { default: createSlotStub('StatusIndicator') },
  '@/utils/icons.js': { icons },
  './aiChannelSettingsModel.js': settingsModel
})
const Detail = compileClientComponent(new URL('./AiModelDetailPanel.vue', import.meta.url), {
  './aiChannelSettingsModel.js': settingsModel
})
const SettingsPage = compileClientComponent(new URL('./AiChannelSettings.vue', import.meta.url), {
  ...settingsModules,
  './AiProviderCatalog.vue': { default: Catalog },
  './AiModelDetailPanel.vue': { default: Detail }
})
const ModelDialog = compileClientComponent(new URL('./AiModelConfigDialog.vue', import.meta.url))

const flush = async () => { for (let i = 0; i < 6; i++) await nextTick() }
const text = node => findNodes(node, item => item.type !== 'comment').map(item => item.text).join(' ')
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

async function mount(component = Settings) {
  const renderer = createTestRenderer()
  const app = renderer.createApp(component)
  for (const name of ['Icon', 'ElIcon', 'ElAlert', 'ElButton', 'ElEmpty', 'ElInput', 'ElPopconfirm', 'ElTag']) {
    app.component(name, createSlotStub(name))
  }
  app.directive('loading', {})
  const errors = []
  app.config.errorHandler = error => errors.push(error)
  apps.push(app)
  app.mount(renderer.root)
  await flush()
  return { errors, node: name => findNode(renderer.root, name), root: renderer.root }
}

async function refresh(view) {
  const button = findNodes(view.root, node => node.type === 'ElButton').find(item => text(item).includes('刷新'))
  await button.props.onClick()
  await flush()
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

  it('keeps refreshing while related reads are pending and ignores repeated refresh clicks', async () => {
    const health = deferred()
    api.listAiModelHealthApi.mockReturnValueOnce(health.promise)
    const view = await mount()
    const catalog = () => view.node('AiProviderCatalog').props

    expect(catalog().loading).toBe(true)
    expect(catalog()['health-read-state']).toBe('loading')
    await catalog().onRefresh()
    expect(api.listAiModelConfigsApi).toHaveBeenCalledOnce()
    expect(api.listAiProvidersApi).toHaveBeenCalledOnce()
    expect(api.listAiModelHealthApi).toHaveBeenCalledOnce()

    health.resolve({ data: [{ configId: 8, status: 'open', circuitOpen: true }] })
    await flush()
    expect(catalog().loading).toBe(false)
    expect(catalog()['health-read-state']).toBe('ready')
    expect(catalog()['model-health-by-id'][8]).toMatchObject({ circuitOpen: true })
  })

  it('preserves the last loaded catalog on failure and only shows an empty state for a successful read', async () => {
    api.listAiProvidersApi
      .mockRejectedValueOnce(new Error('暂时不可用'))
      .mockResolvedValueOnce({ data: [{ id: 2, name: 'Fixture Provider' }] })
      .mockResolvedValueOnce({ data: null })
    api.listAiModelConfigsApi
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 8, model: 'fixture-model', providerId: 2 }] })
      .mockResolvedValueOnce({ data: {} })
    const view = await mount(SettingsPage)
    const metricValues = () => findNodes(view.root, node => node.props.class === 'metric-value').map(node => node.text)

    expect(view.node('ElAlert').props.description).toBe('供应商：暂时不可用')
    expect(text(view.root)).not.toContain('暂无供应商')
    expect(metricValues().slice(0, 2)).toEqual(['—', '0'])
    await refresh(view)
    expect(view.node('ElAlert')).toBeNull()
    await refresh(view)
    expect(view.node('ElAlert').props.description).toBe('供应商：目录响应格式异常；模型：目录响应格式异常')
    expect(text(view.node('article'))).toContain('Fixture Provider')
    const selected = findNodes(view.root, node => node.props['aria-pressed'] === true)
    expect(text(selected[0])).toContain('fixture-model')
    expect(metricValues().slice(0, 2)).toEqual(['—', '—'])

    await refresh(view)
    expect(view.node('ElAlert')).toBeNull()
    expect(text(view.root)).toContain('暂无供应商')
    expect(view.errors).toEqual([])
  })

  it('narrows model search results without changing provider totals or actions', async () => {
    api.listAiProvidersApi.mockResolvedValue({ data: [
      { id: 2, name: 'Fixture Provider', baseUrl: 'https://gateway.example.test' }, { id: 3, name: 'Other Provider' }
    ] })
    api.listAiModelConfigsApi.mockResolvedValue({ data: [
      { id: 8, providerId: 2, model: 'chat-v1' },
      { id: 9, providerId: 2, providerName: 'Fixture Provider', model: 'reasoner-v1', name: ' Team Reasoner ' },
      { id: 10, providerId: 99, model: 'orphan-model' }
    ] })
    const view = await mount(SettingsPage)
    const search = async (keyword) => {
      view.node('ElInput').props['onUpdate:modelValue'](keyword)
      await flush()
    }
    const modelRows = () => findNodes(view.root, node => node.props['aria-pressed'] !== undefined)
    const modelNames = () => modelRows().map(node => findNode(findNode(node, 'strong'), 'text').text.trim())
    const providerCards = () => findNodes(view.root, node => node.type === 'article')

    await search(' TEAM REASONER ')
    expect(modelNames()).toEqual(['Team Reasoner'])
    expect(providerCards()).toHaveLength(1)
    expect(text(providerCards()[0])).toContain('显示 1 个匹配模型')
    expect(text(modelRows()[0])).toContain('ID：reasoner-v1')
    expect(view.node('ElPopconfirm').props.title).toContain('其下 2 个模型')
    await modelRows()[0].props.onClick()
    expect(findNode(view.node('aside'), 'h4').text).toBe('Team Reasoner')
    expect(text(view.node('aside'))).toContain('模型 ID：reasoner-v1')
    expect(text(view.node('aside'))).toContain('来自 Fixture Provider')

    await search('gateway.example.test')
    expect(modelNames()).toEqual(['chat-v1', 'Team Reasoner'])
    expect(findNode(modelRows()[0], 'small')).toBeNull()
    await search('orphan-model')
    expect(text(view.root)).toContain('未找到匹配的供应商或模型')
    await search('')
    expect(providerCards()).toHaveLength(2)
  })

  it('renders read failures, missing health records and observed breaker state distinctly', async () => {
    api.listAiModelConfigsApi.mockResolvedValue({ data: [{ id: 8, model: 'fixture', enabled: 1 }] })
    api.listAiModelHealthApi
      .mockRejectedValueOnce(new Error('health unavailable'))
      .mockResolvedValueOnce({ data: [{ configId: 8, status: 'unknown', circuitOpen: false }] })
      .mockResolvedValueOnce({ data: [{ configId: 8, status: 'half_open', circuitOpen: true, consecutiveFailures: 2 }] })
    const view = await mount(SettingsPage)
    const breaker = () => findNodes(view.root, node => node.props.class === 'metric-card')
      .find(card => text(card).includes('熔断模型'))
    const count = () => findNode(breaker(), 'strong').text

    expect(text(breaker())).toContain('健康状态读取失败')
    expect(text(view.node('aside'))).toContain('健康状态读取失败')
    expect(count()).toBe('—')
    await refresh(view)
    expect(text(breaker())).toContain('暂无健康记录')
    expect(count()).toBe('—')
    await refresh(view)
    expect(text(view.node('aside'))).toContain('半开观察')
    expect(count()).toBe('1')
    expect(text(view.root)).not.toMatch(/全部模型可调度|已切换备用链|将优先使用备用模型/)
    expect(view.errors).toEqual([])
  })

  it('keeps the updated catalog when a refresh started before deletion returns last', async () => {
    const view = await mount()
    const catalog = () => view.node('AiProviderCatalog').props
    const olderProviders = deferred()
    const olderModels = deferred()
    api.listAiProvidersApi.mockReturnValueOnce(olderProviders.promise)
      .mockResolvedValueOnce({ data: [{ id: 2 }] })
    api.listAiModelConfigsApi.mockReturnValueOnce(olderModels.promise)
      .mockResolvedValueOnce({ data: [{ id: 20, providerId: 2 }] })
    api.deleteAiProviderApi.mockResolvedValueOnce({})

    const refresh = catalog().onRefresh()
    await catalog().onRemoveProvider({ id: 1 })
    olderProviders.resolve({ data: [{ id: 1 }] })
    olderModels.resolve({ data: [{ id: 10, providerId: 1 }] })
    await refresh
    await nextTick()

    expect(catalog()['saved-providers']).toEqual([{ id: 2 }])
    expect(catalog().rows).toEqual([{ id: 20, providerId: 2 }])
    expect(catalog()['selected-model-id']).toBe(20)
    expect(catalog().loading).toBe(false)
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
