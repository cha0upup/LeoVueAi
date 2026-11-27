import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'
import { isCurrentSession, resetSessionState, sessionGeneration } from '@/services/sessionLifecycle.js'

const api = Object.fromEntries(['getAllTeamsApi', 'getAllUsersApi', 'getTeamLeaderOptionsApi',
  'addTeamApi', 'deleteTeamApi'].map(name => [name, vi.fn()]))
const messages = vi.hoisted(() => ({ showSuccess: vi.fn(), showWarning: vi.fn(), showError: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => messages)
const isAdmin = ref(true)
const confirmDelete = vi.fn()
const existingTeam = { teamId: 'team', teamName: 'Example', leaderId: 'lead-123', leaderName: 'Alice' }
const stub = (name, slots) => ({ default: createSlotStub(name, slots) })
const View = compileClientComponent(new URL('./TeamManager.vue', import.meta.url), {
  '@/components/common/PageHeader.vue': stub('PageHeader', ['actions']),
  '@/components/Admin/shared/AdminToolbar.vue': stub('AdminToolbar', ['default', 'actions']),
  '@/components/common/StatsStrip.vue': stub('StatsStrip'),
  '@/components/Admin/shared/AdminWorkspacePanel.vue': stub('AdminWorkspacePanel', ['tags', 'default']),
  '@/utils/icons.js': { icons },
  '@/constants/app.js': { ROUTE_PATHS },
  '@/utils/format.js': { formatDate },
  '@/utils/apiUtils.js': { executeRequest },
  '@/utils/errorHandler.js': { handleError },
  '@/utils/messageUtils.js': messages,
  '@/utils/confirmUtils.js': { confirmDelete },
  '@/services/api/admin.js': api,
  '@/services/sessionLifecycle.js': { isCurrentSession, sessionGeneration },
  '@/composables/useAuth.js': { useAuth: () => ({ isAdmin, fetchAuth: async () => {} }) }
})
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const flush = async () => { for (let i = 0; i < 5; i++) await nextTick() }

async function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.directive('loading', {})
  for (const name of ['Icon', 'ElIcon', 'RouterLink', 'ElButton', 'ElInput', 'ElSelect', 'ElOption', 'ElTag',
    'ElTable', 'ElForm', 'ElFormItem', 'ElAlert']) {
    app.component(name, createSlotStub(name))
  }
  app.component('ElTableColumn', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h('ElTableColumn', attrs, ['操作', '团队名称'].includes(attrs.label) ? slots.default?.({ row: existingTeam }) : [])
    }
  }))
  app.component('ElDialog', createSlotStub('ElDialog', ['default', 'footer']))
  app.mount(renderer.root)
  apps.push(app)
  await flush()
  const nodes = type => findNodes(renderer.root, node => node.type === type)
  const field = (type, placeholder) => nodes(type).find(node => node.props.placeholder === placeholder).props
  return {
    button: label => nodes('ElButton').find(node => text(node) === label)?.props,
    metric: label => nodes('button').find(node => text(node).startsWith(label)).props,
    membersLink: () => nodes('RouterLink')[0]?.props.to,
    change: (type, placeholder, value) => field(type, placeholder)['onUpdate:modelValue'](value),
    field,
    form: () => nodes('ElForm')[0].props,
    submit: (event = { preventDefault() {} }) => nodes('ElForm')[0].props.onSubmit(event),
    options: () => nodes('ElOption').map(node => node.props.value),
    rows: () => nodes('ElTable')[0].props.data,
    emptyText: () => nodes('ElTable')[0].props['empty-text'],
    alerts: () => nodes('ElAlert').map(node => node.props.title)
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  isAdmin.value = true
  api.getAllTeamsApi.mockResolvedValue({ data: [existingTeam] })
  api.getTeamLeaderOptionsApi.mockResolvedValue({ data: [{ userId: 'candidate', userName: 'Bob' }] })
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

it('filters teams by leader assignment and combines it with the keyword', async () => {
  const unassigned = { teamId: 'pending', teamName: 'New team', leaderId: null }
  api.getAllTeamsApi.mockResolvedValue({ data: [existingTeam, unassigned] })
  const view = await mount()

  view.metric('已分配队长').onClick()
  await nextTick()
  expect(view.rows()).toEqual([existingTeam])
  view.metric('待分配队长').onClick()
  await nextTick()
  expect(view.rows()).toEqual([unassigned])
  expect(view.metric('待分配队长')['aria-pressed']).toBe(true)

  view.change('ElInput', '搜索团队名称、团队ID、队长', 'alice')
  await nextTick()
  expect(view.rows()).toEqual([])
  expect(view.emptyText()).toBe('没有匹配的团队')

  view.button('清空筛选').onClick()
  await nextTick()
  expect(view.rows()).toEqual([existingTeam, unassigned])
  expect(api.getAllTeamsApi).toHaveBeenCalledOnce()
})

it('searches by the loaded leader and only requests candidates when creating a team', async () => {
  const view = await mount()
  expect(view.membersLink()).toEqual({ path: ROUTE_PATHS.admin, query: { tab: 'users', teamId: 'team' } })
  expect(api.getAllTeamsApi).toHaveBeenCalledOnce()
  expect(api.getAllUsersApi).not.toHaveBeenCalled()
  expect(api.getTeamLeaderOptionsApi).not.toHaveBeenCalled()
  view.change('ElInput', '搜索团队名称、团队ID、队长', 'alice')
  await nextTick()
  expect(view.rows().map(row => row.teamId)).toEqual(['team'])
  view.change('ElInput', '搜索团队名称、团队ID、队长', 'lead-123')
  await nextTick()
  expect(view.rows().map(row => row.teamId)).toEqual(['team'])
  await view.button('新增团队').onClick()
  await nextTick()
  expect(view.options()).toEqual(['candidate'])
  expect(api.getAllUsersApi).not.toHaveBeenCalled()
  expect(view.button('提交')).toMatchObject({ 'native-type': 'submit', form: view.form().id })
  await view.submit()
  expect(api.addTeamApi).not.toHaveBeenCalled()

  view.change('ElInput', '请输入团队名称', ' Team B ')
  view.change('ElSelect', '请选择队长', 'candidate')
  await nextTick()
  const saving = deferred()
  api.addTeamApi.mockReturnValue(saving.promise)
  const preventDefault = vi.fn()
  const submit = view.submit({ preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce()
  await view.submit()
  expect(api.addTeamApi).toHaveBeenCalledExactlyOnceWith({ teamName: 'Team B', leaderId: 'candidate' })
  saving.resolve({ data: null })
  await submit
  expect(api.getAllTeamsApi).toHaveBeenCalledTimes(2)
  expect(api.getTeamLeaderOptionsApi).toHaveBeenCalledOnce()
})

it('aborts a closed dialog and retries failed candidate requests without applying old results', async () => {
  const view = await mount()
  const earlier = deferred()
  api.getTeamLeaderOptionsApi.mockReturnValueOnce(earlier.promise).mockRejectedValueOnce(new Error('加载失败'))
  const oldLoad = view.button('新增团队').onClick()
  view.button('取消').onClick()
  expect(api.getTeamLeaderOptionsApi.mock.calls[0][0].signal.aborted).toBe(true)
  await view.button('新增团队').onClick()
  await nextTick()
  expect(view.alerts()).toContain('加载失败')
  expect(view.button('提交').disabled).toBe(true)
  await view.button('重新加载队长候选').onClick()
  earlier.resolve({ data: [{ userId: 'obsolete' }] })
  await oldLoad
  await nextTick()
  expect(view.alerts()).toEqual([])
  expect(view.options()).toEqual(['candidate'])
})

it('keeps the team draft and reloads candidates after the selected leader becomes unavailable', async () => {
  const view = await mount()
  await view.button('新增团队').onClick()
  view.change('ElInput', '请输入团队名称', 'New team')
  view.change('ElSelect', '请选择队长', 'candidate')
  api.addTeamApi.mockRejectedValueOnce({
    response: { status: 409, data: { code: 409, msg: '所选队长已加入团队，请重新选择' } }
  }).mockResolvedValueOnce({ data: null })
  api.getTeamLeaderOptionsApi.mockResolvedValueOnce({ data: [{ userId: 'replacement', userName: 'Eve' }] })
  await nextTick()

  await view.submit()
  expect(api.addTeamApi).toHaveBeenCalledExactlyOnceWith({ teamName: 'New team', leaderId: 'candidate' })
  expect(api.getTeamLeaderOptionsApi).toHaveBeenCalledTimes(2)
  expect(view.field('ElSelect', '请选择队长').modelValue).toBe('')
  expect(view.options()).toEqual(['replacement'])
  expect(view.button('提交').disabled).toBe(true)
  expect(messages.showError).toHaveBeenCalledWith('所选队长已加入团队，请重新选择')

  view.change('ElSelect', '请选择队长', 'replacement')
  await nextTick()
  await view.submit()
  expect(api.addTeamApi).toHaveBeenLastCalledWith({ teamName: 'New team', leaderId: 'replacement' })
})

it('ignores team creation feedback after leaving the page', async () => {
  const view = await mount()
  await view.button('新增团队').onClick()
  view.change('ElInput', '请输入团队名称', 'New team')
  view.change('ElSelect', '请选择队长', 'candidate')
  const pending = deferred()
  api.addTeamApi.mockReturnValueOnce(pending.promise)
  const submit = view.submit()
  expect(api.addTeamApi).toHaveBeenCalledOnce()

  apps.pop().unmount()
  pending.resolve({ data: null })
  await submit
  expect(messages.showSuccess).not.toHaveBeenCalled()
  expect(api.getAllTeamsApi).toHaveBeenCalledOnce()
})

it('retains teams on a refresh failure but keeps a confirmed missing team off the list', async () => {
  const view = await mount()
  api.getAllTeamsApi.mockRejectedValueOnce(new Error('目录暂不可用'))
  await view.button('刷新').onClick()
  expect(view.rows()).toEqual([existingTeam])
  expect(view.alerts()).toEqual(['目录暂不可用'])
  expect(view.button('删除').disabled).toBe(true)
  await view.button('删除').onClick()
  expect(confirmDelete).not.toHaveBeenCalled()

  await view.button('刷新').onClick()
  expect(view.button('删除').disabled).toBe(false)
  confirmDelete.mockResolvedValueOnce(true)
  api.deleteTeamApi.mockRejectedValueOnce({ response: { status: 404, data: { code: 404, msg: '团队不存在' } } })
  api.getAllTeamsApi.mockRejectedValueOnce(new Error('刷新暂不可用'))

  await view.button('删除').onClick()
  expect(api.deleteTeamApi).toHaveBeenCalledExactlyOnceWith({ id: 'team' })
  expect(api.getAllTeamsApi).toHaveBeenCalledTimes(4)
  expect(view.rows()).toEqual([])
  expect(view.alerts()).toEqual(['刷新暂不可用'])
})

it('ignores team deletion feedback from a previous session', async () => {
  const view = await mount()
  const pending = deferred()
  confirmDelete.mockResolvedValueOnce(true)
  api.deleteTeamApi.mockReturnValueOnce(pending.promise)
  const deletion = view.button('删除').onClick()
  await flush()
  expect(api.deleteTeamApi).toHaveBeenCalledOnce()

  resetSessionState()
  pending.reject({ response: { status: 404, data: { code: 404, msg: '团队不存在' } } })
  await deletion
  expect(messages.showError).not.toHaveBeenCalled()
  expect(api.getAllTeamsApi).toHaveBeenCalledOnce()
})

it('does not load admin candidates for a team leader', async () => {
  isAdmin.value = false
  const view = await mount()
  expect(view.button('新增团队')).toBeUndefined()
  expect(api.getTeamLeaderOptionsApi).not.toHaveBeenCalled()
  expect(view.rows()).toHaveLength(1)
})
