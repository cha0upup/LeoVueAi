import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'
import * as model from './auditManagerModel.js'
import { useAuditLogPage } from './useAuditLogPage.js'

const api = vi.hoisted(() => Object.fromEntries([
  'getAuditLogSummaryPageApi', 'getAuditLogDetailApi', 'cleanupAuditLogsApi', 'deleteAuditLogsApi',
  'deleteFilteredAuditLogsApi', 'getAuditLogOperationTypesApi', 'getAuditModeApi', 'updateAuditModeApi'
].map(name => [name, vi.fn()])))
const messages = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }))
vi.mock('@/services/api/admin.js', () => api)
vi.mock('@/utils/messageUtils.js', () => messages)
const confirmDelete = vi.fn()
const stub = (name, slots) => ({ default: createSlotStub(name, slots) })
const Details = compileClientComponent(new URL('./AuditLogDetailsDialog.vue', import.meta.url), {
  '@/utils/format.js': { formatDate },
  './auditManagerModel.js': model
})
const View = compileClientComponent(new URL('./AuditManager.vue', import.meta.url), {
  '@/components/common/PageHeader.vue': stub('PageHeader'),
  '@/components/Admin/shared/AdminToolbar.vue': stub('AdminToolbar', ['default', 'actions']),
  '@/components/common/StatsStrip.vue': stub('StatsStrip'),
  '@/components/Admin/shared/AdminWorkspacePanel.vue': stub('AdminWorkspacePanel', ['tags', 'actions', 'default']),
  '@/components/common/StatusIndicator.vue': stub('StatusIndicator'),
  './AuditCleanupDialog.vue': stub('AuditCleanupDialog'),
  './AuditLogDetailsDialog.vue': { default: Details },
  './auditManagerModel.js': model,
  './useAuditLogPage.js': { useAuditLogPage },
  '@/utils/icons.js': { icons },
  '@/utils/format.js': { formatDate },
  '@/utils/apiUtils.js': { executeRequest },
  '@/utils/errorHandler.js': { handleError },
  '@/utils/messageUtils.js': messages,
  '@/utils/confirmUtils.js': { confirmDelete },
  '@/services/api/admin.js': api
})
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const flush = async () => { for (let i = 0; i < 5; i++) await nextTick() }

async function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.directive('loading', {})
  for (const name of ['Icon', 'ElIcon', 'ElButton', 'ElInput', 'ElSelect', 'ElOption', 'ElDatePicker',
    'ElTag', 'ElRadioGroup', 'ElRadioButton', 'ElTable', 'ElPagination', 'ElAlert', 'ElAvatar',
    'ElDialog', 'ElDescriptions', 'ElDescriptionsItem']) {
    app.component(name, createSlotStub(name))
  }
  app.component('ElTableColumn', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () => h('ElTableColumn', attrs, attrs.label === '操作'
        ? ['a', 'b'].map(logId => slots.default({ row: { logId } })) : [])
    }
  }))
  app.mount(renderer.root)
  apps.push(app)
  await flush()
  const nodes = type => findNodes(renderer.root, node => node.type === type)
  return {
    button: label => nodes('ElButton').find(node => text(node) === label).props,
    openDetails: (row = 0) => nodes('ElButton').filter(node => text(node) === '详情')[row].props.onClick(),
    closeDetails: () => nodes('ElDialog')[0].props['onUpdate:modelValue'](false),
    detailsAlert: () => nodes('ElAlert')[0]?.props.title,
    editKeyword: value => nodes('ElInput')[0].props['onUpdate:modelValue'](value),
    selectRows: selection => nodes('ElTable')[0].props.onSelectionChange(selection),
    text: () => text(renderer.root)
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getAuditLogSummaryPageApi.mockResolvedValue({
    data: { logs: [{ logId: 'a' }], total: 3, successCount: 2, failedCount: 1 }
  })
  api.getAuditModeApi.mockResolvedValue({ data: { mode: 'on' } })
  api.getAuditLogOperationTypesApi.mockResolvedValue({ data: ['TEST'] })
  api.deleteFilteredAuditLogsApi.mockResolvedValue({ data: { deleted: 0 } })
  api.deleteAuditLogsApi.mockResolvedValue({ data: { deleted: 1 } })
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

it('keeps drafts out of refresh and filter deletion, then submits only the confirmed filter snapshot', async () => {
  const view = await mount()
  expect(api.getAuditLogSummaryPageApi).toHaveBeenCalledOnce()
  view.editKeyword('   ')
  await nextTick()
  expect(view.text()).not.toContain('筛选已编辑')
  expect(view.button('删除筛选').disabled).toBe(true)

  view.editKeyword(' first ')
  await nextTick()
  expect(view.button('删除筛选').disabled).toBe(true)
  expect(view.text()).toContain('筛选已编辑')
  await view.button('刷新').onClick()
  expect(api.getAuditLogSummaryPageApi.mock.lastCall[0]).not.toHaveProperty('keyword')
  await view.button('查询').onClick()
  await nextTick()
  expect(view.button('删除筛选').disabled).toBe(false)
  expect(view.text()).toContain('关键词: first')

  const confirmation = deferred()
  confirmDelete.mockReturnValue(confirmation.promise)
  const pending = view.button('删除筛选').onClick()
  expect(confirmDelete.mock.lastCall[0].message).toContain('最近查询为 3 条')
  await view.button('删除筛选').onClick()
  expect(confirmDelete).toHaveBeenCalledOnce()
  view.editKeyword('second')
  confirmation.resolve(true)
  await pending
  expect(api.deleteFilteredAuditLogsApi).toHaveBeenCalledWith({ keyword: 'first', confirm: 'DELETE' })
  expect(messages.showSuccess).toHaveBeenCalledWith('已删除 0 条日志')
})

it('uses the ids shown in the confirmation if selection changes while it is open', async () => {
  const view = await mount()
  view.selectRows([{ logId: 'a' }])
  await nextTick()
  const confirmation = deferred()
  confirmDelete.mockReturnValue(confirmation.promise)
  const pending = view.button('删除选中').onClick()
  view.selectRows([{ logId: 'different' }])
  confirmation.resolve(true)
  await pending
  expect(api.deleteAuditLogsApi).toHaveBeenCalledWith({ logIds: ['a'] })
})

it('retries the same audit record after failed or mismatched responses without reloading the list', async () => {
  const first = deferred()
  api.getAuditLogDetailApi.mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ data: { logId: 'b', responseMessage: '错误记录的正文' } })
    .mockResolvedValueOnce({ data: { logId: 'a', responseMessage: '详情已恢复' } })
  const view = await mount()

  const pending = view.openDetails()
  await flush()
  expect(view.text()).toContain('日志ID：a')
  expect(view.text()).toContain('正在读取日志详情…')
  view.openDetails()
  expect(api.getAuditLogDetailApi).toHaveBeenCalledOnce()

  first.reject(new Error('网络暂时中断'))
  await pending
  await flush()
  expect(view.detailsAlert()).toBe('网络暂时中断')
  await view.button('重新读取详情').onClick()
  await flush()
  expect(view.detailsAlert()).toBe('日志详情响应不完整，请重试')
  expect(view.text()).not.toContain('错误记录的正文')

  await view.button('重新读取详情').onClick()
  await flush()
  expect(api.getAuditLogDetailApi.mock.calls.map(([id]) => id)).toEqual(['a', 'a', 'a'])
  expect(api.getAuditLogSummaryPageApi).toHaveBeenCalledOnce()
  expect(view.detailsAlert()).toBeUndefined()
  expect(view.text()).toContain('详情已恢复')
})

it('aborts detail reads on close and ignores a late result after another record opens', async () => {
  const first = deferred()
  api.getAuditLogDetailApi.mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ data: { logId: 'b', responseMessage: '当前详情' } })
  const view = await mount()

  const pending = view.openDetails()
  await flush()
  view.closeDetails()
  expect(api.getAuditLogDetailApi.mock.calls[0][1].signal.aborted).toBe(true)
  await view.openDetails(1)
  first.resolve({ data: { logId: 'a', responseMessage: '旧详情' } })
  await pending
  await flush()
  expect(view.text()).not.toContain('旧详情')
  expect(view.text()).toContain('当前详情')
})
