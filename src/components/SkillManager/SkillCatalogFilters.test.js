import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
const stub = createSlotStub
const Filters = compileClientComponent(new URL('./SkillCatalogFilters.vue', import.meta.url), { '@iconify/vue': { Icon: stub('Icon') } })
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const category = { key: 'category', label: '主分类', placeholder: '全部分类', options: ['discovery', 'collection'], filterable: true }
const availability = { key: 'availability', label: '运行可用性', placeholder: '全部可用性', options: [
  { value: 'runtime', label: '可进入运行目录' }, { value: 'controlled', label: '受控启用' }
] }
function mount(initial = {}) {
  const props = reactive({ filters: {}, fields: [category, availability], mode: 'simple', ...initial })
  const events = [], renderer = createTestRenderer()
  const app = renderer.createApp({ setup: () => () => h(Filters, {
    ...props, onChange: (...args) => events.push(['change', ...args]), onClear: () => events.push(['clear'])
  }) })
  app.component('ElPopover', stub('ElPopover', ['reference', 'default']))
  for (const name of ['ElSelect', 'ElOption', 'ElButton', 'ElIcon']) app.component(name, stub(name))
  app.mount(renderer.root); apps.push(app)
  return { props, events, text: () => text(renderer.root), nodes: name => findNodes(renderer.root, node => node.type === name) }
}
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

describe('controlled Skill filter popover', () => {
  it('renders the simple-mode schema and preserves popover sizing', () => {
    const view = mount()
    expect(view.nodes('ElPopover')[0].props.width).toBe(520)
    expect(view.nodes('ElSelect')).toHaveLength(2)
    expect(view.nodes('ElSelect')[0].props.placeholder).toBe('全部分类')
    expect(view.nodes('ElOption').slice(0, 2).map(node => node.props.value)).toEqual(['discovery', 'collection'])
    expect(view.nodes('ElOption').slice(2).map(node => node.props.label)).toEqual(['可进入运行目录', '受控启用'])
    expect(view.text()).not.toContain('授权要求')
    expect(view.text()).not.toContain('健康状态')
  })

  it('emits explicit field changes without mutating parent filter props', () => {
    const filters = { category: 'discovery', availability: '' }, view = mount({ filters })
    view.nodes('ElSelect')[0].props['onUpdate:modelValue']('collection')
    view.nodes('ElSelect')[1].props['onUpdate:modelValue']('runtime')
    expect(view.events).toEqual([['change', 'category', 'collection'], ['change', 'availability', 'runtime']])
    expect(filters).toEqual({ category: 'discovery', availability: '' })
  })

  it('reflects controlled updates and delegates clearing to its parent', async () => {
    const view = mount()
    view.props.filters = { category: 'collection' }; await nextTick()
    expect(view.nodes('ElSelect')[0].props['model-value']).toBe('collection')
    expect(view.text()).toContain('(1)')
    expect(view.nodes('ElButton')[0].props.type).toBe('primary')
    view.nodes('ElButton').find(node => text(node) === '清除全部').props.onClick()
    expect(view.events).toEqual([['clear']])
    expect(view.props.filters.category).toBe('collection')
  })

  it('exposes governance-only authorization/health choices through the same event contract', async () => {
    const view = mount({ mode: 'governance', filters: { approval: 'required', health: 'warning' }, fields: [category, availability,
      { key: 'approval', label: '授权要求', options: [{ value: 'not-required', label: '不要求显式授权' }] },
      { key: 'health', label: '健康状态', options: [{ value: 'healthy', label: '健康' }] }
    ] })
    expect(view.nodes('ElPopover')[0].props.width).toBe(760)
    expect(view.nodes('ElSelect')).toHaveLength(4)
    view.nodes('ElSelect')[2].props['onUpdate:modelValue']('not-required')
    view.nodes('ElSelect')[3].props['onUpdate:modelValue']('healthy')
    expect(view.events).toEqual([['change', 'approval', 'not-required'], ['change', 'health', 'healthy']])
    view.props.mode = 'simple'; view.props.fields = [category, availability]; await nextTick()
    expect(view.nodes('ElSelect')).toHaveLength(2)
  })

  it('leaves popover visibility to Element Plus and forwards empty controlled selections', () => {
    const view = mount()
    expect(view.nodes('ElPopover')[0].props.trigger).toBe('click')
    expect(view.nodes('ElPopover')[0].props.visible).toBeUndefined()
    expect(view.nodes('ElPopover')[0].props['onUpdate:visible']).toBeUndefined()
    expect(view.events).toEqual([])
    view.nodes('ElSelect')[0].props['onUpdate:modelValue'](undefined)
    expect(view.events).toEqual([['change', 'category', undefined]])
  })
})
