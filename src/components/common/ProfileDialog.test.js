import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { handleError } from '@/utils/errorHandler.js'
import { validateForm } from '@/utils/formUtils.js'
import { icons } from '@/utils/icons.js'

const api = { getProfileApi: vi.fn(), updateProfileApi: vi.fn() }
const messages = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => messages)
const validate = vi.fn()
const initial = {
  userId: 'member', userName: 'Alice', email: 'alice@example.test', phone: '', remark: null, status: 1, accountRevision: 0
}
const View = compileClientComponent(new URL('./ProfileDialog.vue', import.meta.url), {
  '@iconify/vue': { Icon: { render: () => null } },
  '@/services/api/auth.js': api,
  '@/utils/errorHandler.js': { handleError },
  '@/utils/formUtils.js': { validateForm },
  '@/utils/icons.js': { icons },
  '@/utils/messageUtils.js': messages
})

const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const flush = async () => { for (let i = 0; i < 5; i++) await nextTick() }

function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.component('ElDialog', createSlotStub('ElDialog', ['default', 'footer']))
  app.component('ElForm', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots, expose }) {
      expose({ validate })
      return () => h('ProfileForm', attrs, slots.default?.())
    }
  }))
  for (const name of ['ElAvatar', 'ElTag', 'ElAlert', 'ElButton', 'ElFormItem', 'ElInput']) {
    app.component(name, createSlotStub(name))
  }
  const vm = app.mount(renderer.root)
  apps.push(app)
  return {
    open: vm.openProfileDialog,
    dialog: () => findNode(renderer.root, 'ElDialog').props,
    form: () => findNode(renderer.root, 'ProfileForm')?.props,
    error: () => findNode(renderer.root, 'ElAlert')?.props.title,
    button: (label) => findNodes(renderer.root, node => node.type === 'ElButton' && text(node) === label)[0].props
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  validate.mockResolvedValue(true)
  api.getProfileApi.mockResolvedValue({ data: initial })
  api.updateProfileApi.mockResolvedValue({ data: initial })
})

afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

it('hides the form while loading or failed and ignores the response to a closed dialog', async () => {
  const first = deferred()
  api.getProfileApi.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error('资料暂时不可用'))
  const view = mount()
  const pending = view.open()
  await view.open()
  await flush()
  expect(api.getProfileApi).toHaveBeenCalledOnce()
  expect(view.form()).toBeUndefined()
  expect(view.button('保存资料').disabled).toBe(true)
  await view.button('保存资料').onClick()
  expect(api.updateProfileApi).not.toHaveBeenCalled()

  view.dialog()['onUpdate:modelValue'](false)
  expect(api.getProfileApi.mock.calls[0][0].signal.aborted).toBe(true)
  await view.open()
  first.resolve({ data: { ...initial, email: 'outdated@example.test' } })
  await pending
  await flush()
  expect(view.dialog().modelValue).toBe(true)
  expect(view.error()).toBe('资料暂时不可用')
  expect(view.form()).toBeUndefined()

  await view.button('重新加载').onClick()
  await flush()
  expect(view.error()).toBeUndefined()
  expect(view.form().model.email).toBe(initial.email)
})

it('skips unchanged values and retains a failed draft for retry without duplicate saves', async () => {
  const view = mount()
  await view.open()
  await flush()
  view.form().model.email = ' alice@example.test '
  await flush()
  expect(view.button('保存资料').disabled).toBe(true)
  await view.button('保存资料').onClick()
  expect(api.updateProfileApi).not.toHaveBeenCalled()

  view.form().model.remark = '  draft  '
  await flush()
  api.updateProfileApi.mockRejectedValueOnce(new Error('暂时保存失败'))
  const validation = deferred()
  validate.mockReturnValueOnce(validation.promise)
  const write = view.button('保存资料').onClick()
  await view.button('保存资料').onClick()
  await flush()
  expect(validate).toHaveBeenCalledOnce()
  expect(view.form().disabled).toBe(true)
  expect(view.dialog()['close-on-press-escape']).toBe(false)
  validation.resolve(true)
  await write
  await flush()
  const payload = { email: initial.email, phone: '', remark: 'draft', accountRevision: 0 }
  expect(api.updateProfileApi).toHaveBeenCalledExactlyOnceWith(payload)
  expect(view.error()).toBe('暂时保存失败')
  expect(view.dialog().modelValue).toBe(true)
  expect(view.form().model.remark).toBe('draft')
  expect(messages.showSuccess).not.toHaveBeenCalled()

  await view.button('保存资料').onClick()
  await flush()
  expect(api.updateProfileApi.mock.calls).toEqual([[payload], [payload]])
  expect(messages.showSuccess).toHaveBeenCalledExactlyOnceWith('个人资料已更新')
  expect(view.dialog().modelValue).toBe(false)
})

it('requires a fresh version after a conflict and keeps only the edited fields in the draft', async () => {
  const view = mount()
  await view.open()
  await flush()
  view.form().model.remark = 'My draft'
  api.updateProfileApi.mockRejectedValueOnce({
    response: { status: 409, data: { code: 409, msg: '账号信息已变化' } }
  })
  const latest = { ...initial, email: 'latest@example.test', accountRevision: 1 }
  api.getProfileApi.mockResolvedValueOnce({ data: latest })
  await flush()

  await view.button('保存资料').onClick()
  expect(view.button('保存资料').disabled).toBe(true)
  expect(view.form().model.remark).toBe('My draft')
  expect(view.error()).toBe('账号信息已变化')

  await view.button('读取最新资料').onClick()
  expect(view.form().model).toMatchObject({ email: latest.email, remark: 'My draft' })
  expect(view.error()).toBeUndefined()
  expect(api.updateProfileApi).toHaveBeenCalledOnce()

  await view.button('保存资料').onClick()
  expect(api.updateProfileApi).toHaveBeenLastCalledWith({
    email: latest.email, phone: '', remark: 'My draft', accountRevision: 1
  })
})
