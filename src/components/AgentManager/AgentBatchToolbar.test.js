 
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { compileClientComponent } from '@/test-support/compileClientComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

const Toolbar = compileClientComponent(new URL('./AgentBatchToolbar.vue', import.meta.url), {
  '@iconify/vue': { Icon: { render: () => null } }, '@/utils/icons.js': { icons }
})

const findNodes = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...node.children.flatMap(child => findNodes(child, predicate))
]
const nodeText = node => [node.text, ...node.children.map(nodeText)].join('').trim()

describe('AgentBatchToolbar', () => {
  const apps = []
  const mount = (props = {}) => {
    const renderer = createTestRenderer()
    const events = Object.fromEntries(['toggle-all', 'clear', 'test', 'export', 'assign', 'detach', 'delete']
      .map(name => [name, vi.fn()]))
    const listeners = Object.fromEntries(Object.entries(events).map(([name, handler]) =>
      [`on${name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('')}`, handler]))
    const app = renderer.createApp(Toolbar, { ...props, ...listeners })
    app.component('ElCheckbox', defineComponent({
      setup(_props, { attrs, slots }) { return () => h('checkbox', attrs, slots.default?.()) }
    }))
    app.mount(renderer.root)
    apps.push(app)
    return {
      events,
      buttons: findNodes(renderer.root, node => node.type === 'button'),
      checkbox: findNodes(renderer.root, node => node.type === 'checkbox')[0],
      text: () => findNodes(renderer.root, node => Boolean(node.text)).map(node => node.text).join(' ')
    }
  }
  afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

  it('has no empty disabled action bar before hosts are checked', () => {
    const toolbar = mount({ visibleCount: 2 })
    expect(toolbar.buttons).toHaveLength(0)
    expect(toolbar.text()).toContain('勾选即可批量操作')
    toolbar.checkbox.props.onChange(true)
    expect(toolbar.events['toggle-all']).toHaveBeenCalledOnce()
  })

  it('exposes all common actions directly without a dropdown', () => {
    const toolbar = mount({ selectedCount: 2, visibleCount: 2, canAssign: true, canDetach: true })
    const labels = toolbar.buttons.map(nodeText)
    expect(labels).toEqual(['清空', '测试连接', '导出配置', '加入项目', '移出项目', '删除资产'])
    for (const button of toolbar.buttons) {
      expect(button.props.disabled).toBe(false)
      button.props.onClick()
    }
    for (const name of ['clear', 'test', 'export', 'assign', 'detach', 'delete']) {
      expect(toolbar.events[name]).toHaveBeenCalledOnce()
    }
  })

  it('locks actions and selection while displaying live progress', () => {
    const toolbar = mount({
      selectedCount: 5, visibleCount: 5, busy: true, action: 'test',
      progress: { total: 5, completed: 3, succeeded: 2, failed: 1 }
    })
    expect(toolbar.buttons.every(button => button.props.disabled)).toBe(true)
    expect(toolbar.checkbox.props.disabled).toBe(true)
    expect(toolbar.text()).toContain('正在测试 3/5')
    expect(toolbar.text()).toContain('成功 2 · 失败 1')
  })

  it('makes hidden targets explicit and omits detach for a read-only workspace', () => {
    const toolbar = mount({ selectedCount: 3, visibleCount: 1, hiddenCount: 2 })
    expect(toolbar.text()).toContain('含 2 台未显示主机')
    expect(toolbar.buttons.map(nodeText)).not.toContain('移出项目')
    expect(toolbar.buttons.find(button => nodeText(button) === '加入项目').props.disabled).toBe(true)
  })
})
