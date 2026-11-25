import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { ARTIFACT_CATEGORIES, ARTIFACT_SOURCE_LABELS } from '@/constants/artifacts.js'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { formatDate, formatFileSize } from '@/utils/format.js'
import { handleError } from '@/utils/errorHandler.js'
import { icons } from '@/utils/icons.js'
import * as model from './userSpaceModel.js'

const api = {
  userFileListApi: vi.fn(), userFilePreviewApi: vi.fn(),
  userFileUploadApi: vi.fn(), userFileDownloadApi: vi.fn(), userFileDeleteApi: vi.fn()
}
const messages = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => messages)

const stub = (name, slots) => ({ default: createSlotStub(name, slots) })
const view = compileClientComponent(new URL('./UserSpace.vue', import.meta.url), {
  '@/components/common/PageHeader.vue': stub('PageHeader', ['actions']),
  '@/components/common/EmptyState.vue': stub('EmptyState'),
  './UserSpaceDetail.vue': stub('Detail'),
  './UserSpacePreviewDialog.vue': stub('PreviewDialog'),
  '@/constants/artifacts.js': { ARTIFACT_CATEGORIES, ARTIFACT_SOURCE_LABELS },
  '@/utils/icons.js': { icons },
  '@/utils/format.js': { formatDate, formatFileSize },
  '@/utils/downloadBlob.js': { downloadBlob: vi.fn() },
  '@/utils/confirmUtils.js': { confirmAction: vi.fn(), confirmDelete: vi.fn() },
  '@/utils/messageUtils.js': messages,
  '@/utils/errorHandler.js': { handleError },
  '@/services/api/user-space.js': api,
  './userSpaceModel.js': model
})
const original = { name: 'note.md', path: 'imports/note.md' }
const replacement = { name: 'latest.txt', path: 'imports/latest.txt' }
const summary = (files) => ({ totalFiles: files, totalBytes: files * 10, categories: [{ path: 'imports', files }] })
const result = (page, fileList, count = fileList.length, overview) => ({ data: { page, fileList, count, overview } })
const apps = []
const flush = async () => { for (let i = 0; i < 5; i++) await nextTick() }

function mount() {
  const renderer = createTestRenderer()
  const app = renderer.createApp(view)
  app.directive('loading', {})
  for (const name of ['Icon', 'ElIcon', 'ElButton', 'ElInput', 'ElSelect', 'ElOption', 'ElPagination', 'ElDrawer']) {
    app.component(name, createSlotStub(name))
  }
  app.component('ElTable', createSlotStub('ElTable', ['default', 'empty']))
  app.component('ElTableColumn', createSlotStub('ElTableColumn', []))
  app.mount(renderer.root)
  apps.push(app)
  const props = (type) => findNode(renderer.root, type)?.props
  return {
    search: (value) => props('ElInput')['onUpdate:modelValue'](value),
    selectCategory: (path) => {
      const index = ARTIFACT_CATEGORIES.findIndex((category) => category.path === path) + 1
      findNodes(renderer.root, (node) => node.type === 'button' && node.props['aria-pressed'] != null)[index].props.onClick()
    },
    rows: () => props('ElTable').data,
    empty: () => props('EmptyState'),
    pagination: () => props('ElPagination'),
    openPreview: (file) => props('ElTable').onRowDblclick(file),
    preview: () => props('PreviewDialog'),
    summary: () => findNodes(renderer.root, node => node.type === 'span' && node.props.class === 'storage-summary')[0].text,
    refresh: () => findNodes(renderer.root, node => node.type === 'ElButton' && node.props['aria-label'] === '刷新成果库')[0].props.onClick(),
    upload: (file) => props('input').onChange({ target: { files: [file] } })
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.userFileListApi.mockResolvedValue(result(1, [original], 1, summary(1)))
})

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.useRealTimers()
})

it('debounces text search, aborts stale pages and loads a changed category immediately', async () => {
  vi.useFakeTimers()
  const older = deferred()
  api.userFileListApi.mockReturnValueOnce(older.promise)
  const workspace = mount()

  workspace.search(' a ')
  await nextTick()
  expect(api.userFileListApi.mock.calls[0][1].signal.aborted).toBe(true)
  workspace.search(' ab ')
  await nextTick()
  await vi.advanceTimersByTimeAsync(249)
  expect(api.userFileListApi).toHaveBeenCalledTimes(1)

  api.userFileListApi.mockResolvedValueOnce(result(1, [replacement], 1, summary(1)))
  workspace.selectCategory('imports')
  await flush()
  expect(api.userFileListApi).toHaveBeenLastCalledWith(
    expect.objectContaining({ path: 'imports', search: 'ab', page: 1, includeOverview: true }), expect.any(Object)
  )
  older.resolve(result(1, [original], 1, summary(99)))
  await vi.runAllTimersAsync()
  expect(api.userFileListApi).toHaveBeenCalledTimes(2)
  expect(workspace.rows()).toEqual([replacement])
  expect(workspace.summary()).toContain('1 份成果')
})

it('shows a read failure instead of an empty catalog and retries with the same parameters', async () => {
  api.userFileListApi.mockRejectedValueOnce(new Error('目录暂时不可用'))
  const workspace = mount()
  await flush()

  expect(workspace.empty()).toMatchObject({ title: '成果列表读取失败', description: '目录暂时不可用' })
  await workspace.empty().onAction()
  await flush()
  expect(workspace.rows()).toEqual([original])
  expect(api.userFileListApi.mock.calls[0][0]).toEqual(api.userFileListApi.mock.calls[1][0])
})

it('requests global counts on entry and refresh, but not when filtering or paging', async () => {
  api.userFileListApi.mockResolvedValueOnce(result(1, [original], 1, summary(2)))
    .mockResolvedValueOnce(result(1, [original], 51))
    .mockResolvedValueOnce(result(2, [replacement], 51))
    .mockResolvedValueOnce(result(2, [replacement], 51, summary(52)))
  const workspace = mount()
  await flush()

  workspace.selectCategory('imports')
  await flush()
  workspace.pagination().onCurrentChange(2)
  await flush()
  expect(workspace.summary()).toContain('2 份成果')
  await workspace.refresh()
  await flush()

  expect(api.userFileListApi.mock.calls.map(([params]) => params.includeOverview)).toEqual([true, undefined, undefined, true])
  expect(workspace.summary()).toContain('52 份成果')
})

it('keeps a filtered page usable and marks prior counts as stale if a combined response omits totals', async () => {
  api.userFileListApi.mockResolvedValueOnce(result(1, [original], 1, summary(2)))
    .mockResolvedValueOnce(result(1, [original]))
    .mockResolvedValueOnce(result(1, [replacement]))
  const workspace = mount()
  await flush()
  workspace.selectCategory('imports')
  await flush()
  await workspace.refresh()
  await flush()

  expect(workspace.rows()).toEqual([replacement])
  expect(workspace.summary()).toContain('2 份成果')
  expect(workspace.summary()).toContain('统计待刷新')
})

it('keeps newly refreshed counts when loading the first page after a shrink fails', async () => {
  api.userFileListApi.mockResolvedValueOnce(result(1, [original], 51, summary(51)))
    .mockResolvedValueOnce(result(2, [replacement], 51))
    .mockResolvedValueOnce(result(2, [], 1, summary(1)))
    .mockRejectedValueOnce(new Error('network failure'))
  const workspace = mount()
  await flush()
  workspace.pagination().onCurrentChange(2)
  await flush()
  await workspace.refresh()
  await flush()

  expect(api.userFileListApi.mock.calls.map(([params]) => [params.page, params.includeOverview]))
    .toEqual([[1, true], [2, undefined], [2, true], [1, undefined]])
  expect(workspace.empty().title).toBe('成果列表读取失败')
  expect(workspace.summary()).toBe('1 份成果 · 10 B')
})

it('updates counts and opens the import category with one list request after an upload', async () => {
  api.userFileUploadApi.mockResolvedValue({ data: {} })
  api.userFileListApi.mockResolvedValueOnce(result(1, [original], 1, summary(1)))
    .mockResolvedValueOnce(result(1, [replacement], 1, summary(2)))
  const workspace = mount()
  await flush()

  await workspace.upload(new File(['fixture'], 'latest.txt'))
  await flush()
  expect(api.userFileListApi).toHaveBeenCalledTimes(2)
  expect(api.userFileListApi).toHaveBeenLastCalledWith(
    expect.objectContaining({ path: 'imports', page: 1, includeOverview: true }), expect.any(Object)
  )
  expect(workspace.rows()).toEqual([replacement])
  expect(workspace.summary()).toContain('2 份成果')
})

it('returns to the first page once when a previously valid page no longer exists', async () => {
  api.userFileListApi.mockResolvedValueOnce(result(1, [original], 51, summary(51)))
    .mockResolvedValueOnce(result(2, [], 1))
    .mockResolvedValueOnce(result(1, [replacement]))
  const workspace = mount()
  await flush()

  workspace.pagination().onCurrentChange(2)
  await flush()
  expect(api.userFileListApi.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1])
  expect(workspace.pagination()['current-page']).toBe(1)
  expect(workspace.rows()).toEqual([replacement])
})

it('opens preview immediately, aborts on close and retries a failed file without stale content', async () => {
  const earlier = deferred()
  api.userFilePreviewApi.mockReturnValueOnce(earlier.promise)
    .mockRejectedValueOnce(new Error('读取失败'))
    .mockResolvedValueOnce({ data: { content: 'current text' } })
  const workspace = mount()
  await flush()

  const closed = workspace.openPreview(original)
  workspace.openPreview(original)
  await nextTick()
  expect(api.userFilePreviewApi).toHaveBeenCalledExactlyOnceWith(
    { path: original.path, size: 1024 * 1024 }, expect.any(Object)
  )
  expect(workspace.preview()).toMatchObject({ path: original.path, modelValue: true, loading: true, data: null })
  workspace.preview()['onUpdate:modelValue'](false)
  expect(api.userFilePreviewApi.mock.calls[0][1].signal.aborted).toBe(true)

  await workspace.openPreview(replacement)
  earlier.resolve({ data: { content: 'outdated text' } })
  await closed
  await nextTick()
  expect(workspace.preview()).toMatchObject({ path: replacement.path, error: '读取失败', data: null })
  await workspace.preview().onRetry()
  await nextTick()
  expect(workspace.preview()).toMatchObject({ path: replacement.path, error: '', data: { content: 'current text' } })
})

it('opens the download view without a request for known binary formats and cancels the earlier preview', async () => {
  const earlier = deferred()
  api.userFilePreviewApi.mockReturnValueOnce(earlier.promise)
  api.userFileDownloadApi.mockResolvedValue({ data: new Blob(['fixture']) })
  const binary = { name: 'fixture.zip', path: 'imports/fixture.zip' }
  const workspace = mount()
  await flush()

  const text = workspace.openPreview(original)
  await workspace.openPreview(binary)
  earlier.resolve({ data: { content: 'outdated text' } })
  await text
  await nextTick()

  expect(api.userFilePreviewApi).toHaveBeenCalledOnce()
  expect(api.userFilePreviewApi.mock.calls[0][1].signal.aborted).toBe(true)
  expect(workspace.preview()).toMatchObject({ path: binary.path, loading: false, data: { previewable: false } })
  await workspace.preview().onDownload()
  expect(api.userFileDownloadApi).toHaveBeenCalledExactlyOnceWith({ path: binary.path, filename: binary.name })
})

it('accepts the server download-only response when a file name suggests text', async () => {
  api.userFilePreviewApi.mockResolvedValue({ data: { path: replacement.path, size: 4, previewable: false } })
  const workspace = mount()
  await flush()
  await workspace.openPreview(replacement)
  await nextTick()

  expect(workspace.preview()).toMatchObject({ path: replacement.path, loading: false, error: '', data: { previewable: false } })
})
