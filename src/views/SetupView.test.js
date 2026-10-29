/* eslint-disable vue/one-component-per-file -- Lightweight Element Plus form fixtures. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { createPasswordMatchValidator } from '@/utils/formUtils.js'
import { deferred } from '@/test-support/deferred.js'
import { ROUTE_PATHS } from '@/constants/app.js'

describe('first-deployment setup page', () => {
  const apps = []
  afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

  const mount = async () => {
    const initialize = vi.fn().mockResolvedValue({})
    const fetchAuth = vi.fn().mockResolvedValue(null)
    const replace = vi.fn().mockResolvedValue(undefined)
    const validate = vi.fn().mockResolvedValue(true)
    const showError = vi.fn(), showSuccess = vi.fn()
    const required = ref(true)
    const View = compileClientComponent(new URL('./SetupView.vue', import.meta.url), {
      'vue-router': { useRouter: () => ({ replace }) },
      '@/constants/app.js': { ROUTE_PATHS },
      '@/composables/useAuth.js': { useAuth: () => ({
        fetchAuth, initializationRequired: required, passwordMinLength: ref(12), passwordMaxLength: ref(256)
      }) },
      '@/services/api/auth.js': { initializeSystemApi: initialize },
      '@/utils/formUtils.js': { createPasswordMatchValidator, validateForm: validate },
      '@/utils/messageUtils.js': { showError, showSuccess }
    })
    const renderer = createTestRenderer()
    const app = renderer.createApp(View)
    app.component('ElForm', defineComponent({
      props: { model: Object, rules: Object },
      setup: (props, { slots }) => () => h('form-fixture', { model: props.model, rules: props.rules }, slots.default())
    }))
    app.component('ElFormItem', { render() { return h('item', this.$slots.default?.()) } })
    app.component('ElInput', { render: () => null })
    app.component('ElButton', { render() { return h('button', this.$attrs, this.$slots.default?.()) } })
    app.mount(renderer.root)
    apps.push(app)
    await nextTick()
    const form = findNode(renderer.root, 'form-fixture').props
    const submit = () => findNode(renderer.root, 'button').props.onClick()
    form.model.password = ' chosen-fixture-password '
    form.model.confirmPassword = ' chosen-fixture-password '
    return { initialize, fetchAuth, replace, validate, showError, showSuccess, required, form, submit, renderer }
  }

  it('uses the server password bounds and requires an exact confirmation', async () => {
    const view = await mount()
    expect(view.form.rules.password[1]).toMatchObject({ min: 12, max: 256 })
    const callback = vi.fn()
    view.form.rules.confirmPassword[1].validator({}, 'chosen-fixture-password', callback)
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('submits both exact values, clears them, refreshes status and returns to login', async () => {
    const view = await mount()
    await view.submit()
    expect(view.initialize).toHaveBeenCalledWith({
      password: ' chosen-fixture-password ', confirmPassword: ' chosen-fixture-password '
    })
    expect(view.form.model).toEqual({ password: '', confirmPassword: '' })
    expect(view.fetchAuth).toHaveBeenCalledWith({ force: true })
    expect(view.replace).toHaveBeenCalledWith(ROUTE_PATHS.login)
    expect(view.showSuccess).toHaveBeenCalledOnce()
  })

  it('does not send an invalid form', async () => {
    const view = await mount()
    view.validate.mockResolvedValue(false)
    await view.submit()
    expect(view.initialize).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
  })

  it('blocks repeated submissions while initialization is pending', async () => {
    const view = await mount()
    const response = deferred()
    view.initialize.mockReturnValue(response.promise)
    const first = view.submit()
    await nextTick()
    await view.submit()
    expect(view.initialize).toHaveBeenCalledOnce()
    response.resolve({})
    await first
  })

  it('keeps the form retryable after a network failure', async () => {
    const view = await mount()
    view.initialize.mockRejectedValue(new Error('network-fixture'))
    await view.submit()
    expect(view.showError).toHaveBeenCalledWith('network-fixture')
    expect(view.form.model.password).toBe(' chosen-fixture-password ')
    expect(view.replace).not.toHaveBeenCalled()
    await nextTick()
    expect(findNode(view.renderer.root, 'button').props.loading).toBe(false)
  })

  it('refreshes stale setup state if another browser has completed initialization', async () => {
    const view = await mount()
    view.initialize.mockRejectedValue({ response: { status: 409, data: { msg: 'already initialized' } } })
    view.fetchAuth.mockImplementation(async () => { view.required.value = false })
    await view.submit()
    expect(view.fetchAuth).toHaveBeenCalledWith({ force: true })
    expect(view.replace).toHaveBeenCalledWith(ROUTE_PATHS.login)
  })
})
