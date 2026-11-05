import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import * as reasoning from '@/utils/aiReasoning.js'

const Controls = compileClientComponent(new URL('./AiComposerControls.vue', import.meta.url), {
  'element-plus': { ElMessage: { warning: vi.fn() } },
  '@/utils/aiReasoning.js': reasoning
})
const apps = []
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

function mount(config, effort = 'auto') {
  const renderer = createTestRenderer()
  const changed = vi.fn()
  const state = reactive({ modelValue: 1, configs: [{ id: 1, model: 'fixture', ...config }],
    reasoningEffort: effort, 'onUpdate:reasoningEffort': changed })
  const app = renderer.createApp({ render: () => h(Controls, state) })
  for (const name of ['ElButton', 'ElSelect', 'ElOption', 'ElRadioGroup', 'ElRadioButton', 'Icon', 'ElPopover']) {
    app.component(name, createSlotStub(name, name === 'ElPopover' ? ['reference', 'default'] : ['default']))
  }
  apps.push(app)
  app.mount(renderer.root)
  const effortControl = () => findNodes(renderer.root, node => node.type === 'ElRadioGroup')[0]
  const values = () => findNodes(effortControl(), node => node.type === 'ElRadioButton').map(node => node.props.value)
  return { state, changed, effortControl, values, root: renderer.root,
    modelSelect: () => findNodes(renderer.root, node => node.type === 'ElSelect')[0] }
}

describe('chat reasoning effort controls', () => {
  it.each([
    ['glm-5.3', ['low', 'high', 'max']],
    ['gpt-6.1-sol', ['low', 'medium', 'high', 'xhigh', 'max']],
    ['gemini-4-argon', ['minimal', 'low', 'medium', 'high']],
    ['kimi-k2.7-code', []]
  ])('only renders the declared levels for %s', (model, levels) => {
    const view = mount({ model, supportsReasoning: true, requestOptions: { source: 'official', reasoningEfforts: levels } })
    expect(view.values()).toEqual(['auto', ...levels])
    expect(findNodes(view.effortControl(), node => node.type === 'ElRadioButton')
      .map(node => findNodes(node).map(child => child.text).join('')))
      .toEqual(['auto', ...levels])
    expect(view.effortControl().props.disabled).toBe(levels.length === 0)
  })

  it.each([
    { supportsReasoning: true },
    { supportsReasoning: false, requestOptions: { reasoningEfforts: ['high'] } },
    { supportsReasoning: true, thinkingEnabled: 0, requestOptions: { reasoningEfforts: ['high'] } },
    { supportsReasoning: true, requestOptions: { source: 'conservative', reasoningEfforts: ['low', 'medium', 'high'] } },
    { supportsReasoning: true, requestOptions: { source: 'gateway', reasoningEfforts: ['low', 'medium', 'high', 'max'] } }
  ])('offers only the model default when concrete levels are unavailable: %j', config => {
    const view = mount(config)
    expect(view.values()).toEqual(['auto'])
    expect(view.effortControl().props.disabled).toBe(true)
  })

  it('rejects unsupported events and never displays an obsolete selection after switching model', async () => {
    const view = mount({ supportsReasoning: true, requestOptions: { reasoningEfforts: ['low', 'high', 'max'] } }, 'medium')
    expect(view.effortControl().props['model-value']).toBe('auto')
    view.effortControl().props['onUpdate:modelValue']('medium')
    expect(view.changed).not.toHaveBeenCalled()
    view.effortControl().props['onUpdate:modelValue']('max')
    expect(view.changed).toHaveBeenCalledExactlyOnceWith('max')
    view.state.configs = [{ id: 1, model: 'kimi-k2.7-code', supportsReasoning: true, requestOptions: { reasoningEfforts: [] } }]
    await nextTick()
    expect(view.values()).toEqual(['auto'])
    expect(view.effortControl().props['model-value']).toBe('auto')
    expect(view.effortControl().props.disabled).toBe(true)
  })

  it('displays the original English effort in the selected badge without changing emitted values', async () => {
    const view = mount({ supportsReasoning: true, requestOptions: { reasoningEfforts: ['low', 'high', 'max'] } })
    const badge = () => findNodes(view.root, node => node.props.class === 'model-trigger__effort')[0]
    expect(badge().text).toBe('auto')
    view.state.reasoningEffort = 'max'
    await nextTick()
    expect(badge().text).toBe('max')
    view.effortControl().props['onUpdate:modelValue']('high')
    expect(view.changed).toHaveBeenCalledExactlyOnceWith('high')
  })

  it('uses compact controls and shows provider metadata without duplicating identical model names', async () => {
    const view = mount({ name: 'fixture', providerName: 'Provider', supportsReasoning: true,
      requestOptions: { reasoningEfforts: ['low', 'high', 'max'] } })
    expect(findNodes(view.root, node => node.type === 'ElPopover')[0].props.width).toBe(304)
    expect(view.modelSelect().props.size).toBe('small')
    expect(view.effortControl().props.size).toBe('small')
    expect(view.effortControl().props['aria-label']).toBe('推理强度')
    expect(findNodes(view.root, node => node.props.class === 'model-option__id')).toHaveLength(0)
    expect(findNodes(view.root, node => node.props.class === 'model-option__provider')[0].text).toBe('Provider')
    view.state.configs[0].name = 'Analysis'
    await nextTick()
    expect(findNodes(view.root, node => node.props.class === 'model-option__id')[0].text).toBe('fixture')
  })

  it('keeps both compact controls disabled and rejects changes while a request is running', async () => {
    const view = mount({ supportsReasoning: true, requestOptions: { reasoningEfforts: ['high'] } })
    view.state.disabled = true
    await nextTick()
    expect(view.modelSelect().props.disabled).toBe(true)
    expect(view.effortControl().props.disabled).toBe(true)
    view.effortControl().props['onUpdate:modelValue']('high')
    expect(view.changed).not.toHaveBeenCalled()
  })
})
