/* eslint-disable vue/one-component-per-file -- Small Element Plus fixtures exercise the current password workflow. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { compileClientComponent, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { AUTH_FIELD_LIMITS, ROUTE_PATHS } from '@/constants/app.js'
import { createPasswordRules, createPasswordMatchValidator } from '@/utils/formUtils.js'
import { icons } from '@/utils/icons.js'

describe('required password update page', () => {
  const apps = []
  afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

  const mount = () => {
    const changePassword = vi.fn().mockResolvedValue({})
    const fetchAuth = vi.fn().mockResolvedValue({ passwordChangeRequired: false })
    const replace = vi.fn().mockResolvedValue(undefined)
    const validate = vi.fn().mockResolvedValue(true)
    const View = compileClientComponent(new URL('./ChangePasswordView.vue', import.meta.url), {
      'vue-router': { useRoute: () => ({ query: {} }), useRouter: () => ({ replace }) },
      '@/constants/app.js': { AUTH_FIELD_LIMITS, ROUTE_PATHS },
      '@/composables/useAuth.js': { useAuth: () => ({ fetchAuth, resetAuth: vi.fn() }) },
      '@/services/api/auth.js': { changePasswordApi: changePassword, logoutApi: vi.fn() },
      '@/utils/formUtils.js': { createPasswordRules, createPasswordMatchValidator, validateForm: validate },
      '@/utils/icons.js': { icons },
      '@/utils/messageUtils.js': { showError: vi.fn(), showSuccess: vi.fn() }
    })
    const renderer = createTestRenderer()
    const app = renderer.createApp(View)
    app.component('ElForm', defineComponent({
      props: { model: Object, rules: Object },
      setup: (props, { slots }) => () => h('form-fixture', { model: props.model, rules: props.rules }, slots.default())
    }))
    app.component('ElFormItem', { render() { return h('item', this.$slots.default?.()) } })
    app.component('ElInput', { render() { return h('input', this.$attrs) } })
    app.component('ElButton', { render() { return h('button', this.$attrs, this.$slots.default?.()) } })
    for (const name of ['ElIcon', 'Icon']) app.component(name, { render: () => null })
    app.mount(renderer.root)
    apps.push(app)
    const form = findNode(renderer.root, 'form-fixture').props.model
    return { form, changePassword, fetchAuth, replace, validate, root: renderer.root,
      submit: () => findNode(renderer.root, 'button').props.onClick() }
  }

  it('describes an account password update rather than deployment bootstrap', () => {
    const view = mount()
    expect(findNode(view.root, 'h1').text).toBe('请先更新密码')
    expect(findNode(view.root, 'input').props.placeholder).toBe('请输入当前密码')
  })

  it('keeps the current-user password update and authentication refresh workflow', async () => {
    const view = mount()
    view.form.oldPassword = ' current-fixture-password '
    view.form.newPassword = ' new-fixture-password '
    view.form.confirmPassword = view.form.newPassword
    await view.submit()
    expect(view.changePassword).toHaveBeenCalledWith({
      oldPassword: ' current-fixture-password ', newPassword: ' new-fixture-password '
    })
    expect(view.fetchAuth).toHaveBeenCalledWith({ force: true })
    expect(view.replace).toHaveBeenCalledWith(ROUTE_PATHS.main)
  })

  it('does not submit when the current password form is invalid', async () => {
    const view = mount()
    view.validate.mockResolvedValue(false)
    await view.submit()
    expect(view.changePassword).not.toHaveBeenCalled()
    expect(view.replace).not.toHaveBeenCalled()
  })
})
