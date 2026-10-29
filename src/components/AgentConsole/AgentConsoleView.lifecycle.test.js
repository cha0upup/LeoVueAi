import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileClientComponent } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useToolTabs } from '@/composables/useToolTabs.js'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/app.js'
import { ACTIVE_TASK_STATUSES, TaskStatus } from '@/constants/task.js'

const mounted = vi.fn()
const unmounted = vi.fn()
const tick = vi.fn()
let instanceId = 0
let taskListeners = new Map()
let backgroundTasks = []
const taskEngine = {
  on(event, listener) {
    if (!taskListeners.has(event)) taskListeners.set(event, new Set())
    taskListeners.get(event).add(listener)
  },
  off: (event, listener) => taskListeners.get(event)?.delete(listener),
  getTasksBySession: sessionId => backgroundTasks.filter(task => task.sessionId === sessionId),
  cancelTask: vi.fn(),
  detach: vi.fn()
}
const slotView = Vue.defineComponent({
  inheritAttrs: false,
  setup(_props, { slots }) { return () => slots.default?.() }
})
const nullView = { render: () => null }
const tabView = Vue.defineComponent({
  inheritAttrs: false,
  props: ['tabs'],
  emits: ['activate', 'close'],
  setup(props, { emit }) {
    return () => Vue.h('fixture-tabs', {
      keys: props.tabs.map(tab => tab.key),
      onClose: key => emit('close', key),
      onActivate: key => emit('activate', key)
    })
  }
})
const paletteView = Vue.defineComponent({
  inheritAttrs: false,
  props: ['visible'],
  emits: ['open'],
  setup(props, { emit }) {
    return () => Vue.h('fixture-palette', { visible: props.visible, onOpen: key => emit('open', key) })
  }
})
const definitions = ['info', 'file', 'terminal', 'scan', 'database', 'plugin', 'resource', 'settings', 'task-manager']
  .map(key => ({
    key,
    component: Vue.defineComponent({
      inheritAttrs: false,
      setup() {
        const id = ++instanceId
        const timer = setInterval(() => tick(key, id), 5000)
        Vue.onMounted(() => mounted(key, id))
        Vue.onUnmounted(() => { clearInterval(timer); unmounted(key, id) })
        return () => Vue.h('fixture-tool', { moduleKey: key, instanceId: id })
      }
    })
  }))

const Console = compileClientComponent(new URL('./AgentConsoleView.vue', import.meta.url), {
  vue: { ...Vue, Transition: slotView, Suspense: slotView, vShow: {} },
  '@/utils/icons.js': { icons: {} },
  '@/services/api/sessions.js': {
    getConnLinkChainApi: async () => ({ data: { connLinkChain: [] } }),
    getCurrentHostIdApi: async () => ({ data: { currentHostId: 'fixture-host' } })
  },
  '@/services/api/agent-node.js': { getAgentNodeCapabilitiesApi: async () => ({ data: { capabilities: [] } }) },
  '@/composables/useAgentConsoleModules.js': {
    supportsCapabilityRequirements: () => true,
    useAgentConsoleModules: () => ({ moduleDefinitions: definitions, moduleMap: Object.fromEntries(definitions.map(d => [d.key, d])) })
  },
  '@/composables/useToolTabs.js': { useToolTabs },
  '@/components/AgentConsole/AgentConsoleHeader.vue': { default: nullView },
  '@/components/Workspace/TabBar.vue': { default: tabView },
  '@/components/Workspace/CommandPalette.vue': { default: paletteView },
  '@/components/Workspace/AiDock.vue': { default: nullView },
  '@/utils/messageUtils.js': { showError: vi.fn() },
  '@/components/AgentConsole/File/TaskEngine.js': { taskEngine },
  '@/constants/task.js': { ACTIVE_TASK_STATUSES, TaskStatus },
  '@/constants/app.js': { AGENT_CONSOLE_SETTINGS_STORAGE_KEY: 'fixture-settings' },
  '@/utils/browserStorage.js': {
    safeLocalStorage: { getJSON: () => ({}), getItem: () => '0', setItem: vi.fn() }
  }
}, 'console-lifecycle')

function findAll(node, type) {
  return [...(node.type === type ? [node] : []), ...node.children.flatMap(child => findAll(child, type))]
}

describe('console workspace lifecycle', () => {
  const apps = []
  let windowListeners

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    instanceId = 0
    taskListeners = new Map()
    backgroundTasks = [{ id: 'background-task', sessionId: 'one', status: TaskStatus.RUNNING }]
    windowListeners = new Map()
    const storage = new Map()
    vi.stubGlobal('window', {
      addEventListener(type, listener) {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set())
        windowListeners.get(type).add(listener)
      },
      removeEventListener: (type, listener) => windowListeners.get(type)?.delete(listener),
      sessionStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
      }
    })
  })

  afterEach(() => {
    apps.splice(0).forEach(app => app.unmount())
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function mount(component) {
    const renderer = createTestRenderer()
    const app = renderer.createApp(component)
    for (const name of ['ElContainer', 'ElMain', 'ElIcon', 'ElResult', 'ElSkeleton', 'ElButton', 'Icon']) {
      app.component(name, slotView)
    }
    app.mount(renderer.root)
    apps.push(app)
    return { root: renderer.root, app }
  }

  function shortcut(key = 'k') {
    const event = {
      key, metaKey: true, ctrlKey: false, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true },
      stopPropagation: vi.fn()
    }
    for (const listener of [...(windowListeners.get('keydown') || [])]) listener(event)
    return event
  }

  function mainWorkspace() {
    const route = Vue.reactive({ name: ROUTE_NAMES.mainAgent, params: { tabKey: 'one' }, fullPath: '/main/agent/one' })
    const tabs = Vue.ref(['one', 'two'].map(key => ({ id: key, tabKey: key, sessionId: key, isLoaded: true })))
    const currentTab = Vue.ref('one')
    const asyncViews = [nullView, Console]
    const Main = compileClientComponent(new URL('../../views/MainView.vue', import.meta.url), {
      vue: { ...Vue, vShow: {}, defineAsyncComponent: () => asyncViews.shift() },
      'vue-router': { useRoute: () => route, useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) },
      '@/constants/app.js': { ROUTE_NAMES, ROUTE_PATHS },
      '@/utils/icons.js': { icons: {} },
      '@/utils/confirmUtils.js': { confirmAction: vi.fn() },
      '@/utils/messageUtils.js': { showWarning: vi.fn() },
      '@/composables/useMainTabs.js': {
        useMainTabs: () => ({
          HOME_TAB_ID: 'home', currentTab, tabs, addAgentConsoleTab: vi.fn(), getTabRoute: vi.fn(),
          goToHome: () => { currentTab.value = 'home' },
          switchTabByKey: key => {
            const tab = tabs.value.find(tab => tab.tabKey === key)
            if (tab) currentTab.value = tab.id
            return tab
          }
        })
      }
    }, 'main-lifecycle')
    return { ...mount(Main), route }
  }

  it('routes a window shortcut only to the current console and closes the old palette on switching', async () => {
    const { root, route } = mainWorkspace()
    shortcut()
    await Vue.nextTick()
    expect(findAll(root, 'fixture-palette').map(node => node.props.visible)).toEqual([true, false])
    expect(windowListeners.get('keydown').size).toBe(1)

    route.params.tabKey = 'two'
    await Vue.nextTick()
    expect(findAll(root, 'fixture-palette').map(node => node.props.visible)).toEqual([false, false])
    shortcut()
    await Vue.nextTick()
    expect(findAll(root, 'fixture-palette').map(node => node.props.visible)).toEqual([false, true])
  })

  it.each([ROUTE_NAMES.main, ROUTE_NAMES.admin])('suspends shortcuts when navigating to %s', async name => {
    const { root, route } = mainWorkspace()
    shortcut()
    await Vue.nextTick()
    route.name = name
    await Vue.nextTick()
    expect(windowListeners.get('keydown')?.size || 0).toBe(0)
    expect(shortcut().defaultPrevented).toBe(false)
    expect(findAll(root, 'fixture-palette').every(node => !node.props.visible)).toBe(true)
  })

  it('detaches the shortcut during KeepAlive deactivation and restores it once on activation', async () => {
    const visible = Vue.ref(true)
    const Other = { render: () => Vue.h('other-view') }
    const { root } = mount({ render: () => Vue.h(Vue.KeepAlive, null, {
      default: () => visible.value ? Vue.h(Console, { sessionId: 'one', active: true }) : Vue.h(Other)
    }) })
    shortcut()
    await Vue.nextTick()
    visible.value = false
    await Vue.nextTick()
    expect(windowListeners.get('keydown')?.size || 0).toBe(0)
    visible.value = true
    await Vue.nextTick()
    expect(windowListeners.get('keydown').size).toBe(1)
    expect(findAll(root, 'fixture-palette')[0].props.visible).toBe(false)
  })

  it('handles a captured key only once and ignores consumed events', async () => {
    const { root } = mount({ render: () => Vue.h(Console, { sessionId: 'one', active: true }) })
    const event = shortcut('Escape')
    event.key = 'k'
    const consoleRoot = findAll(root, 'div').find(node => node.props.class === 'agent-console-view')
    consoleRoot.props.onKeydownCapture(event)
    for (const listener of windowListeners.get('keydown') || []) listener(event)
    await Vue.nextTick()
    expect(findAll(root, 'fixture-palette')[0].props.visible).toBe(true)
  })

  it('unmounts a closed tool, stops its timer, and keeps the independent background task', async () => {
    const { root } = mount({ render: () => Vue.h(Console, { sessionId: 'one', active: true }) })
    await vi.waitFor(() => expect(findAll(root, 'fixture-tool')).toHaveLength(1))
    findAll(root, 'fixture-palette')[0].props.onOpen('file')
    await Vue.nextTick()
    const file = findAll(root, 'fixture-tool').find(node => node.props.moduleKey === 'file')
    const fileId = file.props.instanceId
    findAll(root, 'fixture-tabs')[0].props.onActivate('info')
    await Vue.nextTick()
    findAll(root, 'fixture-tabs')[0].props.onClose('file')
    await Vue.nextTick()

    expect(findAll(root, 'fixture-tabs')[0].props.keys).not.toContain('file')
    expect(findAll(root, 'fixture-tool').map(node => node.props.moduleKey)).not.toContain('file')
    expect(unmounted).toHaveBeenCalledWith('file', fileId)
    vi.advanceTimersByTime(5000)
    expect(tick).not.toHaveBeenCalledWith('file', fileId)
    expect(backgroundTasks).toEqual([{ id: 'background-task', sessionId: 'one', status: TaskStatus.RUNNING }])
    expect(taskEngine.cancelTask).not.toHaveBeenCalled()
    expect(taskEngine.detach).not.toHaveBeenCalled()

    findAll(root, 'fixture-palette')[0].props.onOpen('file')
    await Vue.nextTick()
    expect(findAll(root, 'fixture-tool').find(node => node.props.moduleKey === 'file').props.instanceId).not.toBe(fileId)
  })

  it('releases LRU-evicted tool components instead of growing beyond the tab budget', async () => {
    const { root } = mount({ render: () => Vue.h(Console, { sessionId: 'one', active: true }) })
    await vi.waitFor(() => expect(findAll(root, 'fixture-tool')).toHaveLength(1))
    for (const { key } of definitions) {
      findAll(root, 'fixture-palette')[0].props.onOpen(key)
      await Vue.nextTick()
      expect(findAll(root, 'fixture-tool').length).toBeLessThanOrEqual(6)
    }
    expect(unmounted).toHaveBeenCalledWith('info', expect.any(Number))
  })

  it('keeps a background notification lazy after its previous task view was closed', async () => {
    const { root } = mount({ render: () => Vue.h(Console, { sessionId: 'one', active: true }) })
    await vi.waitFor(() => expect(findAll(root, 'fixture-tool')).toHaveLength(1))
    const palette = findAll(root, 'fixture-palette')[0]
    palette.props.onOpen('task-manager')
    await Vue.nextTick()
    findAll(root, 'fixture-tabs')[0].props.onActivate('info')
    await Vue.nextTick()
    findAll(root, 'fixture-tabs')[0].props.onClose('task-manager')
    await Vue.nextTick()
    for (const listener of taskListeners.get('taskCreated') || []) listener(backgroundTasks[0])
    await Vue.nextTick()
    expect(findAll(root, 'fixture-tabs')[0].props.keys).toContain('task-manager')
    expect(findAll(root, 'fixture-tool').map(node => node.props.moduleKey)).not.toContain('task-manager')
  })

  it('removes its window listener on unmount', async () => {
    const { app } = mount({ render: () => Vue.h(Console, { sessionId: 'one', active: true }) })
    expect(windowListeners.get('keydown').size).toBe(1)
    apps.splice(apps.indexOf(app), 1)
    app.unmount()
    await Vue.nextTick()
    expect(windowListeners.get('keydown').size).toBe(0)
  })
})
