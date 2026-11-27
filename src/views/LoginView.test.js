import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import * as constants from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { isCurrentSession, resetSessionState, sessionGeneration } from '@/services/sessionLifecycle.js'
import pkg from '../../package.json'
import { normalizeAuthRedirect } from '@/routerGuards.js'

const { h, nextTick } = Vue

const apps = []
beforeEach(() => { vi.useFakeTimers(); resetSessionState() })
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  vi.clearAllTimers()
  vi.useRealTimers()
})

function mount(query = {}) {
  const login = vi.fn().mockResolvedValue({})
  const fetchAuth = vi.fn().mockResolvedValue({ isLoggedIn: true, privilege: 'normal' })
  const resetAuth = vi.fn(resetSessionState)
  const validate = vi.fn().mockResolvedValue(true)
  const replace = vi.fn().mockResolvedValue(undefined)
  const push = vi.fn().mockResolvedValue(undefined)
  const showSuccess = vi.fn()
  const showError = vi.fn()
  const View = compileClientComponent(new URL('./LoginView.vue', import.meta.url), {
    // The in-memory host keeps compiler-hoisted static HTML as a leaf node.
    vue: { ...Vue, createStaticVNode: content => h('static-fixture', content) },
    'vue-router': { useRoute: () => ({ query }), useRouter: () => ({ replace, push }) },
    '../../package.json': pkg,
    '@/constants/app.js': constants,
    '@/routerGuards.js': { normalizeAuthRedirect },
    '@/utils/icons.js': { icons },
    '@/utils/formUtils.js': { validateForm: validate },
    '@/services/api/auth.js': { loginApi: login },
    '@/composables/useAuth.js': { useAuth: () => ({ fetchAuth, resetAuth }) },
    '@/utils/messageUtils.js': { showError, showSuccess },
    '@/services/sessionLifecycle.js': { isCurrentSession, sessionGeneration }
  })
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.component('ElForm', createSlotStub('form-fixture'))
  for (const name of ['ElFormItem', 'ElInput', 'ElButton', 'ElTag', 'ElIcon', 'Icon']) {
    app.component(name, createSlotStub(name))
  }
  apps.push(app)
  app.mount(renderer.root)
  const formNode = findNode(renderer.root, 'form-fixture')
  const form = formNode.props.model
  form.username = 'fixture-user'
  form.password = ' fixture-password '
  return { form, login, fetchAuth, resetAuth, validate, replace, push, showSuccess, showError,
    root: renderer.root, button: () => findNode(renderer.root, 'ElButton'),
    submit: (event = { preventDefault() {} }) => formNode.props.onSubmit(event),
    unmount: () => { app.unmount(); apps.splice(apps.indexOf(app), 1) } }
}

const flush = async () => { for (let i = 0; i < 8; i++) await nextTick() }

describe('login transition', () => {
  it('navigates immediately and keeps loading until navigation finishes before announcing success', async () => {
    const view = mount()
    expect(view.button().props['native-type']).toBe('submit')
    expect(view.button().props.onClick).toBeUndefined()
    expect(findNodes(view.root, node => node.type === 'ElInput').map(node => node.props.autocomplete))
      .toEqual(['username', 'current-password'])
    const navigation = deferred()
    view.replace.mockReturnValue(navigation.promise)
    const preventDefault = vi.fn()
    const submission = view.submit({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    await flush()
    expect(view.login).toHaveBeenCalledExactlyOnceWith({ username: 'fixture-user', password: ' fixture-password ' })
    expect(view.fetchAuth).toHaveBeenCalledExactlyOnceWith({ force: true })
    expect(view.replace).toHaveBeenCalledExactlyOnceWith('/main')
    expect(view.push).not.toHaveBeenCalled()
    expect(view.showSuccess).not.toHaveBeenCalled()
    expect(view.button().props.loading).toBe(true)
    expect(findNodes(view.root, node => node.type === 'ElInput').every(node => node.props.disabled)).toBe(true)
    await view.submit()
    expect(view.login).toHaveBeenCalledOnce()
    navigation.resolve()
    await submission
    await flush()
    expect(view.showSuccess).toHaveBeenCalledExactlyOnceWith('登录成功')
    expect(view.button().props.loading).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('prevents duplicate submits while validation is still pending', async () => {
    const view = mount()
    const validation = deferred()
    view.validate.mockReturnValue(validation.promise)
    const first = view.submit()
    const second = view.submit()
    await flush()
    expect(view.validate).toHaveBeenCalledOnce()
    validation.resolve(false)
    await Promise.all([first, second])
    expect(view.login).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
    expect(view.button().props.loading).toBe(false)
  })

  it('preserves credentials and displays a failed login even when the HTTP layer resets the session', async () => {
    const view = mount()
    view.login.mockImplementation(async () => {
      resetSessionState()
      throw { response: { data: { msg: '账号或密码错误' } } }
    })
    await view.submit()
    await flush()
    expect(view.showError).toHaveBeenCalledExactlyOnceWith('账号或密码错误')
    expect(view.form.password).toBe(' fixture-password ')
    expect(view.button().props.loading).toBe(false)
    expect(view.fetchAuth).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
  })

  it.each(['session-change', 'unmount'])('drops a late status result after %s', async action => {
    const view = mount()
    const status = deferred()
    view.fetchAuth.mockReturnValue(status.promise)
    const submission = view.submit()
    await flush()
    expect(view.fetchAuth).toHaveBeenCalledOnce()
    if (action === 'unmount') view.unmount()
    else resetSessionState()
    status.resolve({ isLoggedIn: true, privilege: 'normal' })
    await submission
    expect(view.replace).not.toHaveBeenCalled()
    expect(view.showSuccess).not.toHaveBeenCalled()
    expect(view.showError).not.toHaveBeenCalled()
  })

  it.each(['session-change', 'unmount'])('does not reset a newer session after a late login response and %s', async action => {
    const view = mount()
    const response = deferred()
    view.login.mockReturnValue(response.promise)
    const submission = view.submit()
    await flush()
    if (action === 'unmount') view.unmount()
    else resetSessionState()
    response.resolve({})
    await submission
    expect(view.resetAuth).not.toHaveBeenCalled()
    expect(view.fetchAuth).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
  })

  it('ends loading on navigation errors without announcing a successful transition', async () => {
    const view = mount()
    view.replace.mockRejectedValue(new Error('页面加载失败'))
    await view.submit()
    await flush()
    expect(view.showError).toHaveBeenCalledExactlyOnceWith('页面加载失败')
    expect(view.showSuccess).not.toHaveBeenCalled()
    expect(view.button().props.loading).toBe(false)
  })

  it('announces success after navigation unmounts the login page itself', async () => {
    const view = mount()
    view.replace.mockImplementation(async () => { view.unmount() })
    await view.submit()
    expect(view.showSuccess).toHaveBeenCalledExactlyOnceWith('登录成功')
    expect(view.showError).not.toHaveBeenCalled()
  })

  it('does not announce success when navigation is cancelled', async () => {
    const view = mount()
    view.replace.mockResolvedValue({ type: 8 })
    await view.submit()
    await flush()
    expect(view.showSuccess).not.toHaveBeenCalled()
    expect(view.showError).not.toHaveBeenCalled()
    expect(view.button().props.loading).toBe(false)
  })

  it.each([
    ['normal', '/admin?tab=users', '/main'],
    ['admin', '/admin?tab=users', '/admin?tab=users'],
    ['normal', '//example.invalid', '/main'],
    ['normal', '/startup', '/main'],
    ['normal', { redirect: '/main' }, '/main'],
    ['normal', ['/main?tab=agent'], '/main?tab=agent']
  ])('keeps redirect constraints for %s: %j', async (privilege, redirect, target) => {
    const view = mount({ redirect })
    view.fetchAuth.mockResolvedValue({ isLoggedIn: true, privilege })
    await view.submit()
    expect(view.replace).toHaveBeenCalledExactlyOnceWith(target)
  })
})
