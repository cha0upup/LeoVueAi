import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref } from 'vue'
import {
  compileClientComponent,
  createSlotStub as stub,
  findNodes
} from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

const apps = []
afterEach(() => apps.splice(0).forEach((app) => app.unmount()))
const text = (node) => (node.type === 'comment' ? '' : node.text + node.children.map(text).join(''))
async function mount(native = false) {
  const profiles = ref([
    {
      profileId: 'profile',
      name: 'Build',
      host: 'build.internal',
      username: 'ops',
      port: 22,
      authType: 'password'
    }
  ])
  const sessions = ref([]),
    activeSessionId = ref('')
  const terminal = {
    sessions,
    activeSessionId,
    activeSession: computed(() => sessions.value.find((s) => s.id === activeSessionId.value)),
    createSession: vi.fn(),
    removeSession: vi.fn(),
    terminalModeOptions: ref([{ value: 'pipe', label: 'Java 原生管道' }])
  }
  const model = {
    terminal,
    profiles,
    pendingIds: ref(new Set()),
    deletingIds: ref(new Set()),
    loading: ref(false),
    listError: ref(''),
    openProfile: vi.fn(),
    saved: vi.fn(),
    refreshProfiles: vi.fn(),
    retrySession: vi.fn(),
    deleteProfile: vi.fn(),
    existing: (p) => sessions.value.find((s) => !s.ended && s.profileId === p.profileId)
  }
  const Shared = defineComponent({
    props: { workspace: { type: Object, required: true } },
    setup(props, { attrs, slots }) {
      return () =>
        h('SharedView', attrs, [
          slots['toolbar-start']?.(),
          slots.actions?.(),
          props.workspace.activeSession.value
            ? slots['session-overlay']?.({ session: props.workspace.activeSession.value })
            : slots.empty?.()
        ])
    }
  })
  const component = compileClientComponent(
    new URL(native ? './TerminalConsole.vue' : './SshWorkspace.vue', import.meta.url),
    {
      '@iconify/vue': { Icon: stub('Icon') },
      '@/utils/icons.js': { icons },
      './TerminalWorkspaceView.vue': { default: Shared },
      './SshProfileDialog.vue': { default: stub('ProfileDialog') },
      './useSshWorkspace.js': { useSshWorkspace: () => model },
      './useTerminalWorkspace.js': { useTerminalWorkspace: () => terminal },
      '@/services/api/agent-node.js': { execCommandApi: vi.fn() },
      '@/utils/messageUtils.js': { showError: vi.fn() }
    }
  )
  const renderer = createTestRenderer(),
    state = reactive({ sessionId: 'parent' })
  const app = renderer.createApp({ render: () => h(component, state) })
  app.provide('agentCapabilities', ref(['terminal', 'componentInvoke', 'localForward']))
  for (const name of ['ElButton', 'ElInput', 'ElAlert', 'ElDropdownMenu', 'ElDropdownItem'])
    app.component(name, stub(name))
  app.component('ElDropdown', stub('ElDropdown', ['default', 'dropdown']))
  app.mount(renderer.root)
  apps.push(app)
  await nextTick()
  const nodes = (p) => findNodes(renderer.root, p)
  const button = (label) =>
    nodes((n) => n.type === 'ElButton' && n.props['aria-label'] === label)[0]
  return { model, terminal, state, nodes, button, renderer, profiles }
}
describe('separate host and SSH entry points', () => {
  it('opens native terminals directly, without SSH configuration or a connection-type menu', async () => {
    const view = await mount(true)
    view.button('新建主机终端').props.onClick()
    expect(view.terminal.createSession).toHaveBeenCalledExactlyOnceWith()
    expect(view.nodes((n) => n.type === 'ProfileDialog')).toHaveLength(0)
    expect(view.nodes((n) => text(n).includes('SSH') && n.type === 'ElDropdownItem')).toHaveLength(
      0
    )
  })
  it('connects a saved row in one click, without opening the editor', async () => {
    const view = await mount()
    const row = view.nodes((n) => n.type === 'button' && n.props.class === 'connection-open')[0]
    row.props.onClick()
    await nextTick()
    expect(view.model.openProfile).toHaveBeenCalledExactlyOnceWith(
      view.profiles.value[0],
      undefined
    )
    expect(view.nodes((n) => n.type === 'ProfileDialog')[0].props.modelValue).toBe(false)
  })
  it('keeps edit, delete and explicit new-session actions independent', async () => {
    const view = await mount(),
      menu = view.nodes((n) => n.type === 'ElDropdown')[0]
    menu.props.onCommand('edit')
    await nextTick()
    expect(view.nodes((n) => n.type === 'ProfileDialog')[0].props).toMatchObject({
      modelValue: true,
      'profile-id': 'profile'
    })
    expect(view.model.openProfile).not.toHaveBeenCalled()
    menu.props.onCommand('delete')
    expect(view.model.deleteProfile).toHaveBeenCalledExactlyOnceWith(view.profiles.value[0])
    menu.props.onCommand('new')
    expect(view.model.openProfile).toHaveBeenCalledExactlyOnceWith(view.profiles.value[0], {
      forceNew: true
    })
    view.state.sessionId = 'other'
    await nextTick()
    expect(view.nodes((n) => n.type === 'ProfileDialog')[0].props.modelValue).toBe(false)
  })
  it('filters locally and collapses the saved list without resetting terminals', async () => {
    const view = await mount(),
      sessions = view.terminal.sessions.value
    view.nodes((n) => n.type === 'ElInput')[0].props['onUpdate:modelValue']('absent')
    await nextTick()
    expect(
      view.nodes((n) => n.type === 'button' && n.props.class === 'connection-open')
    ).toHaveLength(0)
    view.button('切换 SSH 连接列表').props.onClick()
    await nextTick()
    expect(view.nodes((n) => n.type === 'aside')).toHaveLength(0)
    expect(view.terminal.sessions.value).toBe(sessions)
    expect(view.model.refreshProfiles).not.toHaveBeenCalled()
  })
  it('offers cancellation during connection and inline retry after failure', async () => {
    const view = await mount()
    view.terminal.sessions.value = [
      {
        id: 'pending',
        profileId: 'profile',
        endpoint: 'ops@build.internal:22',
        ended: false,
        viewportReady: false
      }
    ]
    view.terminal.activeSessionId.value = 'pending'
    await nextTick()
    view.nodes((n) => n.type === 'ElButton' && text(n).trim() === '取消连接')[0].props.onClick()
    expect(view.terminal.removeSession).toHaveBeenCalledExactlyOnceWith('pending')
    view.terminal.activeSession.value.ended = true
    view.terminal.activeSession.value.endReason = '认证失败'
    await nextTick()
    expect(view.nodes((n) => n.type === 'div' && n.props.role === 'alert').map(text)[0]).toContain(
      '认证失败'
    )
    view.nodes((n) => n.type === 'ElButton' && text(n).trim() === '重连')[0].props.onClick()
    expect(view.model.retrySession).toHaveBeenCalledExactlyOnceWith(
      view.terminal.activeSession.value
    )
  })
})
