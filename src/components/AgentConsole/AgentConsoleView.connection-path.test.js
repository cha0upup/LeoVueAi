import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileClientComponent } from '@/test-support/compileClientComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'

const mocks = {
  chain: vi.fn(), host: vi.fn(), capabilities: vi.fn(), showError: vi.fn()
}
const nullView = { render: () => null }
const slotView = Vue.defineComponent({
  inheritAttrs: false,
  setup(_props, { slots }) { return () => slots.default?.() }
})
const headerView = Vue.defineComponent({
  inheritAttrs: false,
  props: ['connLink', 'displayConnLinkChain', 'connectionPathStatus', 'currentHostId'],
  setup(props) { return () => Vue.h('AgentConsoleHeader', { ...props }) }
})
const View = compileClientComponent(new URL('./AgentConsoleView.vue', import.meta.url), {
  vue: { ...Vue, Transition: slotView, Suspense: slotView, vShow: {} },
  '@/utils/icons.js': { icons: {} },
  '@/services/api/sessions.js': { getConnLinkChainApi: mocks.chain, getCurrentHostIdApi: mocks.host },
  '@/services/api/agent-node.js': { getAgentNodeCapabilitiesApi: mocks.capabilities },
  '@/composables/useAgentConsoleModules.js': {
    supportsCapabilityRequirements: () => true,
    useAgentConsoleModules: () => ({
      moduleDefinitions: [{ key: 'info', component: nullView }], moduleMap: {}
    })
  },
  '@/composables/useToolTabs.js': {
    useToolTabs: () => ({
      tabs: Vue.ref([]), activeKey: Vue.ref('info'), openTab: vi.fn(), ensureTab: vi.fn(),
      closeTab: vi.fn(), setActive: vi.fn(), isOpen: vi.fn(), resetTabs: vi.fn(), loadForSession: vi.fn()
    })
  },
  '@/components/AgentConsole/AgentConsoleHeader.vue': { default: headerView },
  '@/components/Workspace/TabBar.vue': { default: nullView },
  '@/components/Workspace/CommandPalette.vue': { default: nullView },
  '@/components/Workspace/AiDock.vue': { default: nullView },
  '@/utils/messageUtils.js': { showError: mocks.showError },
  '@/components/AgentConsole/File/TaskEngine.js': {
    taskEngine: { on: vi.fn(), off: vi.fn(), getTasksBySession: () => [] }
  },
  '@/constants/task.js': { ACTIVE_TASK_STATUSES: [], TaskStatus: {} },
  '@/constants/app.js': { AGENT_CONSOLE_SETTINGS_STORAGE_KEY: 'test-settings' },
  '@/utils/browserStorage.js': {
    safeLocalStorage: { getJSON: () => ({}), getItem: () => '0', setItem: vi.fn() }
  }
})

const findHeader = (node) => {
  if (node.type === 'AgentConsoleHeader') return node
  for (const child of node.children) {
    const found = findHeader(child)
    if (found) return found
  }
}

describe('AgentConsoleView connection path loading', () => {
  const apps = []
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    mocks.capabilities.mockResolvedValue({ data: { capabilities: [] } })
    mocks.host.mockResolvedValue({ data: { currentHostId: 'host-id' } })
  })
  afterEach(() => {
    apps.splice(0).forEach((app) => app.unmount())
    vi.unstubAllGlobals()
  })

  function mount() {
    const props = Vue.reactive({ sessionId: 'one', connLink: 'target' })
    const renderer = createTestRenderer()
    const app = renderer.createApp({ render: () => Vue.h(View, props) })
    for (const name of ['ElIcon', 'ElResult', 'ElSkeleton', 'ElButton', 'Icon']) {
      app.component(name, slotView)
    }
    app.mount(renderer.root)
    apps.push(app)
    return { props, header: () => findHeader(renderer.root).props }
  }

  it('shows loading before initialization completes, then displays the server-to-target order', async () => {
    const request = deferred()
    mocks.chain.mockReturnValueOnce(request.promise)
    const view = mount()
    expect(view.header().connectionPathStatus).toBe('loading')
    await vi.waitFor(() => expect(mocks.chain).toHaveBeenCalledOnce())
    request.resolve({ data: { connLinkChain: [' target ', 'relay-two', 'relay-one'] } })
    await vi.waitFor(() => expect(view.header().connectionPathStatus).toBe('ready'))
    expect(view.header().displayConnLinkChain).toEqual(['relay-one', 'relay-two', 'target'])
  })

  it.each([undefined, null, {}, [], [' ', null, 42, {}]].map((raw) => ({ raw })))(
    'treats an empty or malformed path as unknown, not direct ($raw)', async ({ raw }) => {
      mocks.chain.mockResolvedValue({ data: { connLinkChain: raw } })
      const view = mount()
      await vi.waitFor(() => expect(view.header().connectionPathStatus).toBe('unavailable'))
      expect(view.header().displayConnLinkChain).toEqual([])
      expect(view.header().connLink).toBe('target')
      expect(mocks.showError).not.toHaveBeenCalled()
    }
  )

  it('normalizes object records without applying trim to non-string fields', async () => {
    mocks.chain.mockResolvedValue({ data: { connLinkChain: [
      { connLink: ' target ' },
      { connLink: 42, agentName: ' relay-two ' },
      { agentId: ' relay-one ' }
    ] } })
    const view = mount()
    await vi.waitFor(() => expect(view.header().connectionPathStatus).toBe('ready'))
    expect(view.header().displayConnLinkChain).toEqual(['relay-one', 'relay-two', 'target'])
  })

  it('keeps the console usable when the path request fails', async () => {
    mocks.chain.mockRejectedValue(new Error('offline'))
    const view = mount()
    await vi.waitFor(() => expect(view.header().connectionPathStatus).toBe('unavailable'))
    await vi.waitFor(() => expect(view.header().currentHostId).toBe('host-id'))
    expect(view.header().displayConnLinkChain).toEqual([])
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'])('ignores a stale path response after switching sessions (%s)', async (settle) => {
    const first = deferred()
    const second = deferred()
    mocks.chain.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = mount()
    await vi.waitFor(() => expect(mocks.chain).toHaveBeenCalledTimes(1))
    view.props.sessionId = 'two'
    await Vue.nextTick()
    expect(view.header().connectionPathStatus).toBe('loading')
    expect(view.header().displayConnLinkChain).toEqual([])
    await vi.waitFor(() => expect(mocks.chain).toHaveBeenCalledTimes(2))
    second.resolve({ data: { connLinkChain: ['new-target'] } })
    await vi.waitFor(() => expect(view.header().connectionPathStatus).toBe('ready'))
    first[settle](settle === 'resolve'
      ? { data: { connLinkChain: ['old-target', 'old-relay'] } }
      : new Error('old request failed'))
    await Vue.nextTick()
    await Vue.nextTick()
    expect(view.header().displayConnLinkChain).toEqual(['new-target'])
    expect(view.header().connectionPathStatus).toBe('ready')
  })
})
