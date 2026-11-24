import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { AUTH_FIELD_LIMITS } from '@/constants/app.js'
import * as formUtils from '@/utils/formUtils.js'
import * as dialogUtils from '@/utils/dialogUtils.js'
import * as userManagerModel from './userManagerModel.js'
import { executeRequest, withLoading } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { formatDate } from '@/utils/format.js'
import { icons } from '@/utils/icons.js'

const api = Object.fromEntries(['addUserApi', 'deleteUserApi', 'getAllUsersApi', 'getAllTeamsApi',
  'updateUserApi', 'resetUserPasswordApi'].map(name => [name, vi.fn()]))
const messages = vi.hoisted(() => ({ showSuccess: vi.fn(), showWarning: vi.fn(), showError: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => messages)
const actor = { currentUser: ref({ userId: 'manager' }), isAdmin: ref(true), isLeader: ref(false), fetchAuth: async () => {} }
const stub = (name, slots) => ({ default: createSlotStub(name, slots) })
const View = compileClientComponent(new URL('./UserManager.vue', import.meta.url), {
  '@/components/common/PageHeader.vue': stub('PageHeader', ['actions']),
  '@/components/Admin/shared/AdminToolbar.vue': stub('AdminToolbar', ['default', 'actions']),
  '@/components/common/StatsStrip.vue': stub('StatsStrip'),
  '@/components/Admin/shared/AdminWorkspacePanel.vue': stub('AdminWorkspacePanel', ['tags', 'default']),
  '@/components/common/StatusIndicator.vue': stub('StatusIndicator'),
  './UserEditorDialog.vue': stub('UserEditorDialog'),
  './UserPasswordResetDialog.vue': stub('UserPasswordResetDialog'),
  './userManagerModel.js': userManagerModel,
  '@/constants/app.js': { AUTH_FIELD_LIMITS },
  '@/utils/icons.js': { icons },
  '@/utils/format.js': { formatDate },
  '@/utils/apiUtils.js': { executeRequest, withLoading },
  '@/utils/errorHandler.js': { handleError },
  '@/utils/messageUtils.js': messages,
  '@/utils/formUtils.js': formUtils,
  '@/utils/dialogUtils.js': dialogUtils,
  '@/utils/confirmUtils.js': { confirmDelete: vi.fn(), confirmAction: vi.fn() },
  '@/utils/exportUtils.js': { exportTsv: vi.fn() },
  '@/services/api/admin.js': api,
  '@/composables/useAuth.js': { useAuth: () => actor }
})
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const flush = async () => { for (let i = 0; i < 6; i++) await nextTick() }

async function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.directive('loading', {})
  for (const name of ['Icon', 'ElIcon', 'ElButton', 'ElInput', 'ElSelect', 'ElOption', 'ElTag',
    'ElTooltip', 'ElAvatar', 'ElAlert', 'ElTable']) app.component(name, createSlotStub(name))
  app.component('ElTableColumn', {
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h('ElTableColumn', attrs, ['操作', '所属团队'].includes(attrs.label) ? slots.default?.({ row }) : [])
    }
  })
  app.mount(renderer.root)
  apps.push(app)
  await flush()
  const nodes = (predicate) => findNodes(renderer.root, predicate)
  return {
    dialog: type => nodes(node => node.type === type)[0].props,
    button: label => nodes(node => node.type === 'ElButton' && text(node) === label)[0].props,
    alert: () => nodes(node => node.type === 'ElAlert')[0]?.props.title,
    rows: () => nodes(node => node.type === 'ElTable')[0].props.data,
    teamLabel: () => text(nodes(node => node.type === 'ElTag' && node.props.title === row.teamId)[0])
  }
}

const row = { userId: 'member', userName: 'Alice', privilege: 'normal', status: 1, teamId: 'team' }

beforeEach(() => {
  vi.resetAllMocks()
  api.getAllUsersApi.mockResolvedValue({ data: [row] })
  api.getAllTeamsApi.mockResolvedValue({ data: [{ teamId: 'team', teamName: 'Example' }] })
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

it('locks creation during validation and reports a refresh failure separately from success', async () => {
  const view = await mount()
  const editor = () => view.dialog('UserEditorDialog')
  view.button('新增用户').onClick()
  await flush()
  Object.assign(editor()['form-state'], { userName: ' Bob ', password: 'fixture-value', confirmPassword: 'fixture-value' })
  const validation = deferred()
  const validate = vi.fn(() => validation.promise)
  editor().onFormReady({ validate })
  api.addUserApi.mockResolvedValue({ data: null })
  api.getAllUsersApi.mockRejectedValueOnce(new Error('目录暂不可用'))

  const submit = editor().onSubmit()
  await editor().onSubmit()
  expect(validate).toHaveBeenCalledOnce()
  expect(api.addUserApi).not.toHaveBeenCalled()
  validation.resolve(true)
  await submit
  expect(api.addUserApi).toHaveBeenCalledExactlyOnceWith({
    userName: 'Bob', password: 'fixture-value', status: 1, teamId: '', privilege: 'normal'
  })
  expect(api.getAllTeamsApi).toHaveBeenCalledOnce()
  expect(messages.showSuccess).toHaveBeenCalledWith('用户已创建')
  expect(messages.showError).not.toHaveBeenCalled()
  expect(view.alert()).toBe('目录暂不可用')
  expect(editor()['form-state'].password).toBe('')
})

it('clears a cancelled password reset and ignores duplicate valid submissions', async () => {
  const view = await mount()
  const dialog = () => view.dialog('UserPasswordResetDialog')
  view.button('重置密码').onClick()
  await flush()
  Object.assign(dialog()['form-state'], { newPassword: 'discarded', confirmPassword: 'discarded' })
  dialog()['onUpdate:modelValue'](false)
  expect(dialog()['form-state'].newPassword).toBe('')
  expect(dialog()['form-state'].userId).toBe('')
  await flush()
  view.button('重置密码').onClick()
  await flush()
  const validate = vi.fn().mockResolvedValue(true)
  dialog().onFormReady({ validate })
  Object.assign(dialog()['form-state'], { newPassword: 'fixture-reset', confirmPassword: 'fixture-reset' })
  const saving = deferred()
  api.resetUserPasswordApi.mockReturnValue(saving.promise)
  const submit = dialog().onSubmit()
  await dialog().onSubmit()
  await flush()
  expect(validate).toHaveBeenCalledOnce()
  expect(api.resetUserPasswordApi).toHaveBeenCalledExactlyOnceWith({ userId: 'member', newPassword: 'fixture-reset' })
  saving.resolve({})
  await submit
  expect(dialog()['form-state'].newPassword).toBe('')
})

it('does not let an old refresh replace newer rows', async () => {
  const view = await mount()
  const stale = deferred()
  api.getAllUsersApi.mockReturnValueOnce(stale.promise).mockResolvedValueOnce({ data: [{ ...row, userName: 'Latest' }] })
  const previous = view.button('刷新').onClick()
  await view.button('刷新').onClick()
  expect(api.getAllUsersApi.mock.calls[1][0].signal.aborted).toBe(true)
  stale.resolve({ data: [{ ...row, userName: 'Stale' }] })
  await previous
  expect(view.rows().map(({ userName }) => userName)).toEqual(['Latest'])
})

it('shows user rows while teams are pending or unavailable, then resolves their team names after refresh', async () => {
  const pending = deferred()
  api.getAllTeamsApi.mockReturnValueOnce(pending.promise)
  const view = await mount()

  expect(view.rows()).toEqual([row])
  expect(view.teamLabel()).toBe('team')
  expect(view.button('新增用户').disabled).toBe(true)
  pending.reject(new Error('暂时不可用'))
  await flush()
  expect(view.alert()).toBe('团队目录加载失败：暂时不可用')
  expect(view.rows()).toEqual([row])
  expect(view.button('重置密码').disabled).toBe(false)
  expect(view.button('编辑').disabled).toBe(true)

  await view.button('刷新').onClick()
  await flush()
  expect(view.alert()).toBeUndefined()
  expect(view.teamLabel()).toBe('Example')
  expect(view.button('新增用户').disabled).toBe(false)
})
