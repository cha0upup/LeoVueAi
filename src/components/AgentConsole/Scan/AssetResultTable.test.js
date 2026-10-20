/* eslint-disable vue/one-component-per-file -- In-memory Element Plus fixtures exercise the real table template. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { compileClientComponent } from '@/test-support/compileClientComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'

const queryResults = vi.fn()
const exportCsv = vi.fn()
const message = { success: vi.fn(), warning: vi.fn(), error: vi.fn() }
const icon = { render: () => null }
const Table = compileClientComponent(new URL('./AssetResultTable.vue', import.meta.url), {
  '@element-plus/icons-vue': { Search: icon, Filter: icon, Download: icon, Refresh: icon },
  'element-plus': { ElMessage: message },
  '@/services/api/scan.js': { queryNetworkProbeWorkflowResultsApi: queryResults },
  '@/utils/exportUtils.js': { exportCsv },
  './FingerprintResults.vue': { default: icon }
})

const findAll = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...node.children.flatMap((child) => findAll(child, predicate))
]
const nodeText = (node) => [node.text, ...node.children.map(nodeText)].join('').trim()
const flush = async () => { for (let i = 0; i < 6; i += 1) await nextTick() }
const endpoint = (n) => ({ host: `host-${n}`, port: 80, protocol: 'tcp', service: 'http', state: 'open' })
const result = (endpoints, total = endpoints.length, extra = {}) => ({ data: { endpoints, total, ...extra } })
const apps = []

function mount() {
  const props = reactive({ taskId: 'task-1', sessionId: 'session-1' })
  const renderer = createTestRenderer()
  const app = renderer.createApp(defineComponent({ setup: () => () => h(Table, props) }))
  for (const name of ['ElButton', 'ElInput', 'ElIcon', 'ElTag', 'ElPagination', 'ElForm', 'ElFormItem', 'ElSelect', 'ElOption', 'ElInputNumber', 'ElCheckbox']) {
    app.component(name, defineComponent({
      inheritAttrs: false,
      setup(_props, { attrs, slots }) { return () => h(name, attrs, slots.default?.()) }
    }))
  }
  app.component('ElDrawer', defineComponent({
    props: { modelValue: Boolean },
    setup(props, { attrs, slots }) {
      return () => h('ElDrawer', attrs, props.modelValue ? [slots.default?.(), slots.footer?.()] : [])
    }
  }))
  app.component('ElTable', defineComponent({
    setup(_props, { attrs, slots, emit, expose }) {
      expose({ clearSelection: () => emit('selection-change', []), toggleRowSelection: vi.fn() })
      return () => h('ElTable', attrs, slots.default?.())
    }
  }))
  app.component('ElTableColumn', { render: () => null })
  app.directive('loading', {})
  app.mount(renderer.root)
  apps.push(app)
  const nodes = (type) => findAll(renderer.root, (node) => node.type === type)
  return {
    props, app, nodes,
    button: (label) => nodes('ElButton').find((node) => nodeText(node) === label),
    table: () => nodes('ElTable')[0],
    pagination: () => nodes('ElPagination')[0]
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  queryResults.mockResolvedValue(result([endpoint(1), endpoint(2)], 401))
})

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.unstubAllGlobals()
})

describe('asset result CSV export', () => {
  it('exports the current page and selection using CSV and the existing endpoint columns', async () => {
    const view = mount()
    await flush()
    view.button('导出本页').props.onClick()
    expect(exportCsv).toHaveBeenLastCalledWith([endpoint(1), endpoint(2)], 'network-results-page-1', expect.any(Array))
    const columns = exportCsv.mock.calls[0][2]
    expect(columns.map((column) => column.label)).toContain('组件')
    expect(columns.find((column) => column.label === 'HTTP 状态码').key({ statusCode: 0 })).toBe(0)

    view.table().props.onSelectionChange([endpoint(2)])
    await nextTick()
    view.button('导出已选 1 项').props.onClick()
    expect(exportCsv).toHaveBeenLastCalledWith([endpoint(2)], 'network-results-selected', columns)
  })

  it('fetches every page within the API limit without changing the displayed page or selection', async () => {
    const view = mount()
    await flush()
    const displayedRows = view.table().props.data
    view.pagination().props['onUpdate:currentPage'](3)
    view.table().props.onSelectionChange([endpoint(1)])
    await nextTick()
    const rows = Array.from({ length: 401 }, (_, i) => endpoint(i + 1))
    queryResults.mockClear()
    queryResults.mockImplementation(({ page, pageSize }) => Promise.resolve(result(
      rows.slice((page - 1) * pageSize, page * pageSize), 401, { pageSize, hasMore: page < 3 }
    )))
    await view.button('导出全部').props.onClick()
    await flush()

    expect(queryResults.mock.calls.map(([request]) => [request.page, request.pageSize])).toEqual([[1, 200], [2, 200], [3, 200]])
    expect(queryResults.mock.calls.every(([request]) => request.taskId === 'task-1' && request.sessionId === 'session-1')).toBe(true)
    expect(exportCsv).toHaveBeenCalledExactlyOnceWith(rows, 'network-results-task-1-all', expect.any(Array))
    expect(message.success).toHaveBeenCalledExactlyOnceWith('已导出 401 条记录')
    expect(view.table().props.data).toBe(displayedRows)
    expect(view.pagination().props['current-page']).toBe(3)
    expect(view.button('导出已选 1 项')).toBeDefined()
  })

  it('honors a smaller page size returned by the API', async () => {
    const view = mount()
    await flush()
    queryResults.mockClear()
    queryResults
      .mockResolvedValueOnce(result([endpoint(1), endpoint(2)], 3, { pageSize: 2, hasMore: true }))
      .mockResolvedValueOnce(result([endpoint(3)], 3, { pageSize: 2, hasMore: false }))
    await view.button('导出全部').props.onClick()
    expect(queryResults.mock.calls.map(([request]) => request.pageSize)).toEqual([200, 2])
    expect(exportCsv.mock.calls[0][0]).toEqual([endpoint(1), endpoint(2), endpoint(3)])
  })

  it('snapshots filters and sorting at export start and reports progress while preventing duplicate exports', async () => {
    const view = mount()
    await flush()
    view.button('筛选').props.onClick()
    await nextTick()
    view.nodes('ElSelect')[0].props['onUpdate:modelValue'](['https'])
    view.nodes('ElInput').find((node) => node.props.placeholder === '例如 spring-boot-actuator').props['onUpdate:modelValue'](' spring ')
    view.button('应用筛选').props.onClick()
    view.table().props.onSortChange({ prop: 'target', order: 'ascending' })
    await flush()
    const firstPage = deferred()
    queryResults.mockClear()
    queryResults
      .mockReturnValueOnce(firstPage.promise)
      .mockResolvedValueOnce(result([endpoint(2)], 2, { pageSize: 1, hasMore: false }))
    const startExport = view.button('导出全部').props.onClick
    const pending = startExport()
    await nextTick()
    expect(view.button('正在导出 0/401').props.loading).toBe(true)
    expect(view.button('导出本页').props.disabled).toBe(true)
    await startExport()
    expect(queryResults).toHaveBeenCalledTimes(1)
    view.nodes('ElInput')[0].props['onUpdate:modelValue']('changed during export')
    firstPage.resolve(result([endpoint(1)], 2, { pageSize: 1, hasMore: true }))
    await pending
    await flush()
    const requests = queryResults.mock.calls.map(([request]) => request)
    expect(requests).toHaveLength(2)
    for (const request of requests) {
      expect(request.sort).toEqual({ field: 'host', order: 'asc' })
      expect(request.filter).toMatchObject({ searchText: '', services: ['https'], component: 'spring', responseTimeMax: null })
    }
    expect(view.button('导出全部').props.loading).toBe(false)
  })

  it.each(['reject', 'empty', 'truncated', 'malformed'])(
    'never downloads a partial CSV when a subsequent page is %s and allows retry', async (failure) => {
      const view = mount()
      await flush()
      const total = failure === 'truncated' ? 3 : 2
      queryResults.mockResolvedValueOnce(result([endpoint(1)], total, { pageSize: 1, hasMore: true }))
      if (failure === 'reject') queryResults.mockRejectedValueOnce(new Error('offline'))
      else if (failure === 'empty') queryResults.mockResolvedValueOnce(result([], 2))
      else if (failure === 'truncated') queryResults.mockResolvedValueOnce(result([endpoint(2)], 3, { hasMore: false }))
      else queryResults.mockResolvedValueOnce({ data: {} })
      await view.button('导出全部').props.onClick()
      await flush()
      expect(exportCsv).not.toHaveBeenCalled()
      expect(message.success).not.toHaveBeenCalled()
      expect(message.error).toHaveBeenCalledOnce()
      expect(view.button('导出全部').props.loading).toBe(false)

      queryResults.mockResolvedValueOnce(result([endpoint(1)]))
      await view.button('导出全部').props.onClick()
      expect(exportCsv).toHaveBeenCalledOnce()
    }
  )

  it.each(['taskId', 'sessionId', 'unmount'])(
    'ignores pending export responses after %s changes', async (change) => {
      const view = mount()
      await flush()
      const response = deferred()
      queryResults.mockReturnValueOnce(response.promise)
      const pending = view.button('导出全部').props.onClick()
      if (change === 'unmount') view.app.unmount()
      else view.props[change] = 'new-value'
      await flush()
      response.resolve(result([endpoint(1)]))
      await pending
      expect(exportCsv).not.toHaveBeenCalled()
      expect(message.success).not.toHaveBeenCalled()
      expect(message.error).not.toHaveBeenCalled()
    }
  )

  it('does not export an empty result set', async () => {
    queryResults.mockResolvedValue(result([]))
    const view = mount()
    await flush()
    expect(view.button('导出全部').props.disabled).toBe(true)
    expect(view.button('导出本页').props.disabled).toBe(true)
    await view.button('导出全部').props.onClick()
    expect(exportCsv).not.toHaveBeenCalled()
  })

  it('reports when records disappear before export starts without creating a file', async () => {
    const view = mount()
    await flush()
    queryResults.mockResolvedValueOnce(result([]))
    await view.button('导出全部').props.onClick()
    expect(exportCsv).not.toHaveBeenCalled()
    expect(message.warning).toHaveBeenCalledExactlyOnceWith('当前没有可导出的记录')
  })
})
