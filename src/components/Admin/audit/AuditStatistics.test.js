import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { formatDate } from '@/utils/format.js'
import { handleError } from '@/utils/errorHandler.js'
import { icons } from '@/utils/icons.js'
import { getOperationTagType } from './auditManagerModel.js'

const api = Object.fromEntries(['getAuditOperationStatisticsApi', 'getAuditAgentStatisticsApi',
  'getAuditTeamStatisticsApi', 'getAuditTrendStatisticsApi', 'getAuditUserStatisticsApi'].map(name => [name, vi.fn()]))
const stub = (name, slots) => ({ default: createSlotStub(name, slots) })
const View = compileClientComponent(new URL('./AuditStatistics.vue', import.meta.url), {
  '@/components/common/PageHeader.vue': stub('PageHeader'),
  '@/components/Admin/shared/AdminWorkspacePanel.vue': stub('AdminWorkspacePanel', ['tags', 'actions', 'default']),
  '@/utils/icons.js': { icons },
  '@/utils/format.js': { formatDate },
  '@/utils/errorHandler.js': { handleError },
  '@/services/api/admin.js': api,
  './auditManagerModel.js': { getOperationTagType }
})
const apps = new Set()
const text = node => [node.text, ...node.children.map(text)].join('').trim()
const flush = async () => { for (let i = 0; i < 6; i++) await nextTick() }

async function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.directive('loading', {})
  for (const name of ['Icon', 'ElIcon', 'ElButton', 'ElInput', 'ElSelect', 'ElOption',
    'ElProgress', 'ElTag', 'ElAlert', 'ElEmpty']) app.component(name, createSlotStub(name))
  app.mount(renderer.root)
  apps.add(app)
  await flush()
  const nodes = (predicate) => findNodes(renderer.root, predicate)
  return {
    nodes,
    text: () => text(renderer.root),
    input: (label) => nodes(node => node.type === 'ElInput' && node.props.placeholder === `输入${label}ID`)[0].props,
    button: (label) => nodes(node => node.type === 'ElButton' && text(node) === label)[0].props,
    unmount() { app.unmount(); apps.delete(app) }
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getAuditOperationStatisticsApi.mockResolvedValue({ data: [] })
  api.getAuditTrendStatisticsApi.mockResolvedValue({ data: [] })
  api.getAuditUserStatisticsApi.mockResolvedValue({ data: { totalOperations: 10, recentOperations: 1 } })
})
afterEach(() => { for (const app of apps) app.unmount(); apps.clear() })

it('trims subject searches and refreshes the submitted ID independently of the draft', async () => {
  const view = await mount()
  const input = () => view.input('用户')
  await input().onKeyup({ key: 'Enter' })
  await flush()
  expect(view.text()).toContain('请输入用户ID')
  expect(api.getAuditUserStatisticsApi).not.toHaveBeenCalled()
  input()['onUpdate:modelValue'](' member ')
  await input().onKeyup({ key: 'Enter' })
  await flush()
  input()['onUpdate:modelValue']('another')
  await view.button('刷新').onClick()
  expect(api.getAuditUserStatisticsApi.mock.calls.map(([params]) => params)).toEqual([
    { userId: 'member' }, { userId: 'member' }
  ])
  expect(view.text()).toContain('member')
})

it('keeps prior results on a failed refresh but does not show them for a new subject', async () => {
  const view = await mount()
  const input = () => view.input('用户')
  input()['onUpdate:modelValue']('member')
  await input().onKeyup({ key: 'Enter' })
  api.getAuditUserStatisticsApi.mockRejectedValueOnce(new Error('刷新失败'))

  await view.button('刷新').onClick()
  expect(view.text()).toContain('刷新失败；仍显示上次成功的结果')
  expect(view.text()).toContain('用户IDmember')

  input()['onUpdate:modelValue']('another')
  api.getAuditUserStatisticsApi.mockRejectedValueOnce(new Error('查询失败'))
  await input().onKeyup({ key: 'Enter' })
  expect(view.text()).toContain('查询失败')
  expect(view.text()).not.toContain('仍显示上次成功的结果')
  expect(view.nodes(node => node.props.class === 'query-result')).toHaveLength(0)
})

it('ignores out-of-order trend responses and keeps zero days at zero height', async () => {
  const old = deferred()
  const latest = deferred()
  api.getAuditTrendStatisticsApi.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  const view = await mount()
  const picker = view.nodes(node => node.type === 'ElSelect' && node.props['aria-label'] === '操作趋势时间范围')[0].props
  picker['onUpdate:modelValue']('90')
  const changing = picker.onChange()
  expect(api.getAuditTrendStatisticsApi.mock.calls[0][1].signal.aborted).toBe(true)
  expect(api.getAuditTrendStatisticsApi.mock.lastCall[0]).toEqual({ days: 90 })
  latest.resolve({ data: [
    { day: '2026-01-02', date: '01-02', count: 0 },
    { day: '2026-01-03', date: '01-03', count: 4 }
  ] })
  await changing
  old.resolve({ data: [{ day: '2026-01-01', date: '01-01', count: 500 }] })
  await flush()
  expect(view.text()).not.toContain('01-01')
  expect(view.nodes(node => node.props.class === 'trend-bar').map(node => node.props.style.height))
    .toEqual(['0%', '100%'])

  api.getAuditTrendStatisticsApi.mockRejectedValueOnce(new Error('趋势刷新失败'))
  const trendRefresh = view.nodes(node => node.type === 'ElButton' && text(node) === '刷新').at(-1)
  await trendRefresh.props.onClick()
  expect(view.nodes(node => node.type === 'ElAlert')[0].props.description).toBe('仍显示上次成功的结果')
  expect(view.nodes(node => node.props.class === 'trend-bar')).toHaveLength(2)

  api.getAuditTrendStatisticsApi.mockRejectedValueOnce(new Error('新范围加载失败'))
  picker['onUpdate:modelValue']('30')
  await picker.onChange()
  expect(view.nodes(node => node.type === 'ElAlert')[0].props.description).toBeUndefined()
  expect(view.nodes(node => node.props.class === 'trend-bar')).toHaveLength(0)
})

it('can follow the trend range without changing the default or independent distribution ranges', async () => {
  const view = await mount()
  expect(api.getAuditOperationStatisticsApi.mock.lastCall[0]).toBeUndefined()
  const picker = view.nodes(node => node.type === 'ElSelect' && node.props['aria-label'] === '操作分布时间范围')[0].props
  picker['onUpdate:modelValue']('30')
  await picker.onChange()
  expect(api.getAuditOperationStatisticsApi.mock.lastCall[0]).toEqual({ days: 30 })
  expect(api.getAuditTrendStatisticsApi).toHaveBeenCalledOnce()

  picker['onUpdate:modelValue']('trend')
  await picker.onChange()
  expect(api.getAuditOperationStatisticsApi.mock.lastCall[0]).toEqual({ days: 7 })
  const trend = view.nodes(node => node.type === 'ElSelect' && node.props['aria-label'] === '操作趋势时间范围')[0].props
  trend['onUpdate:modelValue']('90')
  await trend.onChange()
  expect(api.getAuditTrendStatisticsApi.mock.lastCall[0]).toEqual({ days: 90 })
  expect(api.getAuditOperationStatisticsApi.mock.lastCall[0]).toEqual({ days: 90 })

  picker['onUpdate:modelValue']('all')
  await picker.onChange()
  expect(api.getAuditOperationStatisticsApi.mock.lastCall[0]).toBeUndefined()
  const requests = api.getAuditOperationStatisticsApi.mock.calls.length
  trend['onUpdate:modelValue']('30')
  await trend.onChange()
  expect(api.getAuditOperationStatisticsApi).toHaveBeenCalledTimes(requests)
})

it('shows current errors separately from empty data and cancels pending reads on exit', async () => {
  const pending = deferred()
  api.getAuditOperationStatisticsApi.mockReturnValueOnce(pending.promise)
  api.getAuditTrendStatisticsApi.mockRejectedValueOnce(new Error('趋势加载失败'))
  const view = await mount()
  expect(view.nodes(node => node.type === 'ElAlert').map(node => node.props.title)).toContain('趋势加载失败')
  const signal = api.getAuditOperationStatisticsApi.mock.lastCall[1].signal
  view.unmount()
  expect(signal.aborted).toBe(true)
  pending.resolve({ data: [] })
})
