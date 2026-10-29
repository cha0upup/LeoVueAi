/* eslint-disable vue/one-component-per-file -- Element Plus fixtures exercise the real composer templates. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { compileClientComponent } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import * as stages from './scanStages.js'

const preview = vi.fn()
const start = vi.fn()
const supplemental = vi.fn()
const validate = vi.fn()
const message = { warning: vi.fn(), error: vi.fn() }
const stub = (name) => defineComponent({
  inheritAttrs: false,
  setup(_props, { attrs, slots }) { return () => h(name, attrs, slots.default?.()) }
})
const TargetInput = stub('TargetInput')
const RuleSelector = stub('RuleSelector')
const api = { previewNetworkProbeWorkflowApi: preview, startNetworkProbeWorkflowApi: start, startNetworkFingerprintScanApi: supplemental }
const Composer = compileClientComponent(new URL('./ScanComposer.vue', import.meta.url), {
  '@element-plus/icons-vue': { CaretRight: { render: () => null } },
  'element-plus': { ElMessage: message },
  './TargetInput.vue': { default: TargetInput },
  './PortPolicySelector.vue': { default: stub('PortPolicySelector') },
  './FingerprintRuleSelector.vue': { default: RuleSelector },
  './scanStages.js': stages,
  '@/services/api/scan.js': api
})
const FingerprintComposer = compileClientComponent(new URL('./FingerprintScanComposer.vue', import.meta.url), {
  './FingerprintRuleSelector.vue': { default: RuleSelector },
  '@/services/api/scan.js': api
})
const findAll = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...node.children.flatMap((child) => findAll(child, predicate))
]
const text = (node) => [node.text, ...node.children.map(text)].join('').trim()
const apps = []
function mount(component = Composer, props = {}) {
  const renderer = createTestRenderer()
  const onStarted = vi.fn()
  const onCancel = vi.fn()
  const app = renderer.createApp(component, { sessionId: 'session', ...props, onScanStarted: onStarted, onCancel })
  for (const name of ['ElFormItem', 'ElButton', 'ElIcon', 'ElInput', 'ElInputNumber', 'ElCheckbox', 'ElAlert']) {
    app.component(name, stub(name))
  }
  app.component('ElForm', defineComponent({
    setup(_props, { slots, expose }) {
      expose({ validate })
      return () => h('ElForm', slots.default?.())
    }
  }))
  app.mount(renderer.root)
  apps.push(app)
  const nodes = (name) => findAll(renderer.root, (node) => node.type === name)
  return {
    nodes, onStarted, onCancel,
    button: (label) => nodes('ElButton').find((node) => text(node) === label),
    text: () => text(renderer.root)
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  validate.mockResolvedValue(true)
  start.mockResolvedValue({ data: { taskId: 'large-task' } })
  supplemental.mockResolvedValue({ data: { taskId: 'supplemental-task' } })
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

describe('task-size warnings do not block scan creation', () => {
  it('cancels without validating or submitting a scan', () => {
    const view = mount()
    view.button('取消').props.onClick()
    expect(view.onCancel).toHaveBeenCalledOnce()
    expect(validate).not.toHaveBeenCalled()
    expect(preview).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })

  it('shows a large-host warning while allowing the complete original range to start', async () => {
    preview.mockResolvedValue({ data: { errors: [], preview: {
      hostCount: 16384, combinationCount: 16384, reachabilityProbeCount: 147456,
      stages: [...stages.DEFAULT_SCAN_STAGES],
      warnings: ['扫描主机数超过建议规模 10000，仅提示，不影响开始扫描']
    } } })
    const view = mount()
    view.nodes('TargetInput')[0].props['onUpdate:modelValue']([{ input: '198.18.0.0/18' }])
    await nextTick()
    await view.button('生成预览').props.onClick()
    await nextTick()
    expect(view.text()).toContain('仅提示，不影响开始扫描')
    expect(view.text()).toContain('16,384')
    expect(view.nodes('ElAlert')[0].props.type).toBe('warning')
    expect(view.button('开始扫描').props.disabled).toBe(false)
    await view.button('开始扫描').props.onClick()
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      scan: expect.objectContaining({ targets: { items: ['198.18.0.0/18'], exclude: [] } })
    }))
    expect(view.onStarted).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'large-task' }))
  })

  it('preserves every raw entry beyond the former 256-item quota', async () => {
    preview.mockResolvedValue({ data: { errors: [], preview: {
      hostCount: 300, stages: [...stages.DEFAULT_SCAN_STAGES], warnings: ['输入目标条目较多，仅提示']
    } } })
    const targets = Array.from({ length: 300 }, (_, index) => ({ input: `198.18.${Math.floor(index / 256)}.${index % 256}` }))
    const view = mount()
    view.nodes('TargetInput')[0].props['onUpdate:modelValue'](targets)
    await nextTick()
    await view.button('生成预览').props.onClick()
    await nextTick()
    await view.button('开始扫描').props.onClick()
    expect(preview.mock.calls[0][0].scan.targets.items).toEqual(targets.map((target) => target.input))
    expect(start.mock.calls[0][0].scan.targets.items).toHaveLength(300)
  })

  it('still blocks real validation errors rather than treating them as size warnings', async () => {
    preview.mockResolvedValue({ data: { preview: null, errors: ['端口格式无效'] } })
    const view = mount()
    view.nodes('TargetInput')[0].props['onUpdate:modelValue']([{ input: '198.18.0.1' }])
    await nextTick()
    await view.button('生成预览').props.onClick()
    await nextTick()
    expect(view.button('开始扫描')).toBeUndefined()
    expect(view.button('生成预览')).toBeDefined()
    expect(message.warning).toHaveBeenCalledWith('端口格式无效')
    expect(start).not.toHaveBeenCalled()
  })

  it('warns for large supplemental selections without disabling the start action', async () => {
    const endpoints = Array.from({ length: 300 }, (_, index) => ({ host: 'fixture.test', port: index + 1, endpointId: `endpoint-${index}` }))
    const view = mount(FingerprintComposer, { selection: { sourceTaskId: 'source', endpoints } })
    expect(view.nodes('ElAlert')[0].props.title).toContain('仅提示')
    view.nodes('RuleSelector')[0].props.onValidityChange(true)
    await nextTick()
    expect(view.button('开始补扫').props.disabled).toBe(false)
    await view.button('开始补扫').props.onClick()
    expect(supplemental.mock.calls[0][0].endpointIds).toEqual(endpoints.map((row) => row.endpointId))
  })
})
