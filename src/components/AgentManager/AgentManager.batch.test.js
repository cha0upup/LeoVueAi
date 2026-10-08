/* eslint-disable vue/one-component-per-file -- Fixture children expose the actual manager's UI events. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, watch } from 'vue'
import { compileClientComponent } from '@/test-support/compileClientComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { icons } from '@/utils/icons.js'
import { useAgentDirectory, buildAgentUpdatePayload, normalizeAgentList } from '@/composables/useAgentDirectory.js'
import { useAgentSelection } from '@/composables/useAgentSelection.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { executeDeleteWithConfirm, executeBatchDelete } from '@/utils/confirmUtils.js'

const mocks = vi.hoisted(() => ({
  agents: vi.fn(), children: vi.fn(), sessions: vi.fn(), cache: vi.fn(), memberships: vi.fn(),
  test: vi.fn(), export: vi.fn(), delete: vi.fn(), detach: vi.fn(),
  confirm: vi.fn(), download: vi.fn(), assign: vi.fn(), warn: vi.fn(),
  showError: vi.fn(), showWarning: vi.fn(), showSuccess: vi.fn()
}))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm } }))
vi.mock('@/utils/messageUtils.js', () => mocks)

const fixture = { project: null, loaded: new Map() }
const nullView = { render: () => null }
const AgentTable = defineComponent({
  inheritAttrs: false,
  props: { agents: Array, checkedAgentIds: Array, testingAgentIds: Array, loadChildren: Function },
  emits: ['visible-agents-change'],
  setup(props, { attrs, emit, expose }) {
    expose({ clearSelection: () => {}, getLoadedAgent: id => fixture.loaded.get(id) })
    watch(() => props.agents, rows => emit('visible-agents-change', rows), { immediate: true, flush: 'post' })
    return () => h('AgentTable', { ...props, ...attrs })
  }
})
const eventView = name => defineComponent({
  inheritAttrs: false,
  props: {
    selectedCount: Number, visibleCount: Number, hiddenCount: Number,
    allSelected: Boolean, indeterminate: Boolean, busy: Boolean,
    canAssign: Boolean, canDetach: Boolean, action: String, progress: Object
  },
  setup(props, { attrs }) { return () => h(name, { ...props, ...attrs }) }
})
const modules = {
  '@iconify/vue': { Icon: nullView },
  '@/utils/icons.js': { icons },
  '@/utils/downloadBlob.js': { downloadBlob: mocks.download },
  '@/utils/apiUtils.js': { executeRequest },
  '@/utils/confirmUtils.js': { executeDeleteWithConfirm, executeBatchDelete },
  '@/utils/messageUtils.js': mocks,
  '@/utils/logger.js': { createLogger: () => ({ warn: mocks.warn }) },
  '@/utils/browserStorage.js': { safeLocalStorage: { getJSON: () => ({}), setJSON: () => true } },
  '@/services/api/agent-manage.js': {
    getAgentsApi: mocks.agents, deleteAgentApi: mocks.delete, exportAgentsApi: mocks.export
  },
  '@/services/api/agent-node.js': { checkAgentCacheApi: mocks.cache, testAgentConnectionApi: mocks.test },
  '@/services/api/sessions.js': { getSessionsApi: mocks.sessions },
  '@/services/api/projects.js': {
    getProjectAgentsApi: mocks.agents, getUnassignedAgentsApi: mocks.agents,
    getWorkspaceAgentChildrenApi: mocks.children,
    getAgentProjectMembershipsApi: mocks.memberships, detachProjectAgentsApi: mocks.detach
  },
  './AgentTable.vue': { default: AgentTable },
  './AgentBatchToolbar.vue': { default: eventView('AgentBatchToolbar') },
  './ProjectSwitcher.vue': { default: eventView('ProjectSwitcher') },
  './AgentDetailPanel.vue': { default: eventView('AgentDetailPanel') },
  './ProjectAssignmentDialog.vue': { default: defineComponent({
    setup(_props, { expose }) { expose({ open: mocks.assign }); return () => null }
  }) },
  './useHostSelection.js': { useHostSelection: () => ({ open: () => Promise.resolve(null) }) },
  './agentSessionEntry.js': { resolveAgentSessionEntry: () => ({ action: 'create' }) },
  './agentRuntimeStatus.js': { resolveAgentRuntimeStatus: () => ({}) },
  '@/composables/useAgentDirectory.js': { useAgentDirectory, buildAgentUpdatePayload, normalizeAgentList },
  '@/composables/useAgentSelection.js': { useAgentSelection },
  '@/composables/useProjectDirectory.js': { useProjectDirectory: () => fixture.project },
  '@/utils/agentTransfer.js': {
    buildAgentTransferBundle: agents => ({ agents }), encodeAgentTransferPayload: () => 'encoded-config'
  },
  '@/components/common/ManagerLayout.vue': { default: defineComponent({
    setup(_props, { slots }) { return () => h('main', [slots.list?.(), slots.detail?.(), slots.default?.()]) }
  }) }
}
for (const name of ['AddChildAgent', 'AddAgent', 'EditAgent', 'ImportAgent', 'ShareAgent',
  'ProjectEditorDialog', 'SessionPickerDialog', 'HostSelectionDialog']) {
  modules[`./${name}.vue`] = { default: nullView }
}
const Manager = compileClientComponent(new URL('./AgentManager.vue', import.meta.url), modules)
const findNode = (node, type) => {
  if (node.type === type) return node
  for (const child of node.children) {
    const found = findNode(child, type)
    if (found) return found
  }
  return null
}

describe('AgentManager batch workflow', () => {
  const apps = []
  const rows = Array.from({ length: 6 }, (_, index) => ({
    agentId: `host-${index}`, agentName: `Host ${index}`, parentAgentId: 'root', connLink: 'https://example.test'
  }))
  const mount = async () => {
    const renderer = createTestRenderer()
    const app = renderer.createApp(Manager)
    for (const name of ['ElDropdown', 'ElDropdownMenu', 'ElDropdownItem', 'ElInput', 'ElSelect', 'ElOption', 'ElTooltip', 'ElIcon']) {
      app.component(name, defineComponent({
        inheritAttrs: false,
        setup(_props, { attrs, slots }) { return () => h(name, attrs, slots.default?.()) }
      }))
    }
    app.mount(renderer.root)
    apps.push(app)
    const node = name => findNode(renderer.root, name)
    await vi.waitFor(() => expect(node('AgentTable').props.agents).toHaveLength(6))
    await nextTick()
    return {
      node,
      toolbar: () => node('AgentBatchToolbar').props,
      table: () => node('AgentTable').props,
      select: async agent => { node('AgentTable').props.onToggleSelection(agent, true); await nextTick() }
    }
  }
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.loaded.clear()
    vi.stubGlobal('window', { setInterval: vi.fn().mockReturnValue(1), clearInterval: vi.fn() })
    fixture.project = {
      projects: ref([{ projectId: 'destination', status: 'active', contentEditable: true }]),
      projectsLoading: ref(false), selectedProjectId: ref('all'), activeProject: ref(null),
      activeProjectId: ref(''), isUnassignedProject: ref(false), isAllProjects: ref(true),
      loadProjects: vi.fn().mockResolvedValue(),
      selectProject: vi.fn(id => { fixture.project.selectedProjectId.value = id; fixture.project.activeProjectId.value = id })
    }
    mocks.agents.mockResolvedValue({ data: rows })
    mocks.sessions.mockResolvedValue({ data: [] })
    mocks.cache.mockResolvedValue({ data: { hasCache: false } })
    mocks.memberships.mockResolvedValue({ data: {} })
    mocks.confirm.mockResolvedValue()
    mocks.delete.mockResolvedValue({})
    mocks.detach.mockResolvedValue({})
  })
  afterEach(() => {
    for (const app of apps.splice(0)) app.unmount()
    vi.unstubAllGlobals()
  })

  it('keeps selection through filtering and toggles only currently visible hosts', async () => {
    const view = await mount()
    view.toolbar().onToggleAll()
    await nextTick()
    expect(view.table().checkedAgentIds).toHaveLength(6)
    view.node('ElInput').props['onUpdate:modelValue']('Host 0')
    await nextTick()
    await nextTick()
    expect(view.toolbar().hiddenCount).toBe(5)
    expect(view.toolbar().selectedCount).toBe(6)
    view.toolbar().onToggleAll()
    await nextTick()
    expect(view.table().checkedAgentIds).not.toContain('host-0')
    expect(view.toolbar().selectedCount).toBe(5)
    view.toolbar().onClear()
    await nextTick()
    expect(view.toolbar().selectedCount).toBe(0)
  })

  it('runs at most four tests concurrently, locks the batch, and retains a stable sorted list', async () => {
    const view = await mount()
    const requests = Object.fromEntries(rows.map(row => [row.agentId, deferred()]))
    mocks.test.mockImplementation(({ agentId }) => requests[agentId].promise)
    view.toolbar().onToggleAll()
    await nextTick()
    const pending = view.toolbar().onTest()
    await nextTick()
    expect(mocks.test).toHaveBeenCalledTimes(4)
    expect(view.toolbar().busy).toBe(true)
    expect(view.toolbar().progress.completed).toBe(0)
    await view.toolbar().onTest()
    await view.toolbar().onExport()
    await view.toolbar().onDelete()
    view.toolbar().onClear()
    view.table().onToggleSelection(rows[0], false)
    view.node('ProjectSwitcher').props['onUpdate:modelValue']('other')
    expect(fixture.project.selectProject).not.toHaveBeenCalled()
    expect(mocks.export).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(view.table().checkedAgentIds).toHaveLength(6)
    for (let index = 0; index < 4; index++) {
      requests[rows[index].agentId].resolve({ data: { success: index > 1 } })
    }
    await vi.waitFor(() => expect(mocks.test).toHaveBeenCalledTimes(6))
    expect(view.toolbar().progress.completed).toBe(4)
    requests['host-4'].resolve({ data: { success: true } })
    requests['host-5'].resolve({ data: { success: true } })
    await pending
    await nextTick()
    expect(view.toolbar().progress).toEqual({ total: 6, completed: 6, succeeded: 4, failed: 2 })
    expect(view.toolbar().busy).toBe(false)
    expect(view.table().agents.map(row => row.agentId)).toEqual(rows.map(row => row.agentId))
    expect(view.table().testingAgentIds).toEqual([])
  })

  it('exports a selection snapshot, handles failure, and supports another attempt', async () => {
    const view = await mount()
    await view.select(rows[0])
    mocks.export.mockRejectedValueOnce(new Error('export failed'))
    await view.toolbar().onExport()
    await nextTick()
    expect(mocks.showError).toHaveBeenCalledWith('export failed')
    expect(view.toolbar().busy).toBe(false)
    expect(view.toolbar().selectedCount).toBe(1)
    mocks.export.mockResolvedValue({ data: [rows[0]] })
    await view.toolbar().onExport()
    expect(mocks.export).toHaveBeenLastCalledWith(['host-0'])
    expect(mocks.download).toHaveBeenCalledOnce()
  })

  it('preserves selection when deletion is cancelled and deduplicates loaded descendants on confirmation', async () => {
    const view = await mount()
    fixture.loaded.set('middle', { agentId: 'middle', parentAgentId: 'host-0' })
    await view.select(rows[0])
    await view.select({ agentId: 'grandchild', parentAgentId: 'middle' })
    mocks.confirm.mockRejectedValueOnce(new Error('cancel'))
    await view.toolbar().onDelete()
    await nextTick()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(view.toolbar().selectedCount).toBe(2)
    expect(view.toolbar().busy).toBe(false)
    await view.toolbar().onDelete()
    await nextTick()
    expect(mocks.confirm).toHaveBeenLastCalledWith(expect.stringContaining('未选中子节点'), '批量删除确认', expect.any(Object))
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith({ agentId: 'host-0' })
    expect(view.toolbar().selectedCount).toBe(0)
  })

  it('distinguishes project detachment from asset deletion and respects read-only projects', async () => {
    const view = await mount()
    fixture.project.activeProjectId.value = 'source'
    fixture.project.activeProject.value = { projectId: 'source', contentEditable: true, status: 'active' }
    await view.select(rows[0])
    await view.toolbar().onDetach()
    expect(mocks.detach).toHaveBeenCalledWith('source', ['host-0'])
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining('主机资产本身会继续保留'), '确认删除', expect.any(Object))
    fixture.project.activeProject.value.contentEditable = false
    await view.select(rows[1])
    await view.toolbar().onDetach()
    expect(mocks.detach).toHaveBeenCalledOnce()
  })

  it('retains loaded ancestry for cascade deduplication after tree rows are filtered out', async () => {
    const view = await mount()
    mocks.children.mockResolvedValue({ data: [{ agentId: 'middle', parentAgentId: 'host-0' }] })
    await view.table().loadChildren(rows[0], { level: 1 }, vi.fn())
    fixture.loaded.clear()
    await view.select(rows[0])
    await view.select({ agentId: 'grandchild', parentAgentId: 'middle' })
    view.node('ElInput').props['onUpdate:modelValue']('Host 5')
    await nextTick()
    await view.toolbar().onDelete()
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith({ agentId: 'host-0' })
  })

  it('ignores late child loads from the previous workspace', async () => {
    const view = await mount()
    const request = deferred()
    const resolve = vi.fn()
    mocks.children.mockReturnValue(request.promise)
    const pending = view.table().loadChildren(rows[0], { level: 1 }, resolve)
    view.node('ProjectSwitcher').props['onUpdate:modelValue']('destination')
    request.resolve({ data: [{ agentId: 'old-child', parentAgentId: 'host-0' }] })
    await pending
    expect(resolve).toHaveBeenCalledExactlyOnceWith([])
  })

  it('passes selected hosts to project assignment and clears selection on workspace change', async () => {
    const view = await mount()
    await view.select(rows[0])
    view.toolbar().onAssign()
    expect(mocks.assign).toHaveBeenCalledWith([expect.objectContaining({ agentId: 'host-0' })])
    view.node('ProjectSwitcher').props['onUpdate:modelValue']('destination')
    await nextTick()
    expect(view.toolbar().selectedCount).toBe(0)
    expect(fixture.project.selectProject).toHaveBeenCalledWith('destination')
  })
})
