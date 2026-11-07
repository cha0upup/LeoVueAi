/* eslint vue/one-component-per-file: off -- The fixture needs independent table and scoped-column stubs. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import * as model from './skillUiModel.js'
const stub = createSlotStub
const Table = compileClientComponent(new URL('./SkillCatalogTable.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') }, '@/utils/icons.js': { icons: {} },
  './SkillAvailabilityTag.vue': { default: stub('SkillAvailabilityTag') }, './skillUiModel.js': model
})
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
async function flush() { for (let i = 0; i < 4; i++) await nextTick() }
async function mount(overrides = {}, delayedEcho = false) {
  const alpha = { name: 'alpha', description: 'fixture alpha', valid: true, enabled: false, status: 'published', risk: 'low', category: 'test', platforms: ['linux', 'windows', 'macos'] }
  const beta = { ...alpha, name: 'beta' }
  const props = reactive({ items: [alpha, beta], selectedNames: new Set(), isAdmin: true, mode: 'simple', ...overrides })
  const row = ref(props.items[0]), events = [], widget = { selected: [], clear: vi.fn(), select: vi.fn() }
  const renderer = createTestRenderer()
  const app = renderer.createApp({ setup: () => () => h(Table, {
    ...props, onSelectionChange: rows => events.push(['selection', rows]),
    onOpen: value => events.push(['open', value]), onToggle: value => events.push(['toggle', value]),
    onCommand: (...args) => events.push(['command', ...args])
  }) })
  app.component('ElTable', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots, expose }) {
      const notify = () => {
        const snapshot = [...widget.selected]
        if (delayedEcho) Promise.resolve().then(() => attrs.onSelectionChange(snapshot))
        else attrs.onSelectionChange(snapshot)
      }
      expose({
        clearSelection: () => { widget.clear(); widget.selected = []; notify() },
        toggleRowSelection: (item, selected) => {
          widget.select(item, selected)
          widget.selected = widget.selected.filter(candidate => candidate.name !== item.name)
          if (selected) widget.selected.push(item)
          notify()
        }
      })
      return () => h('ElTable', attrs, slots.default?.())
    }
  }))
  app.component('ElTableColumn', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) { return () => h('ElTableColumn', attrs, slots.default?.({ row: row.value })) }
  }))
  for (const name of ['ElButton', 'ElTooltip', 'ElTag', 'ElIcon', 'ElDropdownMenu', 'ElDropdownItem']) app.component(name, stub(name))
  app.component('ElDropdown', stub('ElDropdown', ['default', 'dropdown']))
  app.directive('loading', {})
  app.mount(renderer.root); apps.push(app); await flush()
  return {
    app, props, row, widget, events,
    nodes: name => findNodes(renderer.root, node => node.type === name), text: () => text(renderer.root)
  }
}
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

describe('controlled Skill catalog table', () => {
  it('owns widget selection synchronization without emitting programmatic echoes', async () => {
    const view = await mount({ selectedNames: new Set(['beta']) })
    expect(view.widget.selected.map(row => row.name)).toEqual(['beta'])
    expect(view.events).toEqual([])
    view.props.selectedNames = new Set(['alpha']); await flush()
    expect(view.widget.selected.map(row => row.name)).toEqual(['alpha'])
    expect(view.events).toEqual([])
    expect([...view.props.selectedNames]).toEqual(['alpha'])
  })

  it('suppresses next-microtask selection echoes from the widget too', async () => {
    const view = await mount({ selectedNames: new Set(['alpha', 'beta']) }, true)
    expect(view.widget.selected).toHaveLength(2)
    expect(view.events).toEqual([])
  })

  it('rebinds selected names to refreshed row objects and ignores removed names', async () => {
    const view = await mount({ selectedNames: new Set(['alpha', 'beta']) })
    const replacement = { name: 'beta', valid: true, enabled: true, status: 'published' }
    view.props.items = [replacement]; await flush()
    expect(view.widget.selected).toHaveLength(1)
    expect(view.widget.selected[0]).toEqual(replacement)
    expect(view.events).toEqual([])
  })

  it('emits only visible row models for user changes and never mutates the controlled set', async () => {
    const view = await mount()
    const beta = view.props.items[1]
    view.nodes('ElTable')[0].props.onSelectionChange([beta, { name: 'hidden' }])
    expect(view.events).toEqual([['selection', [beta]]])
    expect(view.props.selectedNames.size).toBe(0)
  })

  it('skips identical selections and applies the latest rapid controlled update', async () => {
    const view = await mount({ selectedNames: new Set(['beta']) })
    view.nodes('ElTable')[0].props.onSelectionChange([view.props.items[1]])
    expect(view.events).toEqual([])
    view.props.selectedNames = new Set(['alpha'])
    view.props.items = [view.props.items[1]]
    view.props.selectedNames = new Set(['beta'])
    await flush()
    expect(view.widget.selected.map(row => row.name)).toEqual(['beta'])
    expect(view.events).toEqual([])
  })

  it('preserves the simple and governance column contracts', async () => {
    const view = await mount()
    const labels = () => view.nodes('ElTableColumn').map(node => node.props.label).filter(Boolean)
    expect(labels()).toContain('分类 / 平台')
    expect(labels()).not.toContain('生命周期')
    view.props.mode = 'governance'; await flush()
    expect(labels()).toEqual(['Skill', '分类 / 能力包', '平台', '风险 / 访问', '生命周期', '运行状态', '操作'])
    expect(view.nodes('ElTable')[0].props['row-key']).toBe('name')
    expect(view.nodes('ElTableColumn')[0].props['reserve-selection']).toBe(false)
    expect(view.text()).toContain('+1')
  })

  it('emits row actions without leaking the widget column/event arguments', async () => {
    const view = await mount()
    view.nodes('ElTable')[0].props.onRowDblclick(view.row.value, { internalColumn: true })
    view.nodes('ElButton').find(node => text(node) === '打开').props.onClick({ stopPropagation() {} })
    view.nodes('ElButton').find(node => text(node) === '启用').props.onClick({ stopPropagation() {} })
    view.nodes('ElDropdown')[0].props.onCommand('export')
    expect(view.events).toEqual([
      ['open', view.row.value], ['open', view.row.value], ['toggle', view.row.value], ['command', 'export', view.row.value]
    ])
  })

  it('uses the shared enable policy while still allowing disabled skills to be disabled', async () => {
    const view = await mount()
    view.row.value = { ...view.row.value, valid: false }; await flush()
    expect(view.nodes('ElButton').find(node => text(node) === '启用').props.disabled).toBe(true)
    view.row.value = { ...view.row.value, enabled: true }; await flush()
    expect(view.nodes('ElButton').find(node => text(node) === '禁用').props.disabled).toBe(false)
  })

  it('keeps export/open visible but hides mutation controls for read-only users', async () => {
    const view = await mount({ isAdmin: false })
    expect(view.nodes('ElButton').some(node => text(node) === '打开')).toBe(true)
    expect(view.nodes('ElButton').some(node => ['启用', '禁用'].includes(text(node)))).toBe(false)
    expect(view.nodes('ElDropdownItem').map(text)).toEqual(['导出'])
  })

  it('retires pending synchronization when unmounted', async () => {
    const view = await mount()
    view.props.selectedNames = new Set(['alpha'])
    view.app.unmount(); apps.splice(apps.indexOf(view.app), 1); await flush()
    expect(view.events).toEqual([])
  })
})
