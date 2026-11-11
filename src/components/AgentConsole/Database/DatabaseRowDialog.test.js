/* eslint-disable vue/one-component-per-file -- Scoped table fixtures exercise both row-dialog modes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, nextTick, provide, reactive } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { executeRequest } from '@/utils/apiUtils.js'
import * as database from '@/utils/database.js'
import * as tableModel from './database-table-model.js'
import { formatDatabaseError } from '@/utils/databaseError.js'

const messages = vi.hoisted(() => Object.fromEntries(
  ['showError', 'showInfo', 'showSuccess', 'showWarning'].map(name => [name, vi.fn()])
))
vi.mock('@/utils/messageUtils.js', () => messages)
const sqlEngine = { insertRow: vi.fn(), updateRows: vi.fn() }
const Dialog = compileClientComponent(new URL('./DatabaseRowDialog.vue', import.meta.url), {
  '@iconify/vue': { Icon: createSlotStub('icon') },
  './SqlEngine.js': { default: sqlEngine },
  '@/utils/icons.js': { icons: {} },
  '@/utils/apiUtils.js': { executeRequest },
  '@/utils/database.js': database,
  './database-table-model.js': tableModel,
  '@/utils/messageUtils.js': messages,
  '@/utils/databaseError.js': { formatDatabaseError }
})
const columns = [
  { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true },
  { name: 'enabled', type: 'BOOLEAN', nullable: false },
  { name: 'note', type: 'VARCHAR', nullable: true }
]
const original = { id: '9223372036854775807', enabled: true, note: 'old' }
const apps = []
beforeEach(() => vi.resetAllMocks())
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

async function mount(editing = false, overrides = {}) {
  const renderer = createTestRenderer()
  const props = reactive({ visible: true, editing, sessionId: 'session', connection: { dialect: 'mysql' },
    objectRef: { database: 'inventory', name: 'records' }, tableColumns: columns,
    rowData: { ...original }, originalRowData: { ...original }, ...overrides })
  const success = vi.fn(), cancel = vi.fn()
  const app = renderer.createApp(() => h(Dialog, { ...props, onSuccess: success, onCancel: cancel,
    'onUpdate:visible': value => { props.visible = value } }))
  app.component('ElTable', defineComponent({
    props: { data: { type: Array, default: () => [] } },
    setup(table, { slots }) {
      provide('rows', computed(() => table.data))
      return () => h('row-table', {}, slots.default?.())
    }
  }))
  app.component('ElTableColumn', defineComponent({
    setup(_props, { slots }) {
      const rows = inject('rows')
      return () => h('row-column', {}, rows.value.flatMap(row => slots.default?.({ row }) || []))
    }
  }))
  for (const [name, node] of Object.entries({ ElDialog: 'dialog', ElButton: 'button',
    ElIcon: 'icon', ElTag: 'tag', ElOption: 'option', ElSelect: 'input', ElInput: 'input',
    ElInputNumber: 'input', ElDatePicker: 'input' })) app.component(name, createSlotStub(node))
  apps.push(app)
  app.mount(renderer.root)
  await nextTick()
  const controls = () => findNodes(renderer.root, node => node.type === 'input')
  const button = name => findNodes(renderer.root, node => node.props.class === `${name}-btn`)[0]
  return { props, success, cancel, controls, button,
    set: (index, value) => controls()[index].props['onUpdate:modelValue'](value),
    submit: () => button('submit').props.onClick(),
    dialog: () => findNode(renderer.root, 'dialog') }
}

describe('database row dialog modes', () => {
  it('validates inserts while retaining zero and false values, then resets after success', async () => {
    const view = await mount()
    expect(view.dialog().props.title).toBe('新增数据')
    expect(view.controls().map(node => node.props.modelValue)).toEqual([undefined, undefined, undefined])
    await view.submit()
    expect(sqlEngine.insertRow).not.toHaveBeenCalled()
    expect(messages.showWarning).toHaveBeenCalledOnce()
    view.set(0, 0)
    view.set(1, false)
    view.set(2, null)
    const pending = deferred()
    sqlEngine.insertRow.mockReturnValue(pending.promise)
    const request = view.submit()
    await nextTick()
    expect(view.button('submit').props.loading).toBe(true)
    expect(sqlEngine.insertRow).toHaveBeenCalledWith({ sessionId: 'session', connection: view.props.connection,
      objectRef: view.props.objectRef, row: { id: 0, enabled: false, note: null } })
    pending.resolve({})
    await request
    await nextTick()
    expect(view.props.visible).toBe(false)
    expect(view.success).toHaveBeenCalledOnce()
    expect(view.controls().every(node => node.props.modelValue === undefined)).toBe(true)
    expect(view.button('submit').props.loading).toBe(false)
  })

  it('updates only changed fields using the original primary key, including primary-key edits', async () => {
    const view = await mount(true)
    expect(view.dialog().props.title).toBe('编辑数据')
    expect(view.controls().map(node => node.props.modelValue)).toEqual(Object.values(original))
    view.set(0, '9223372036854775806')
    view.set(2, 'changed')
    await view.submit()
    expect(sqlEngine.updateRows).toHaveBeenCalledWith({ sessionId: 'session', connection: view.props.connection,
      objectRef: view.props.objectRef, where: { type: 'pk', values: { id: original.id } },
      update: { id: '9223372036854775806', note: 'changed' } })
    expect(view.props.rowData).toEqual(original)
    expect(view.props.originalRowData).toEqual(original)
    expect(view.success).toHaveBeenCalledOnce()
  })

  it('closes unchanged edits without writing or emitting success', async () => {
    const view = await mount(true)
    await view.submit()
    expect(sqlEngine.updateRows).not.toHaveBeenCalled()
    expect(messages.showInfo).toHaveBeenCalledOnce()
    expect(view.props.visible).toBe(false)
    expect(view.success).not.toHaveBeenCalled()
  })

  it('keeps edits open when the original row is missing rather than issuing an unscoped update', async () => {
    const view = await mount(true, { originalRowData: {} })
    view.set(2, 'changed')
    await view.submit()
    expect(sqlEngine.updateRows).not.toHaveBeenCalled()
    expect(messages.showError).toHaveBeenCalledOnce()
    expect(view.props.visible).toBe(true)
    expect(view.success).not.toHaveBeenCalled()
  })

  it.each([false, true])('retains drafts and clears submission state after a write error (editing=%s)', async editing => {
    const view = await mount(editing)
    view.set(0, original.id)
    view.set(1, false)
    view.set(2, 'draft')
    const error = new Error('write failed')
    sqlEngine[editing ? 'updateRows' : 'insertRow'].mockRejectedValue(error)
    if (editing) await view.submit()
    else await expect(view.submit()).rejects.toBe(error)
    await nextTick()
    expect(view.props.visible).toBe(true)
    expect(view.controls()[2].props.modelValue).toBe('draft')
    expect(view.button('submit').props.loading).toBe(false)
    expect(view.success).not.toHaveBeenCalled()
    expect(messages.showError).toHaveBeenCalledOnce()
  })

  it.each([false, true])('resets on cancellation and reopens with mode-specific data (editing=%s)', async editing => {
    const view = await mount(editing)
    view.set(2, 'discard')
    view.button('cancel').props.onClick()
    await nextTick()
    expect(view.cancel).toHaveBeenCalledOnce()
    expect(view.props.visible).toBe(false)
    expect(view.controls().every(node => node.props.modelValue === undefined)).toBe(true)
    view.props.rowData = { ...original, note: 'refreshed' }
    view.props.visible = true
    await nextTick()
    expect(view.controls()[2].props.modelValue).toBe(editing ? 'refreshed' : undefined)
    expect(sqlEngine.insertRow).not.toHaveBeenCalled()
    expect(sqlEngine.updateRows).not.toHaveBeenCalled()
  })
})
