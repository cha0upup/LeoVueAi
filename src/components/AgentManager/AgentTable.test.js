/* eslint-disable vue/one-component-per-file -- The tree fixture exposes Element Plus events and lazy loading. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent } from '@/test-support/compileClientComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'
import { getHostDisplayName, getHostIcon, isChildHost } from './agentDetailUtils.js'
import { collectVisibleAgents } from './agentTreeSelection.js'

const Table = compileClientComponent(new URL('./AgentTable.vue', import.meta.url), {
  '@/utils/icons.js': { icons },
  '@/components/common/EmptyState.vue': { default: { render: () => null } },
  '@/components/common/StatusIndicator.vue': { default: { render: () => null } },
  './agentDetailUtils.js': { getHostDisplayName, getHostIcon, isChildHost },
  './agentTreeSelection.js': { collectVisibleAgents }
})
const findNodes = (node, predicate) => [
  ...(predicate(node) ? [node] : []), ...node.children.flatMap(child => findNodes(child, predicate))
]

describe('AgentTable directory interactions', () => {
  const apps = []
  const rows = [
    { agentId: 'branch', agentName: 'Parent', hasChildren: true, parentAgentId: 'root' },
    { agentId: 'leaf', agentName: 'Leaf', hasChildren: false, parentAgentId: 'root' }
  ]
  const mount = async (options = {}) => {
    const renderer = createTestRenderer()
    const props = ref({ agents: rows, currentAgentId: 'branch', ...options })
    const selected = vi.fn(), viewed = vi.fn(), entered = vi.fn(), loadChildren = vi.fn()
    const setCheckedKeys = vi.fn(), setCurrentKey = vi.fn()
    const app = renderer.createApp({ render: () => h(Table, {
      ...props.value, loadChildren, onToggleSelection: selected, onRowClick: viewed, onEnterConsole: entered
    }) })
    app.component('ElTree', defineComponent({
      props: { data: Array, props: Object, currentNodeKey: String },
      setup(treeProps, { attrs, slots, expose }) {
        expose({ setCheckedKeys, setCurrentKey, filter: () => {}, getNode: () => null })
        return () => h('tree', { ...attrs, treeProps: treeProps.props, currentNodeKey: treeProps.currentNodeKey },
          treeProps.data.map(data => h('row', slots.default({ data }))))
      }
    }))
    for (const name of ['ElIcon', 'ElTag', 'Icon']) app.component(name, { render: () => null })
    app.directive('loading', {})
    app.mount(renderer.root)
    apps.push(app)
    await nextTick()
    return {
      props, selected, viewed, entered, loadChildren, setCheckedKeys,
      tree: () => findNodes(renderer.root, node => node.type === 'tree')[0].props,
      cards: () => findNodes(renderer.root, node => node.props.class?.includes('node-card')),
      rowContent: () => findNodes(renderer.root, node => node.props.class === 'tree-node'),
      quickEnter: () => findNodes(renderer.root, node => node.props.class === 'quick-enter')
    }
  }
  afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

  it('hides leaf expansion controls while retaining real branches', async () => {
    const view = await mount()
    expect(view.tree().treeProps.isLeaf(rows[0])).toBe(false)
    expect(view.tree().treeProps.isLeaf(rows[1])).toBe(true)
  })

  it('does not issue lazy child requests for a leaf', async () => {
    const view = await mount()
    const resolve = vi.fn()
    view.tree().load({ level: 1, data: rows[1] }, resolve)
    await nextTick()
    expect(resolve).toHaveBeenCalledWith([])
    expect(view.loadChildren).not.toHaveBeenCalled()
  })

  it('still loads and synchronizes selection when expanding a real branch', async () => {
    const view = await mount({ checkedAgentIds: ['child'] })
    const resolve = vi.fn(), node = { level: 1, data: rows[0] }
    view.tree().load(node, resolve)
    const complete = view.loadChildren.mock.calls[0][2]
    complete([{ agentId: 'child', hasChildren: false }])
    await nextTick()
    expect(resolve).toHaveBeenCalledWith([{ agentId: 'child', hasChildren: false }])
    expect(view.setCheckedKeys).toHaveBeenLastCalledWith(['child'])
  })

  it('keeps the viewed host separate from batch checks and removes duplicate row highlighting', async () => {
    const view = await mount({ checkedAgentIds: ['leaf'] })
    view.tree().onCheck(rows[1], { checkedKeys: ['leaf'] })
    expect(view.selected).toHaveBeenCalledWith(rows[1], true)
    expect(view.viewed).not.toHaveBeenCalled()
    expect(view.tree().currentNodeKey).toBe('branch')
    expect(view.cards().every(card => !card.props.class.includes('is-checked'))).toBe(true)
    view.tree().onNodeClick(rows[1])
    expect(view.viewed).toHaveBeenCalledWith(rows[1])
  })

  it('resynchronizes rather than accepting checkbox changes while selection is locked', async () => {
    const view = await mount({ checkedAgentIds: ['branch'], selectionDisabled: true })
    view.tree().onCheck(rows[1], { checkedKeys: ['branch', 'leaf'] })
    expect(view.selected).not.toHaveBeenCalled()
    expect(view.setCheckedKeys).toHaveBeenLastCalledWith(['branch'])
  })

  it('retains double-click and quick-enter events without triggering batch selection', async () => {
    const view = await mount()
    view.rowContent()[0].props.onDblclick({})
    const stopPropagation = vi.fn()
    view.quickEnter()[1].props.onClick({ stopPropagation })
    expect(view.entered.mock.calls).toEqual([[rows[0]], [rows[1]]])
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(view.selected).not.toHaveBeenCalled()
    expect(view.viewed).not.toHaveBeenCalled()
  })
})
