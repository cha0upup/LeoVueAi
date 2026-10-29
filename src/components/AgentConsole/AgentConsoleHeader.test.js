import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { compileClientComponent } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

const Header = compileClientComponent(new URL('./AgentConsoleHeader.vue', import.meta.url), {})
const nodes = (node) => [node, ...node.children.flatMap(nodes)]
const textContent = (node) => node.type === 'comment'
  ? ''
  : node.text + node.children.map(textContent).join('')

describe('AgentConsoleHeader connection path semantics', () => {
  const apps = []
  afterEach(() => apps.splice(0).forEach((app) => app.unmount()))

  function mount(overrides = {}) {
    const props = reactive({
      connLink: 'https://target.test/agent',
      displayConnLinkChain: [],
      connectionPathStatus: 'ready',
      iconMap: icons,
      ...overrides
    })
    const renderer = createTestRenderer()
    const app = renderer.createApp({ render: () => h(Header, props) })
    for (const name of ['ElTooltip', 'ElIcon', 'Icon']) {
      app.component(name, defineComponent({
        inheritAttrs: false,
        setup(_props, { attrs, slots }) {
          return () => h(name, attrs, slots.default?.())
        }
      }))
    }
    app.mount(renderer.root)
    apps.push(app)
    return {
      props,
      text: () => textContent(renderer.root),
      find: (predicate) => nodes(renderer.root).filter(predicate)
    }
  }

  it('describes a single target as direct, without counting the control server', () => {
    const view = mount({ displayConnLinkChain: ['https://target.test/agent'] })
    expect(view.text()).toContain('直连https://target.test/agent')
    expect(view.text()).not.toMatch(/节点|未连接|云端服务器|连接路径|控制服务端/)
    expect(view.find((node) => node.props.class === 'connection-mode-tag')[0].type).toBe('span')
    expect(view.find((node) => node.props['aria-label'] === '控制服务端')).toHaveLength(1)
    expect(view.find((node) => node.props['aria-label'] === '当前主机 · https://target.test/agent'))
      .toHaveLength(1)
  })

  it.each([1, 2, 4])('counts only the %i intermediate hosts as relays', (relayCount) => {
    const path = [...Array.from({ length: relayCount }, (_, index) => `relay-${index + 1}`), 'target']
    const view = mount({ displayConnLinkChain: path })
    expect(view.text()).toContain(`经 ${relayCount} 个中转`)
    expect(view.find((node) => node.props.class?.includes('chain-item--relay'))).toHaveLength(relayCount)
    expect(view.find((node) => node.props.class?.includes('chain-item--target'))).toHaveLength(1)
    const tooltips = view.find((node) => node.type === 'ElTooltip').map((node) => node.props.content)
    expect(tooltips).toContain('中转主机 1 · relay-1')
    expect(tooltips).toContain('当前主机 · target')
  })

  it.each([
    ['loading', '读取中…', '读取连接路径…'],
    ['unavailable', '路径未知', '连接路径暂未获取'],
    ['ready', '路径未知', '连接路径暂未获取']
  ])('does not infer a direct connection from an address alone (%s)', (status, label, message) => {
    const view = mount({ connectionPathStatus: status })
    expect(view.text()).toContain(label)
    expect(view.text()).toContain('https://target.test/agent')
    expect(view.text()).not.toMatch(/直连|未连接|控制服务端/)
    expect(view.find((node) => node.props.class === 'chain-arrow')).toHaveLength(0)
    expect(view.find((node) => node.props.role === 'status')[0].props['aria-label']).toBe(message)
  })

  it('hides stale routes during loading and keeps cache mode independent of path mode', async () => {
    const view = mount({
      displayConnLinkChain: ['old-relay', 'old-target'],
      connectionPathStatus: 'loading',
      cacheMode: true
    })
    expect(view.text()).not.toContain('old-relay')
    expect(view.text()).toContain('读取中…')
    expect(view.text()).toContain('缓存只读')
    view.props.displayConnLinkChain = ['target']
    view.props.connectionPathStatus = 'ready'
    await nextTick()
    expect(view.text()).toContain('直连')
    expect(view.text()).toContain('缓存只读')
    expect(view.text()).not.toMatch(/已连接|已断开/)
  })

  it('shows the unknown-path state even when no target address exists', () => {
    const view = mount({ connLink: '', connectionPathStatus: 'unavailable' })
    expect(view.text()).toContain('路径未知')
    expect(view.text()).not.toMatch(/直连|未连接/)
  })

  it('provides full desktop identifiers and compact narrow-screen identifiers', () => {
    const id = '7dbc6b3d-6af9-47aa-b680-929f6c9ec417'
    const view = mount({ currentHostId: id, agentName: '1.jsp' })
    expect(view.text()).not.toContain('1.jsp')
    expect(view.text()).toContain('7dbc6b3d…c417')
    const fullId = view.find((node) => node.props.class === 'hostid-summary-id-full')[0]
    const compactId = view.find((node) => node.props.class === 'hostid-summary-id-compact')[0]
    expect(textContent(fullId)).toBe(id)
    expect(textContent(compactId)).toBe('7dbc6b3d…c417')
    const tooltip = `1.jsp · 主机标识 · ${id}`
    const identifier = view.find((node) => node.props['aria-label'] === tooltip)[0]
    expect(identifier.props.tabindex).toBe('0')
    expect(view.find((node) => node.type === 'ElTooltip').map((node) => node.props.content))
      .toContain(tooltip)
  })

  it('preserves short identifiers without adding a redundant host-name label', () => {
    const view = mount({ currentHostId: 'host-123', agentName: '' })
    expect(view.find((node) => node.props.class === 'hostid-summary-name')).toHaveLength(0)
    expect(view.text()).toContain('host-123')
    expect(view.text()).not.toContain('host-123…')
  })

  it('removes decorative icon blocks from the compact information bar', () => {
    const view = mount({ agentName: 'target', currentHostId: 'host-123' })
    expect(view.find((node) => ['connection-path-mark', 'hostid-summary-icon'].includes(node.props.class)))
      .toHaveLength(0)
    expect(view.find((node) => node.props.class?.includes('hostid-summary-card'))).toHaveLength(1)
  })

  it('keeps the identifier last, after task actions, and preserves task-manager events', () => {
    const openTaskManager = vi.fn()
    const view = mount({
      currentHostId: 'host-123',
      taskSummary: { running: 1, failed: 2, completed: 3 },
      onOpenTaskManager: openTaskManager
    })
    const header = view.find((node) => node.props.class === 'content-header')[0]
    expect(header.children.at(-1).props.class).toContain('hostid-summary-card')
    const actions = view.find((node) => node.type === 'button')
    expect(actions).toHaveLength(3)
    actions.forEach((button) => button.props.onClick())
    expect(openTaskManager).toHaveBeenCalledTimes(3)
  })

  it('uses a minimal missing-ID placeholder with a descriptive tooltip', () => {
    const view = mount({ currentHostId: '' })
    expect(view.find((node) => node.props.class === 'hostid-summary-empty').map(textContent))
      .toEqual(['—'])
    expect(view.find((node) => node.props['aria-label'] === '主机标识暂未获取'))
      .toHaveLength(1)
  })
})
