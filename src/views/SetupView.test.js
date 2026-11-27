import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { createPasswordMatchValidator, createPasswordRules } from '@/utils/formUtils.js'
import { deferred } from '@/test-support/deferred.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { authPageTarget } from '@/routerGuards.js'

describe('first-deployment setup page', () => {
  const apps = []
  afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

  const mount = async (redirect) => {
    const initialize = vi.fn().mockResolvedValue({})
    const required = ref(true)
    const authFetched = ref(true)
    const fetchAuth = vi.fn(async () => { required.value = false })
    const replace = vi.fn().mockResolvedValue(undefined)
    const validate = vi.fn().mockResolvedValue(true)
    const showError = vi.fn(), showSuccess = vi.fn()
    const View = compileClientComponent(new URL('./SetupView.vue', import.meta.url), {
      'vue-router': { useRouter: () => ({ replace }), useRoute: () => ({ query: { redirect } }) },
      '@/constants/app.js': { ROUTE_PATHS },
      '@/composables/useAuth.js': { useAuth: () => ({
        fetchAuth, authFetched, initializationRequired: required, passwordMinLength: ref(12), passwordMaxLength: ref(256)
      }) },
      '@/services/api/auth.js': { initializeSystemApi: initialize },
      '@/routerGuards.js': { authPageTarget },
      '@/utils/formUtils.js': { createPasswordMatchValidator, createPasswordRules, validateForm: validate },
      '@/utils/messageUtils.js': { showError, showSuccess }
    })
    const renderer = createTestRenderer()
    const app = renderer.createApp(View)
    app.component('ElForm', createSlotStub('form-fixture'))
    app.component('ElFormItem', createSlotStub('item'))
    app.component('ElInput', { render: () => null })
    app.component('ElButton', createSlotStub('button'))
    app.mount(renderer.root)
    apps.push(app)
    await nextTick()
    const form = findNode(renderer.root, 'form-fixture').props
    const submit = () => {
      const formNode = findNode(renderer.root, 'form-fixture')
      if (formNode) return formNode.props.onSubmit({ preventDefault() {} })
      return findNode(renderer.root, 'button').props.onClick()
    }
    form.model.password = ' chosen-fixture-password '
    form.model.confirmPassword = ' chosen-fixture-password '
    const unmount = () => { app.unmount(); apps.splice(apps.indexOf(app), 1) }
    return { initialize, fetchAuth, replace, validate, showError, showSuccess, authFetched,
      form, submit, renderer, unmount }
  }

  it('uses the server policy, submits exact values once and clears them before returning to login', async () => {
    const view = await mount()
    expect(findNode(view.renderer.root, 'button').props['native-type']).toBe('submit')
    expect(view.form.onKeyup).toBeUndefined()
    expect(view.form.rules.password[1]).toMatchObject({ min: 12, max: 256 })
    const callback = vi.fn()
    view.form.rules.confirmPassword[1].validator({}, 'chosen-fixture-password', callback)
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error)

    const response = deferred()
    view.initialize.mockReturnValue(response.promise)
    const pending = view.submit()
    await nextTick()
    await view.submit()
    expect(view.initialize).toHaveBeenCalledExactlyOnceWith({
      password: ' chosen-fixture-password ', confirmPassword: ' chosen-fixture-password '
    })
    response.resolve({})
    await pending
    expect(view.form.model).toEqual({ password: '', confirmPassword: '' })
    expect(view.fetchAuth).toHaveBeenCalledWith({ force: true })
    expect(view.replace).toHaveBeenCalledWith({ path: ROUTE_PATHS.login })
    expect(view.showSuccess).toHaveBeenCalledOnce()
  })

  it('does not send an invalid form', async () => {
    const view = await mount()
    view.validate.mockResolvedValue(false)
    await view.submit()
    expect(view.initialize).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
  })

  it('reopens the form after a network failure only if a fresh status says setup is required', async () => {
    const view = await mount()
    view.initialize.mockRejectedValue(new Error('network-fixture'))
    view.fetchAuth.mockResolvedValue(null)
    await view.submit()
    expect(view.fetchAuth).toHaveBeenCalledOnce()
    expect(view.showError).toHaveBeenCalledWith('系统仍待初始化，请重试提交')
    expect(view.form.model.password).toBe(' chosen-fixture-password ')
    expect(view.replace).not.toHaveBeenCalled()
    await nextTick()
    expect(findNode(view.renderer.root, 'button').props.loading).toBe(false)
  })

  it.each([
    ['the response is lost', new Error('connection lost')],
    ['another browser finished setup', { response: { status: 409 } }]
  ])('preserves the login destination when %s and setup is already complete', async (_, failure) => {
    const redirect = '/admin?tab=statistics#latest'
    const view = await mount(redirect)
    view.initialize.mockRejectedValue(failure)
    await view.submit()

    expect(view.initialize).toHaveBeenCalledOnce()
    expect(view.fetchAuth).toHaveBeenCalledExactlyOnceWith({ force: true })
    expect(view.replace).toHaveBeenCalledExactlyOnceWith({ path: ROUTE_PATHS.login, query: { redirect } })
    expect(view.form.model).toEqual({ password: '', confirmPassword: '' })
    expect(view.showSuccess).not.toHaveBeenCalled()
  })

  it('keeps an acknowledged submission read-only while the server still reports setup required', async () => {
    const view = await mount()
    view.fetchAuth.mockResolvedValueOnce(null)
    await view.submit()
    await nextTick()

    expect(findNode(view.renderer.root, 'form-fixture')).toBeNull()
    expect(view.replace).not.toHaveBeenCalled()
    await view.submit()
    expect(view.initialize).toHaveBeenCalledOnce()
    expect(view.fetchAuth).toHaveBeenCalledTimes(2)
    expect(view.replace).toHaveBeenCalledWith({ path: ROUTE_PATHS.login })
  })

  it('keeps explicit server validation failures on the form without checking status', async () => {
    const view = await mount()
    view.initialize.mockRejectedValue({ response: { status: 400, data: { msg: '密码不符合策略' } } })
    await view.submit()
    expect(view.fetchAuth).not.toHaveBeenCalled()
    expect(view.showError).toHaveBeenCalledWith('密码不符合策略')
    expect(view.form.model.password).toBe(' chosen-fixture-password ')
  })

  it.each(['acknowledged', 'unconfirmed'])('recovers status without resubmitting an %s setup request', async outcome => {
    const redirect = '/admin?tab=statistics'
    const view = await mount(redirect)
    if (outcome === 'unconfirmed') view.initialize.mockRejectedValue(new Error('connection lost'))
    view.fetchAuth.mockImplementation(async () => { view.authFetched.value = false })

    await view.submit()
    expect(view.initialize).toHaveBeenCalledOnce()
    expect(view.replace).toHaveBeenCalledExactlyOnceWith({ path: ROUTE_PATHS.startup, query: { redirect } })
    expect(view.form.model).toEqual({ password: '', confirmPassword: '' })
    expect(view.showError).not.toHaveBeenCalled()
    expect(view.showSuccess).toHaveBeenCalledTimes(outcome === 'acknowledged' ? 1 : 0)
  })

  it('clears the form on unmount and does not submit if validation completes afterwards', async () => {
    const view = await mount()
    const validation = deferred()
    view.validate.mockReturnValue(validation.promise)
    const submit = view.submit()
    view.unmount()
    validation.resolve(true)
    await submit
    expect(view.form.model).toEqual({ password: '', confirmPassword: '' })
    expect(view.initialize).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
  })
})
