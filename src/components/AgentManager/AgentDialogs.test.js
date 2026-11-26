/* eslint-disable vue/one-component-per-file -- Fixture components render the real dialog templates. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { icons } from '@/utils/icons.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { createDefaultAgent } from '@/utils/constants.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'
import { useAgentForm } from '@/composables/agent/useAgentForm.js'
import { useAgentImportBatch } from '@/composables/agent/useAgentImportBatch.js'
import { MAX_AGENT_TRANSFER_BYTES, buildAgentTransferBundle, parseAgentTransferPayload } from '@/utils/agentTransfer.js'

const mocks = vi.hoisted(() => ({
  add: vi.fn(), update: vi.fn(), validate: vi.fn(),
  resetFields: vi.fn(), clearValidate: vi.fn(), scrollToTop: vi.fn(),
  export: vi.fn(), encode: vi.fn(), decode: vi.fn(), copy: vi.fn(), download: vi.fn(),
  listAccounts: vi.fn(), transferProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(), confirm: vi.fn(),
  attachProjectHosts: vi.fn(),
  showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn()
}))
vi.mock('@/services/api/agent-manage.js', () => ({
  addAgentApi: mocks.add, updateAgentApi: mocks.update, probeUrlPathsApi: vi.fn()
}))
vi.mock('@/services/api/disguises.js', () => ({ getDisguisesApi: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/services/api/agent-node.js', () => ({ testAgentConnectionConfigApi: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => mocks)

const AgentFormFields = defineComponent({
  inheritAttrs: false,
  props: {
    agent: Object,
    proxyEnabled: Boolean,
    paddingEnabled: Boolean,
    paddingPreset: String,
    paddingForm: Object
  },
  setup(props, { attrs, expose }) {
    expose({
      validate: mocks.validate, resetFields: mocks.resetFields,
      clearValidate: mocks.clearValidate, scrollToTop: mocks.scrollToTop
    })
    return () => h('AgentFormFields', { ...props, ...attrs })
  }
})
const ParentHostSummary = defineComponent({
  setup(_props, { attrs }) {
    return () => h('ParentHostSummary', attrs)
  }
})
const ProjectForm = defineComponent({
  setup(_props, { attrs, slots, expose }) {
    expose({ validate: mocks.validate, clearValidate: mocks.clearValidate })
    return () => h('ElForm', attrs, slots.default?.())
  }
})
const projectAdmin = ref(false)
const modules = {
  '@iconify/vue': { Icon: { render: () => null } },
  '@/utils/icons.js': { icons },
  '@/utils/messageUtils.js': mocks,
  '@/utils/dialogUtils.js': { useDialog },
  '@/utils/constants.js': { createDefaultAgent },
  '@/utils/apiUtils.js': { executeRequest },
  '@/utils/errorHandler.js': { handleError },
  '@/services/sessionLifecycle.js': { isCurrentSession, sessionGeneration },
  '@/utils/confirmUtils.js': { confirmAction: mocks.confirm },
  '@/composables/useAuth.js': { useAuth: () => ({ isAdmin: projectAdmin }) },
  '@/composables/agent/useAgentForm.js': { useAgentForm },
  '@/services/api/agent-manage.js': { addAgentApi: mocks.add, updateAgentApi: mocks.update, exportAgentsApi: mocks.export },
  '@/services/api/admin.js': { getEnabledUserOptionsApi: mocks.listAccounts },
  '@/services/api/projects.js': {
    addProjectApi: vi.fn(), archiveProjectApi: vi.fn(), deleteProjectApi: mocks.deleteProject,
    transferProjectApi: mocks.transferProject, updateProjectApi: mocks.updateProject,
    attachProjectAgentsApi: mocks.attachProjectHosts
  },
  '@element-plus/icons-vue': { Link: { render: () => null }, Monitor: { render: () => null } },
  '@/utils/downloadBlob.js': { downloadBlob: mocks.download },
  '@/utils/clipboard.js': { copyTextWithFeedback: mocks.copy },
  '@/composables/agent/useAgentImportBatch.js': { useAgentImportBatch },
  '@/utils/agentTransfer.js': {
    MAX_AGENT_TRANSFER_BYTES, buildAgentTransferBundle, parseAgentTransferPayload,
    encodeAgentTransferPayload: mocks.encode, decodeAgentTransferPayload: mocks.decode
  },
  './AgentFormFields.vue': { default: AgentFormFields },
  './AgentConnectionResultBanner.vue': { default: { render: () => null } },
  './ParentHostSummary.vue': { default: ParentHostSummary }
}

const compileDialog = name => compileClientComponent(new URL(`./${name}.vue`, import.meta.url), modules, `${name}-test`)
const AddAgent = compileDialog('AddAgent')
const EditAgent = compileDialog('EditAgent')
const ShareAgent = compileDialog('ShareAgent')
const ImportAgent = compileDialog('ImportAgent')
const ProjectEditorDialog = compileDialog('ProjectEditorDialog')
const ProjectAssignmentDialog = compileDialog('ProjectAssignmentDialog')

describe('Agent dialog shared form integration', () => {
  const apps = []
  const mountDialog = (component, props = {}) => {
    const renderer = createTestRenderer()
    const refresh = vi.fn()
    const saved = vi.fn()
    const app = renderer.createApp(component, { projectId: 'project-1', onRefresh: refresh, onSaved: saved, ...props })
    app.component('ElDialog', defineComponent({
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        return () => h('ElDialog', attrs, [slots.header?.({ titleId: 'fixture-title' }), slots.default?.(), slots.footer?.()])
      }
    }))
    app.component('ElForm', component === ProjectEditorDialog ? ProjectForm : createSlotStub('ElForm'))
    for (const name of ['ElButton', 'ElIcon', 'Icon', 'ElFormItem',
      'ElInput', 'ElRow', 'ElCol', 'ElTooltip', 'ElTag', 'ElCheckbox', 'ElRadioGroup', 'ElRadioButton',
      'ElSelect', 'ElOption', 'ElAlert']) {
      app.component(name, createSlotStub(name, ['header', 'default', 'footer']))
    }
    app.directive('loading', {})
    const vm = app.mount(renderer.root)
    apps.push(app)
    return {
      vm, refresh, saved, node: type => findNode(renderer.root, type),
      button: label => findNodes(renderer.root, node => node.type === 'ElButton'
        && node.children.some(child => child.text.trim() === label))[0],
      nodes: type => findNodes(renderer.root, node => node.type === type)
    }
  }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('FileReader', { LOADING: 1 })
    mocks.validate.mockResolvedValue(true)
    mocks.add.mockResolvedValue({ data: {} })
    mocks.update.mockResolvedValue({ data: {} })
    mocks.encode.mockReset()
    mocks.decode.mockReset()
    mocks.export.mockReset()
    projectAdmin.value = false
    mocks.listAccounts.mockReset().mockResolvedValue({ data: [
      { userId: 'current', userName: 'Current' },
      { userId: 'next', userName: 'Next' }
    ] })
    mocks.confirm.mockReset().mockResolvedValue(true)
    mocks.transferProject.mockReset().mockResolvedValue({ data: { projectId: 'p1', ownerUserId: 'next' } })
    mocks.updateProject.mockReset()
    mocks.deleteProject.mockReset().mockResolvedValue({ data: {} })
    mocks.attachProjectHosts.mockReset().mockResolvedValue({ data: { changedCount: 2 } })
  })
  afterEach(() => {
    for (const app of apps.splice(0)) app.unmount()
    vi.unstubAllGlobals()
  })

  it('waits for compression and only copies or downloads the current share', async () => {
    const first = deferred()
    const second = deferred()
    mocks.encode.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const hosts = ['first', 'second'].map(agentId => ({ agentId, parentAgentId: 'root', agentName: agentId }))
    mocks.export.mockResolvedValueOnce({ data: [hosts[0]] }).mockResolvedValueOnce({ data: [hosts[1]] })
    const dialog = mountDialog(ShareAgent)
    await dialog.vm.openShareAgent(hosts[0])
    await nextTick()
    expect(dialog.nodes('ElButton').at(-1).props.disabled).toBe(true)
    await dialog.vm.openShareAgent(hosts[1])
    await nextTick()
    second.resolve('current-compressed-config')
    await vi.waitFor(() => expect(dialog.nodes('ElInput').at(-1).props['model-value']).toBe('current-compressed-config'))
    first.resolve('outdated-config')
    await nextTick()
    const buttons = dialog.nodes('ElButton')
    await buttons.at(-1).props.onClick()
    buttons.at(-2).props.onClick()
    expect(mocks.copy).toHaveBeenCalledWith('current-compressed-config', expect.any(String), expect.any(String))
    expect(await mocks.download.mock.calls[0][0].text()).toBe('current-compressed-config')
  })

  it('cancels late decompression on close and imports resolved configuration with its ancestors', async () => {
    const pending = deferred()
    const bundle = buildAgentTransferBundle([
      { agentId: 'parent', parentAgentId: 'root', agentName: 'parent' },
      { agentId: 'child', parentAgentId: 'parent', agentName: 'child' }
    ], ['child'])
    mocks.decode.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(bundle)
    const dialog = mountDialog(ImportAgent)
    const parse = async () => {
      dialog.node('ElInput').props['onUpdate:modelValue']('compressed-config')
      await nextTick()
      return dialog.nodes('ElButton').find(node => node.props.class === 'submit-btn').props.onClick()
    }
    dialog.vm.openImportAgent()
    await nextTick()
    const cancelled = parse()
    await nextTick()
    dialog.node('ElDialog').props.onClose()
    pending.resolve(bundle)
    await cancelled
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    expect(dialog.node('ElDialog').props.modelValue).toBe(false)

    dialog.vm.openImportAgent()
    await nextTick()
    await parse()
    mocks.add.mockResolvedValueOnce({ data: { agentId: 'imported-parent' } })
      .mockResolvedValueOnce({ data: { agentId: 'imported-child' } })
    await nextTick()
    await dialog.nodes('ElButton').find(node => node.props.class === 'submit-btn').props.onClick()
    expect(mocks.add.mock.calls.map(([agent]) => [agent.agentName, agent.parentAgentId]))
      .toEqual([['parent', 'root'], ['child', 'imported-parent']])
    expect(dialog.refresh).toHaveBeenCalledOnce()
  })

  it('adds the current form with project context and resets it after success', async () => {
    const dialog = mountDialog(AddAgent)
    dialog.vm.openAddAgent()
    await nextTick()
    const fields = dialog.node('AgentFormFields')
    Object.assign(fields.props.agent, { agentName: 'new node', headers: 'X-Token: value' })
    fields.props['onUpdate:proxyEnabled'](true)
    fields.props['onUpdate:paddingEnabled'](true)
    fields.props.onApplyPaddingPreset('light')
    await nextTick()
    await fields.props.onSubmit()
    await nextTick()

    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'new node', proxyEnabled: 1, headers: '{"X-Token":"value"}',
      paddingStrategy: '{"enabled":true,"lengthDistribution":"UNIFORM","minBytes":16,"maxBytes":128}'
    }), { projectId: 'project-1' })
    expect(dialog.refresh).toHaveBeenCalledOnce()
    expect(dialog.node('ElDialog').props.modelValue).toBe(false)
    expect(fields.props.agent.agentName).toBe('')
    expect(dialog.node('AgentFormFields').props.proxyEnabled).toBe(false)
  })

  it('edits stored configuration and clears parent context when closed', async () => {
    const dialog = mountDialog(EditAgent)
    const saved = { agentId: 'node-1', agentName: 'old node', headers: '{"X-Token":"value"}', proxyEnabled: '1' }
    const parent = { host: { hostId: 'host-1' }, status: 'online', label: '在线' }
    dialog.vm.openEditAgentDialog(saved, parent)
    await nextTick()
    const fields = dialog.node('AgentFormFields')
    expect(fields.props.proxyEnabled).toBe(true)
    expect(fields.props.agent.headers).toBe('X-Token: value')
    expect(dialog.node('ParentHostSummary').props.host).toEqual(parent.host)
    fields.props.agent.agentName = 'updated node'
    await fields.props.onSubmit()
    await nextTick()

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'node-1', agentName: 'updated node', headers: saved.headers, proxyEnabled: 1
    }))
    expect(saved.agentName).toBe('old node')
    expect(dialog.refresh).toHaveBeenCalledOnce()
    expect(dialog.node('ElDialog').props.modelValue).toBe(false)
    expect(dialog.node('ParentHostSummary')).toBeNull()
  })

  it.each([['add', AddAgent], ['edit', EditAgent]])('stops %s submission on invalid input', async (_name, component) => {
    const dialog = mountDialog(component)
    mocks.validate.mockResolvedValue(false)
    await dialog.node('AgentFormFields').props.onSubmit()
    expect(mocks.add).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(dialog.refresh).not.toHaveBeenCalled()
  })

  it('only offers ownership transfer to admins editing an existing project and loads accounts on demand', async () => {
    const dialog = mountDialog(ProjectEditorDialog)
    dialog.vm.open({ projectId: 'p1', ownerUserId: 'current' })
    await nextTick()
    expect(dialog.button('交接负责人')).toBeUndefined()

    projectAdmin.value = true
    dialog.vm.open()
    await nextTick()
    expect(dialog.button('交接负责人')).toBeUndefined()
    dialog.vm.open({ projectId: 'p1', ownerUserId: 'current' })
    await nextTick()
    expect(mocks.listAccounts).not.toHaveBeenCalled()
    await dialog.button('交接负责人').props.onClick()
    await nextTick()
    expect(mocks.listAccounts).toHaveBeenCalledOnce()
    expect(dialog.nodes('ElOption').map(option => option.props.value)).toEqual(['next'])
    expect(dialog.button('提交交接').props.disabled).toBe(true)
  })

  it('shows account loading failures inline and retries without reopening the dialog', async () => {
    projectAdmin.value = true
    mocks.listAccounts.mockRejectedValueOnce(new Error('账号目录暂时不可用'))
    const dialog = mountDialog(ProjectEditorDialog)
    dialog.vm.open({ projectId: 'p1', ownerUserId: 'current' })
    await nextTick()
    await dialog.button('交接负责人').props.onClick()
    await nextTick()

    expect(dialog.node('ElAlert').props.title).toBe('账号目录暂时不可用')
    expect(dialog.button('提交交接')).toBeUndefined()
    await dialog.button('重新加载').props.onClick()
    await nextTick()
    expect(dialog.node('ElAlert')).toBeNull()
    expect(dialog.nodes('ElOption').map(option => option.props.value)).toEqual(['next'])
    expect(mocks.listAccounts).toHaveBeenCalledTimes(2)
  })

  it('confirms a transfer without saving project edits and refreshes the directory on success', async () => {
    projectAdmin.value = true
    const dialog = mountDialog(ProjectEditorDialog)
    dialog.vm.open({ projectId: 'p1', projectName: 'Project', ownerUserId: 'current', status: 'archived' })
    await nextTick()
    await dialog.button('交接负责人').props.onClick()
    await nextTick()
    dialog.node('ElSelect').props['onUpdate:modelValue']('next')
    await nextTick()

    mocks.confirm.mockResolvedValueOnce(false)
    await dialog.button('提交交接').props.onClick()
    expect(mocks.transferProject).not.toHaveBeenCalled()

    await dialog.button('提交交接').props.onClick()
    expect(mocks.confirm).toHaveBeenLastCalledWith(expect.objectContaining({
      message: expect.stringContaining('共享团队和归档状态保持原样')
    }))
    expect(mocks.transferProject).toHaveBeenCalledExactlyOnceWith('p1', 'next')
    expect(mocks.updateProject).not.toHaveBeenCalled()
    expect(dialog.saved).toHaveBeenCalledExactlyOnceWith({ projectId: 'p1', ownerUserId: 'next' })
    expect(dialog.node('ElDialog').props.modelValue).toBe(false)
  })

  it('drops a late account list or confirmation from a previously opened project', async () => {
    projectAdmin.value = true
    const dialog = mountDialog(ProjectEditorDialog)
    const pending = deferred()
    mocks.listAccounts.mockReturnValueOnce(pending.promise)
    dialog.vm.open({ projectId: 'p1', ownerUserId: 'current' })
    await nextTick()
    const oldList = dialog.button('交接负责人').props.onClick()
    dialog.vm.open({ projectId: 'p2', ownerUserId: 'current' })
    expect(mocks.listAccounts.mock.calls[0][0].signal.aborted).toBe(true)
    await nextTick()
    await dialog.button('交接负责人').props.onClick()
    pending.resolve({ data: [{ userId: 'late', userName: 'Late' }] })
    await oldList
    await nextTick()
    expect(dialog.nodes('ElOption').map(option => option.props.value)).toEqual(['next'])

    const confirmation = deferred()
    mocks.confirm.mockReturnValueOnce(confirmation.promise)
    dialog.node('ElSelect').props['onUpdate:modelValue']('next')
    await nextTick()
    const oldTransfer = dialog.button('提交交接').props.onClick()
    dialog.vm.open({ projectId: 'p3', ownerUserId: 'current' })
    confirmation.resolve(true)
    await oldTransfer
    expect(mocks.transferProject).not.toHaveBeenCalled()
  })

  it('locks project validation and preserves the archived draft when restoring fails', async () => {
    const dialog = mountDialog(ProjectEditorDialog)
    dialog.vm.open({ projectId: 'p1', projectName: 'Original', status: 'archived' })
    await nextTick()
    dialog.nodes('ElInput')[0].props['onUpdate:modelValue']('Updated draft')
    const validation = deferred()
    mocks.validate.mockReturnValueOnce(validation.promise)
    const save = dialog.button('保存').props.onClick
    const pending = save()
    await save()
    expect(mocks.validate).toHaveBeenCalledOnce()
    validation.resolve(false)
    await pending
    expect(mocks.updateProject).not.toHaveBeenCalled()

    mocks.updateProject.mockRejectedValueOnce(new Error('项目暂时无法恢复'))
    await dialog.nodes('button').find(node => node.props.class?.includes('restore')).props.onClick()

    expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      projectId: 'p1', projectName: 'Updated draft', status: 'active'
    }))
    expect(dialog.node('ElForm').props.model.status).toBe('archived')
    expect(dialog.nodes('ElInput')[0].props.modelValue).toBe('Updated draft')
    expect(dialog.node('ElDialog').props.modelValue).toBe(true)
    expect(mocks.showError).toHaveBeenCalledWith('项目暂时无法恢复')
    expect(dialog.saved).not.toHaveBeenCalled()
  })

  it('keeps a delete confirmation bound to the project it was opened for', async () => {
    const dialog = mountDialog(ProjectEditorDialog)
    const deleteButton = () => dialog.nodes('button').find(node => node.props.class?.includes('delete'))
    const first = deferred()
    const second = deferred()
    mocks.confirm.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    dialog.vm.open({ projectId: 'p1', projectName: 'First' })
    await nextTick()
    const previous = deleteButton().props.onClick()
    dialog.vm.open({ projectId: 'p2', projectName: 'Second' })
    await nextTick()
    const current = deleteButton().props.onClick()
    first.resolve(true)
    await previous
    await nextTick()
    expect(deleteButton().props.disabled).toBe(true)
    expect(mocks.deleteProject).not.toHaveBeenCalled()

    second.resolve(true)
    await current
    expect(mocks.deleteProject).toHaveBeenCalledExactlyOnceWith('p2')
    expect(dialog.saved).toHaveBeenCalledExactlyOnceWith()
  })

  it('assigns selected hosts to the chosen project using only their IDs', async () => {
    const dialog = mountDialog(ProjectAssignmentDialog, {
      projects: [{ projectId: 'p1', projectName: '目标项目', contentEditable: true }]
    })
    await dialog.vm.open([{ agentId: 'host-1' }, { agentId: 'host-2' }], 'p1')

    expect(dialog.node('ElSelect')).toBeNull()
    await dialog.button('确认加入').props.onClick()
    expect(mocks.attachProjectHosts).toHaveBeenCalledExactlyOnceWith('p1', ['host-1', 'host-2'])
    expect(dialog.saved).toHaveBeenCalledExactlyOnceWith('p1')
  })
})
