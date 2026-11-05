import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import {
  compileClientComponent,
  createSlotStub,
  findNode,
  findNodes
} from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'

const pin = `SHA256:${'A'.repeat(43)}`
const savedProfile = (overrides = {}) => ({
  profileId: 'profile-a',
  version: 1,
  name: 'Build',
  host: 'ssh.internal',
  port: 22,
  username: 'ops',
  authType: 'password',
  fingerprint: pin,
  hasPassword: true,
  hasPrivateKey: false,
  hasPassphrase: false,
  ...overrides
})
const apps = []
afterEach(() => apps.splice(0).forEach((app) => app.unmount()))
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  await nextTick()
}
const text = (node) => (node.type === 'comment' ? '' : node.text + node.children.map(text).join(''))

async function mount(initialProfiles = []) {
  const rows = new Map(initialProfiles.map((row) => [row.profileId, row]))
  const snapshots = []
  const get = vi.fn(async (_session, id) => ({ data: { ...rows.get(id) } }))
  const save = vi.fn(async (params) => {
    snapshots.push({ ...params })
    const old = rows.get(params.profileId)
    const row = savedProfile({
      profileId: params.profileId || 'profile-new',
      version: old ? old.version + 1 : 1,
      name: params.name,
      host: params.host,
      port: params.port,
      username: params.username,
      authType: params.authType,
      hasPassword: params.authType === 'password',
      hasPrivateKey: params.authType === 'privateKey',
      hasPassphrase:
        params.authType === 'privateKey' &&
        (params.passphrase === '' ? false : !!params.passphrase || old?.hasPassphrase === true),
      fingerprint:
        old && old.host === params.host && old.port === params.port ? old.fingerprint : ''
    })
    rows.set(row.profileId, row)
    return { data: row }
  })
  const connect = vi.fn()
  const Dialog = compileClientComponent(new URL('./SshProfileDialog.vue', import.meta.url), {
    '@/composables/useDialogVisible.js': { useDialogVisible },
    '@/services/api/ssh-terminal.js': {
      getSshProfileApi: get,
      saveSshProfileApi: save
    }
  })
  const props = reactive({
    modelValue: true,
    sessionId: 'parent',
    profileId: initialProfiles[0]?.profileId || '',
    onSaved: vi.fn(),
    onConnect: connect,
    'onUpdate:modelValue': (value) => {
      props.modelValue = value
    }
  })
  const renderer = createTestRenderer(),
    app = renderer.createApp({ render: () => h(Dialog, props) })
  for (const name of [
    'ElForm',
    'ElFormItem',
    'ElInput',
    'ElInputNumber',
    'ElRadioGroup',
    'ElRadioButton',
    'ElCheckbox',
    'ElAlert',
    'ElButton'
  ])
    app.component(name, createSlotStub(name))
  app.component('ElDialog', createSlotStub('ElDialog', ['default', 'footer']))
  app.mount(renderer.root)
  apps.push(app)
  await flush()
  const nodes = (predicate) => findNodes(renderer.root, predicate)
  const field = (label, type = 'ElInput') =>
    findNode(nodes((n) => n.type === 'ElFormItem' && n.props.label === label)[0], type)
  const set = async (label, value, type) => {
    field(label, type).props['onUpdate:modelValue'](value)
    await nextTick()
  }
  const button = (label) => nodes((n) => n.type === 'ElButton' && text(n).trim() === label)[0]
  const action = async (label) => {
    await button(label).props.onClick()
    await flush()
  }
  const fill = async () => {
    await set('主机地址', ' ssh.internal ')
    await set('用户名', ' ops ')
    await set('密码', 'request-only')
  }
  return {
    app,
    renderer,
    props,
    snapshots,
    get,
    save,
    connect,
    nodes,
    field,
    set,
    button,
    action,
    fill
  }
}

describe('SSH connection editor dialog', () => {
  it('uses the centered shared dialog shell with guarded closing and footer actions', async () => {
    const view = await mount()
    const dialog = view.nodes(n => n.type === 'ElDialog')[0]
    expect(dialog.props).toMatchObject({
      title: '新建 SSH 连接',
      width: '520px',
      class: 'workbench-dialog ssh-profile-dialog',
      'align-center': '',
      'append-to-body': '',
      'close-on-click-modal': false
    })
    expect(view.nodes(n => n.type === 'ElDrawer')).toHaveLength(0)
    expect(view.button('保存')).toBeDefined()
    expect(view.button('保存并连接')).toBeDefined()
    expect(text(view.renderer.root)).toContain('配置随 Agent 权限共享')
    expect(text(view.renderer.root)).not.toContain('仅当前用户可用')
  })
  it('creates a profile without connecting and clears submitted secrets', async () => {
    const view = await mount()
    await view.action('保存')
    expect(view.save).not.toHaveBeenCalled()
    await view.fill()
    await view.action('保存')
    expect(view.snapshots[0]).toMatchObject({
      sessionId: 'parent',
      host: 'ssh.internal',
      username: 'ops',
      password: 'request-only'
    })
    expect(view.connect).not.toHaveBeenCalled()
    expect(view.props.onSaved).toHaveBeenCalledOnce()
    expect(view.props.modelValue).toBe(false)
    expect(view.field('密码').props.modelValue).toBe('')
    expect(view.save.mock.calls[0][0].password).toBe('')
  })
  it('loads only selected metadata and retains a hidden saved password when left blank', async () => {
    const view = await mount([savedProfile()])
    expect(view.get).toHaveBeenCalledExactlyOnceWith(
      'parent',
      'profile-a',
      expect.any(globalThis.AbortSignal)
    )
    expect(view.field('密码').props.modelValue).toBe('')
    expect(view.field('密码').props.placeholder).toContain('已保存')
    await view.set('连接名称', 'Renamed')
    await view.action('保存')
    expect(view.snapshots[0]).toMatchObject({ profileId: 'profile-a', version: 1, name: 'Renamed' })
    expect(view.snapshots[0]).not.toHaveProperty('password')
    expect(view.snapshots[0]).not.toHaveProperty('privateKey')
  })
  it('save-and-connect emits metadata, not plaintext credentials or network work from the dialog', async () => {
    const view = await mount()
    await view.fill()
    await view.action('保存并连接')
    expect(view.connect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ profileId: 'profile-new', version: 1 })
    )
    for (const secret of ['password', 'privateKey', 'passphrase'])
      expect(view.connect.mock.calls[0][0]).not.toHaveProperty(secret)
    expect(view.props.modelValue).toBe(false)
  })
  it('keeps private keys hidden and supports explicit saved-passphrase removal', async () => {
    const view = await mount([
      savedProfile({
        authType: 'privateKey',
        hasPassword: false,
        hasPrivateKey: true,
        hasPassphrase: true
      })
    ])
    expect(view.field('私钥内容').props.modelValue).toBe('')
    view.nodes((n) => n.type === 'ElCheckbox')[0].props['onUpdate:modelValue'](true)
    await nextTick()
    await view.action('保存')
    expect(view.snapshots[0]).toMatchObject({ passphrase: '', authType: 'privateKey' })
    expect(view.snapshots[0]).not.toHaveProperty('privateKey')
  })
  it('requires replacement credentials after switching authentication method', async () => {
    const view = await mount([savedProfile()])
    await view.set('认证方式', 'privateKey', 'ElRadioGroup')
    await view.action('保存')
    expect(view.save).not.toHaveBeenCalled()
    await view.set('私钥内容', 'fixture-key')
    await view.action('保存')
    expect(view.snapshots[0]).toMatchObject({ privateKey: 'fixture-key', authType: 'privateKey' })
    expect(view.snapshots[0]).not.toHaveProperty('password')
  })
  it('coalesces save clicks and keeps errors editable without connecting', async () => {
    const view = await mount(),
      pending = deferred()
    view.save.mockReturnValueOnce(pending.promise)
    await view.fill()
    const saving = view.button('保存').props.onClick()
    await view.button('保存并连接').props.onClick()
    expect(view.save).toHaveBeenCalledTimes(1)
    pending.reject(new Error('version conflict'))
    await saving
    await flush()
    expect(view.nodes((n) => n.type === 'ElAlert')[0].props.title).toBe('version conflict')
    expect(view.props.modelValue).toBe(true)
    expect(view.connect).not.toHaveBeenCalled()
  })
  it('drops stale reads on close and clears pending secrets on unmount', async () => {
    const view = await mount(),
      pending = deferred()
    view.get.mockReturnValueOnce(pending.promise)
    view.props.profileId = 'later'
    await nextTick()
    const signal = view.get.mock.calls[0][2]
    view.props.modelValue = false
    await nextTick()
    pending.resolve({ data: savedProfile() })
    await flush()
    expect(signal.aborted).toBe(true)
    expect(view.field('主机地址').props.modelValue).toBe('')
    view.props.profileId = ''
    view.props.modelValue = true
    await flush()
    await view.fill()
    const savePending = deferred()
    view.save.mockReturnValueOnce(savePending.promise)
    const saving = view.button('保存并连接').props.onClick()
    const draft = view.save.mock.calls[0][0]
    view.app.unmount()
    expect(draft.password).toBe('')
    savePending.resolve({ data: savedProfile() })
    await saving
    expect(view.connect).not.toHaveBeenCalled()
  })
})
