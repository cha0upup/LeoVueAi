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
  for (const name of ['ElButton', 'ElSelect', 'ElOption', 'Icon', 'ElPopover']) {
    app.component(name, createSlotStub(name, name === 'ElPopover' ? ['reference', 'default'] : ['default']))
  }
  apps.push(app)
  app.mount(renderer.root)
  const select = () => findNodes(renderer.root, node => node.type === 'ElSelect')[1]
  const values = () => findNodes(select(), node => node.type === 'ElOption').map(node => node.props.value)
  return { state, changed, select, values, root: renderer.root }
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
    expect(findNodes(view.select(), node => node.type === 'ElOption').map(node => node.props.label))
      .toEqual(['auto', ...levels])
    expect(view.select().props.disabled).toBe(levels.length === 0)
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
    expect(view.select().props.disabled).toBe(true)
  })

  it('rejects unsupported events and never displays an obsolete selection after switching model', async () => {
    const view = mount({ supportsReasoning: true, requestOptions: { reasoningEfforts: ['low', 'high', 'max'] } }, 'medium')
    expect(view.select().props['model-value']).toBe('auto')
    view.select().props['onUpdate:modelValue']('medium')
    expect(view.changed).not.toHaveBeenCalled()
    view.select().props['onUpdate:modelValue']('max')
    expect(view.changed).toHaveBeenCalledExactlyOnceWith('max')
    view.state.configs = [{ id: 1, model: 'kimi-k2.7-code', supportsReasoning: true, requestOptions: { reasoningEfforts: [] } }]
    await nextTick()
    expect(view.values()).toEqual(['auto'])
    expect(view.select().props['model-value']).toBe('auto')
    expect(view.select().props.disabled).toBe(true)
  })

  it('displays the original English effort in the selected badge without changing emitted values', async () => {
    const view = mount({ supportsReasoning: true, requestOptions: { reasoningEfforts: ['low', 'high', 'max'] } })
    const badge = () => findNodes(view.root, node => node.props.class === 'model-trigger__effort')[0]
    expect(badge().text).toBe('auto')
    view.state.reasoningEffort = 'max'
    await nextTick()
    expect(badge().text).toBe('max')
    view.select().props['onUpdate:modelValue']('high')
    expect(view.changed).toHaveBeenCalledExactlyOnceWith('high')
  })
})
