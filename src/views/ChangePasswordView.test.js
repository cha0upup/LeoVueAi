import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { authPageTarget } from '@/routerGuards.js'
import { usePasswordChangeForm } from '@/composables/usePasswordChangeForm.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'

const calls = vi.hoisted(() => ({
  changePassword: vi.fn(), logout: vi.fn(), validate: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(), resetAuth: vi.fn()
}))
const auth = { passwordMinLength: ref(12), passwordMaxLength: ref(256), resetAuth: calls.resetAuth }
vi.mock('@/composables/useAuth.js', () => ({ useAuth: () => auth }))
vi.mock('@/services/api/auth.js', () => ({ changePasswordApi: calls.changePassword, logoutApi: calls.logout }))
vi.mock('@/utils/formUtils.js', async original => ({ ...await original(), validateForm: calls.validate }))
vi.mock('@/utils/messageUtils.js', () => calls)

const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const flush = async () => { for (let i = 0; i < 5; i++) await nextTick() }
const credentials = { oldPassword: ' current-fixture-password ', newPassword: ' new-fixture-password ' }

function mount(kind, query = {}) {
  const replace = vi.fn().mockResolvedValue(undefined)
  const modules = {
    '@/utils/icons.js': { icons },
    '@/composables/usePasswordChangeForm.js': { usePasswordChangeForm }
  }
  if (kind === 'page') Object.assign(modules, {
    'vue-router': { useRoute: () => ({ query }), useRouter: () => ({ replace }) },
    '@/routerGuards.js': { authPageTarget },
    '@/constants/app.js': { ROUTE_PATHS },
    '@/composables/useAuth.js': { useAuth: () => auth },
    '@/services/api/auth.js': { logoutApi: calls.logout },
    '@/services/sessionLifecycle.js': { isCurrentSession, sessionGeneration },
    '@/utils/messageUtils.js': { showError: calls.showError }
  })
  else modules['@/utils/dialogUtils.js'] = { useDialog }
  const file = kind === 'page' ? './ChangePasswordView.vue' : '../components/common/ChangePasswordDialog.vue'
  const View = compileClientComponent(new URL(file, import.meta.url), modules)
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.component('ElDialog', createSlotStub('dialog-fixture', ['default', 'footer']))
  app.component('ElForm', createSlotStub('form-fixture'))
  app.component('ElFormItem', createSlotStub('item'))
  app.component('ElInput', createSlotStub('input', []))
  app.component('ElButton', createSlotStub('button'))
  for (const name of ['ElIcon', 'Icon']) app.component(name, { render: () => null })
  const vm = app.mount(renderer.root)
  apps.push(app)
  const unmount = () => { app.unmount(); apps.splice(apps.indexOf(app), 1) }
  const formNode = () => findNode(renderer.root, 'form-fixture')
  const form = formNode().props.model
  const button = label => findNodes(renderer.root, node => node.type === 'button' && text(node) === label)[0]?.props
  return {
    form, formNode, replace, open: vm.openChangePasswordDialog, unmount, button,
    dialog: () => findNode(renderer.root, 'dialog-fixture')?.props,
    fill: () => Object.assign(form, credentials, { confirmPassword: credentials.newPassword }),
    submit: () => button(kind === 'page' ? '修改密码并进入控制台' : '提交修改').onClick()
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.passwordMinLength.value = 12
  calls.validate.mockResolvedValue(true)
  calls.changePassword.mockResolvedValue({})
  calls.logout.mockResolvedValue({})
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

describe('required password update page', () => {
  it('applies the password policy and submits the exact credentials only once', async () => {
    const view = mount('page')
    const { rules } = view.formNode().props
    expect(rules.newPassword[1]).toMatchObject({ min: 12, max: 256 })
    expect(rules.oldPassword[0]).not.toHaveProperty('min')

    view.fill()
    const validation = deferred()
    calls.validate.mockReturnValueOnce(validation.promise)
    const submit = view.button('修改密码并进入控制台').onClick
    const pending = submit()
    await submit()
    await flush()
    expect(view.formNode().props.disabled).toBe(true)
    expect(view.button('退出并切换账户').disabled).toBe(true)
    await view.button('退出并切换账户').onClick()
    expect(calls.logout).not.toHaveBeenCalled()
    expect(calls.validate).toHaveBeenCalledOnce()
    expect(calls.changePassword).not.toHaveBeenCalled()

    validation.resolve(true)
    await pending
    expect(calls.changePassword).toHaveBeenCalledExactlyOnceWith(credentials)
    expect(view.form).toEqual({ oldPassword: '', newPassword: '', confirmPassword: '' })
    expect(view.replace).toHaveBeenCalledExactlyOnceWith({ path: ROUTE_PATHS.startup })
  })

  it('retries only session verification after the password write has succeeded', async () => {
    const redirect = '/admin?tab=statistics#latest'
    const view = mount('page', { redirect })
    view.fill()
    view.replace.mockRejectedValueOnce(new Error('fixture navigation issue'))
    await view.submit()
    await flush()
    expect(view.formNode()).toBeNull()
    expect(calls.showSuccess).toHaveBeenCalledOnce()

    await view.button('重新检查登录状态').onClick()
    expect(calls.changePassword).toHaveBeenCalledOnce()
    expect(view.replace.mock.calls).toEqual([
      [{ path: ROUTE_PATHS.startup, query: { redirect } }],
      [{ path: ROUTE_PATHS.startup, query: { redirect } }]
    ])
  })

  it('does not submit an invalid form or carry a disallowed redirect into recovery', async () => {
    const view = mount('page', { redirect: '/startup' })
    calls.validate.mockResolvedValueOnce(false)
    await view.submit()
    expect(calls.changePassword).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
    await view.submit()
    expect(view.replace).toHaveBeenCalledExactlyOnceWith({ path: ROUTE_PATHS.startup })
  })
})

describe('password update dialog', () => {
  it('clears cancelled credentials and applies the current password policy', async () => {
    const view = mount('dialog')
    view.open()
    view.fill()
    await flush()
    auth.passwordMinLength.value = 14
    await flush()
    expect(view.formNode().props.rules.newPassword[1]).toMatchObject({ min: 14, max: 256 })
    view.button('取消').onClick()
    expect(view.form).toEqual({ oldPassword: '', newPassword: '', confirmPassword: '' })
    expect(calls.changePassword).not.toHaveBeenCalled()
  })

  it('closes the dialog and clears credentials after a successful update', async () => {
    const view = mount('dialog')
    view.open()
    view.fill()
    await view.submit()
    await flush()
    expect(calls.changePassword).toHaveBeenCalledOnce()
    expect(view.dialog().modelValue).toBe(false)
    expect(view.form).toEqual({ oldPassword: '', newPassword: '', confirmPassword: '' })
  })

  it('reports a rejected password without claiming success or closing the dialog', async () => {
    const view = mount('dialog')
    calls.changePassword.mockRejectedValueOnce({ response: { data: { msg: '旧密码不正确' } } })
    view.open()
    view.fill()
    await view.submit()
    await flush()

    expect(calls.showError).toHaveBeenCalledWith('旧密码不正确')
    expect(calls.showSuccess).not.toHaveBeenCalled()
    expect(view.dialog().modelValue).toBe(true)
    expect(view.form.oldPassword).toBe(credentials.oldPassword)
  })

  it('clears credentials and skips writing when validation completes after unmount', async () => {
    const view = mount('dialog')
    view.open()
    view.fill()
    const validation = deferred()
    calls.validate.mockReturnValueOnce(validation.promise)
    const submit = view.submit()
    view.unmount()
    validation.resolve(true)
    await submit

    expect(view.form).toEqual({ oldPassword: '', newPassword: '', confirmPassword: '' })
    expect(calls.changePassword).not.toHaveBeenCalled()
  })
})
