import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref } from 'vue'
import {
  compileClientComponent,
  createSlotStub as stub,
  findNodes
} from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'
import {
  createTerminalSession,
  describeTerminalCapability,
  formatTerminalRelativeTime
} from './terminalWorkspaceModel.js'

const Rail = compileClientComponent(new URL('./TerminalSessionRail.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') },
  '@/utils/icons.js': { icons },
  './terminalWorkspaceModel.js': { formatTerminalRelativeTime }
})
const apps = []
afterEach(() => apps.splice(0).forEach((app) => app.unmount()))
const text = (node) => (node.type === 'comment' ? '' : node.text + node.children.map(text).join(''))

async function mount() {
  const sessions = ref([
    {
      ...createTerminalSession({ id: 'native', title: '终端 1', hostSessionId: 'parent' }),
      pty: false,
      hasUnread: true
    },
    {
      ...createTerminalSession({
        id: 'ssh',
        title: '构建环境',
        hostSessionId: 'parent',
        connectionType: 'ssh',
        endpoint: 'ops@build.internal:22'
      }),
      pty: true,
      resizable: true,
      longPolling: true,
      backend: 'ssh',
      cols: 120,
      rows: 32
    }
  ])
  const activeSessionId = ref('ssh')
  const workspace = {
    sessions,
    activeSessionId,
    activeSession: computed(() => sessions.value.find((s) => s.id === activeSessionId.value)),
    activeSessionTimeLabel: ref('刚刚'),
    clockNow: ref(Date.now()),
    searchKeyword: ref(''),
    setViewportRef: vi.fn(),
    activateSession: vi.fn((id) => {
      activeSessionId.value = id
    }),
    removeSession: vi.fn(),
    closeActiveSession: vi.fn(),
    clearActiveViewport: vi.fn(),
    interruptActiveSession: vi.fn(),
    resetWorkspace: vi.fn(),
    markSessionActive: vi.fn(),
    handleViewportReady: vi.fn(),
    handleTerminalInput: vi.fn(),
    handleTerminalResize: vi.fn(),
    handleSearchKeywordChange: vi.fn((value) => {
      workspace.searchKeyword.value = value
    }),
    searchInActiveSession: vi.fn(),
    focusActiveViewport: vi.fn()
  }
  const Console = compileClientComponent(new URL('./TerminalWorkspaceView.vue', import.meta.url), {
    '@iconify/vue': { Icon: stub('Icon') },
    '@/utils/icons.js': { icons },
    '@/utils/confirmUtils.js': { confirmAction: vi.fn().mockResolvedValue(true) },
    '@/utils/messageUtils.js': { showSuccess: vi.fn() },
    './TerminalSessionRail.vue': { default: Rail },
    './TerminalViewport.vue': { default: stub('Viewport') },
    './terminalWorkspaceModel.js': { describeTerminalCapability }
  })
  const renderer = createTestRenderer(),
    state = reactive({ sessionId: 'parent' })
  const app = renderer.createApp({ render: () => h(Console, { ...state, workspace }) })
  for (const name of ['ElButton', 'ElDropdownMenu', 'ElDropdownItem'])
    app.component(name, stub(name))
  app.component('ElDropdown', stub('ElDropdown', ['default', 'dropdown']))
  app.component('ElPopover', stub('ElPopover', ['reference', 'default']))
  const focus = vi.fn(),
    select = vi.fn()
  app.component(
    'ElInput',
    defineComponent({
      inheritAttrs: false,
      setup(_props, { attrs, expose }) {
        expose({ focus, select })
        return () => h('Input', attrs)
      }
    })
  )
  app.mount(renderer.root)
  apps.push(app)
  await nextTick()
  const nodes = (predicate) => findNodes(renderer.root, predicate)
  const button = (label) =>
    nodes((n) => n.type === 'ElButton' && n.props['aria-label'] === label)[0]
  const css = (name) =>
    nodes((n) => typeof n.props.class === 'string' && n.props.class.split(' ').includes(name))
  return { renderer, workspace, state, nodes, button, css, focus }
}

describe('terminal workbench presentation', () => {
  it('shows protocol-tagged session tabs and a concise endpoint and status strip', async () => {
    const view = await mount()
    expect(view.css('terminal-rail')[0].props.class).toContain('is-compact')
    const selected = view.nodes((n) => n.type === 'button' && n.props['aria-current'] === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0].props.title).toBe('SSH · ops@build.internal:22')
    expect(view.css('session-kind').map(text)).toEqual(['Agent', 'SSH'])
    expect(view.css('active-session-endpoint').map(text)).toEqual(['ops@build.internal:22'])
    expect(view.css('terminal-dimensions').map(text)).toEqual(['120 × 32'])
    expect(view.css('mode-summary').map(text)).toEqual(['PTY'])
    expect(view.css('unread-dot')).toHaveLength(1)
    expect(view.nodes((n) => n.type === 'Viewport')).toHaveLength(2)
  })

  it('switches the rail layout without recreating or stopping terminal sessions', async () => {
    const view = await mount(),
      original = view.workspace.sessions.value
    view.button('展开会话列表').props.onClick()
    await nextTick()
    expect(view.css('terminal-rail')[0].props.class).not.toContain('is-compact')
    view.button('收起会话列表').props.onClick()
    await nextTick()
    expect(view.css('terminal-rail')[0].props.class).toContain('is-compact')
    expect(view.workspace.sessions.value).toBe(original)
    expect(view.workspace.resetWorkspace).not.toHaveBeenCalled()
    expect(view.workspace.closeActiveSession).not.toHaveBeenCalled()
  })

  it('keeps selecting and closing a session as independent controls', async () => {
    const view = await mount()
    view.button('关闭构建环境').props.onClick()
    expect(view.workspace.removeSession).toHaveBeenCalledExactlyOnceWith('ssh')
    expect(view.workspace.activateSession).not.toHaveBeenCalled()
    view.nodes((n) => n.type === 'button' && n.props.title === 'Agent · 终端 1')[0].props.onClick()
    await nextTick()
    expect(view.workspace.activateSession).toHaveBeenCalledExactlyOnceWith('native')
    expect(view.css('status-protocol').map(text)).toEqual(['Agent'])
  })

  it('preserves search shortcuts, clear and interrupt actions', async () => {
    const view = await mount()
    const event = {
      ctrlKey: true,
      altKey: false,
      key: 'f',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    }
    view.css('terminal-console')[0].props.onKeydownCapture(event)
    await nextTick()
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(view.css('terminal-search')).toHaveLength(1)
    expect(view.focus).toHaveBeenCalledOnce()
    view.button('关闭查找').props.onClick()
    await nextTick()
    expect(view.css('terminal-search')).toHaveLength(0)
    view.button('清屏').props.onClick()
    expect(view.workspace.clearActiveViewport).toHaveBeenCalledOnce()
    view.nodes((n) => n.type === 'ElButton' && text(n).trim() === '中断')[0].props.onClick()
    expect(view.workspace.interruptActiveSession).toHaveBeenCalledOnce()
  })

  it('renders an empty workspace without a session rail', async () => {
    const view = await mount()
    view.workspace.sessions.value = []
    view.workspace.activeSessionId.value = ''
    await nextTick()
    expect(view.css('terminal-empty')).toHaveLength(1)
    expect(view.css('terminal-rail')).toHaveLength(0)
  })

  it('distinguishes ended sessions and disables their interrupt button', async () => {
    const view = await mount()
    view.workspace.activeSession.value.ended = true
    await nextTick()
    expect(view.css('session-status')[0].props.class).toContain('is-warning')
    expect(view.css('ended-label').map(text)).toEqual(['已结束'])
    expect(
      view.nodes((n) => n.type === 'ElButton' && text(n).trim() === '中断')[0].props.disabled
    ).toBe(true)
  })
})
