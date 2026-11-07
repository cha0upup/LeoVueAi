import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'
const io = vi.hoisted(() => ({ toggle: vi.fn(), remove: vi.fn(), archive: vi.fn(), confirm: vi.fn(), download: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@/services/api/skills.js', () => ({ toggleSkillsBatchApi: io.toggle, deleteSkillsBatchApi: io.remove, exportSkillsBatchApi: io.archive }))
vi.mock('@/utils/confirmUtils.js', () => ({ confirmAction: io.confirm }))
vi.mock('@/utils/downloadBlob.js', () => ({ downloadBlob: io.download }))
vi.mock('@/utils/errorHandler.js', () => ({ handleError: io.error }))
vi.mock('@/utils/messageUtils.js', () => ({ showWarning: io.warning }))
import { useSkillBatchActions } from './useSkillBatchActions.js'
const scopes = []
function mount() {
  const scope = effectScope(), activeScope = ref('agent-node'), isAdmin = ref(true), dirtyFilePaths = ref([])
  const items = ref([{ name: 'alpha', enabled: false, valid: true, status: 'published', risk: 'low' },
    { name: 'beta', enabled: true, valid: true, status: 'published', risk: 'low' }])
  const confirmEnable = vi.fn().mockResolvedValue(true), refreshScope = vi.fn().mockResolvedValue([])
  const actions = scope.run(() => useSkillBatchActions({ activeScope, items, isAdmin, dirtyFilePaths, confirmEnable, refreshScope }))
  scopes.push(scope)
  return { ...actions, activeScope, items, isAdmin, dirtyFilePaths, confirmEnable, refreshScope, dispose: () => scope.stop() }
}
beforeEach(() => {
  vi.resetAllMocks()
  io.confirm.mockResolvedValue(true)
  io.toggle.mockResolvedValue({ data: { changed: 1, failed: 1, results: [{ name: 'alpha', status: 'changed' }, { name: 'beta', status: 'failed' }] } })
  io.remove.mockResolvedValue({ data: { changed: 2, results: [{ name: 'alpha', status: 'deleted' }, { name: 'beta', status: 'deleted' }] } })
  io.archive.mockResolvedValue({ data: new Blob(['fixture']) })
})
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop() })

describe('Skill batch command ownership', () => {
  it('derives selection from visible rows without depending on a widget', async () => {
    const view = mount()
    view.setSelection(Object.freeze([{ name: 'hidden' }, view.items.value[0], view.items.value[0]]))
    expect([...view.selectedNames.value]).toEqual(['alpha'])
    expect(view.someFilteredSelected.value).toBe(true)
    expect(view.hasBatchEnableTarget.value).toBe(true)
    view.toggleSelectAll(true)
    expect(view.allFilteredSelected.value).toBe(true)
    expect(view.hasBatchDisableTarget.value).toBe(true)
    view.items.value = [view.items.value[0]]; await nextTick()
    expect([...view.selectedNames.value]).toEqual(['alpha'])
    view.toggleSelectAll(false)
    expect(view.selectedNames.value.size).toBe(0)
    view.setSelection(null)
    expect(view.selectedNames.value.size).toBe(0)
  })

  it('does nothing for empty selections and blocks mutation for non-admin users', async () => {
    const view = mount()
    await view.handleBatchToggle(true); await view.handleBatchDelete(); await view.handleBatchExport()
    view.toggleSelectAll(true); view.isAdmin.value = false
    await view.handleBatchToggle(false); await view.handleBatchDelete()
    expect(io.toggle).not.toHaveBeenCalled(); expect(io.remove).not.toHaveBeenCalled(); expect(io.archive).not.toHaveBeenCalled()
    expect(io.confirm).not.toHaveBeenCalled()
  })

  it('keeps exports available for read-only users', async () => {
    const view = mount()
    view.toggleSelectAll(true); view.isAdmin.value = false
    await view.handleBatchExport()
    expect(io.archive).toHaveBeenCalledWith({ scope: 'agent-node', names: ['alpha', 'beta'] })
    expect(io.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^skills_agent-node_\d{4}-\d{2}-\d{2}\.zip$/))
    expect(view.selectedNames.value.size).toBe(0)
  })

  it('blocks a dirty manifest both before and after confirmation', async () => {
    const view = mount()
    view.toggleSelectAll(true); view.dirtyFilePaths.value = ['manifest.yaml']
    await view.handleBatchToggle(true)
    expect(view.confirmEnable).not.toHaveBeenCalled()
    view.dirtyFilePaths.value = []
    const confirmation = deferred(); view.confirmEnable.mockReturnValueOnce(confirmation.promise)
    const operation = view.handleBatchToggle(true)
    view.dirtyFilePaths.value = ['manifest.yaml']; confirmation.resolve(true)
    await operation
    expect(io.toggle).not.toHaveBeenCalled()
    expect(io.warning).toHaveBeenCalledTimes(2)
    expect(view.batchToggleLoading.value).toBe(false)
  })

  it('preserves the existing ordinary-enable and controlled-enable confirmation sequence', async () => {
    const view = mount()
    view.toggleSelectAll(true)
    await view.handleBatchToggle(true)
    expect(view.confirmEnable).toHaveBeenCalledOnce()
    expect(io.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '批量启用' }))
    io.confirm.mockClear()
    view.items.value[0].risk = 'high'; view.setSelection([view.items.value[0]])
    await view.handleBatchToggle(true)
    expect(io.confirm).not.toHaveBeenCalled()
    expect(io.toggle).toHaveBeenLastCalledWith({ scope: 'agent-node', names: ['alpha'], enabled: true })
  })

  it('never submits after either confirmation is declined', async () => {
    const view = mount()
    view.toggleSelectAll(true); view.confirmEnable.mockResolvedValueOnce(false)
    await view.handleBatchToggle(true)
    io.confirm.mockResolvedValue(false)
    await view.handleBatchToggle(false); await view.handleBatchDelete()
    expect(io.toggle).not.toHaveBeenCalled(); expect(io.remove).not.toHaveBeenCalled()
  })

  it.each(['toggle', 'delete'])('invalidates a delayed %s confirmation across A-to-B-to-A scope changes', async (kind) => {
    const view = mount(), confirmation = deferred()
    view.toggleSelectAll(true); io.confirm.mockReturnValueOnce(confirmation.promise)
    const operation = kind === 'toggle' ? view.handleBatchToggle(false) : view.handleBatchDelete()
    view.activeScope.value = 'platform'; view.activeScope.value = 'agent-node'
    confirmation.resolve(true); await operation
    expect(io.toggle).not.toHaveBeenCalled(); expect(io.remove).not.toHaveBeenCalled()
    expect(view.selectedNames.value.size).toBe(0)
  })

  it('pins names before awaiting confirmation and does not overwrite a newer user selection', async () => {
    const view = mount(), confirmation = deferred()
    view.setSelection([view.items.value[0]]); io.confirm.mockReturnValueOnce(confirmation.promise)
    const operation = view.handleBatchToggle(false)
    view.setSelection([view.items.value[1]])
    confirmation.resolve(true); await operation
    expect(io.toggle).toHaveBeenCalledWith({ scope: 'agent-node', names: ['alpha'], enabled: false })
    expect([...view.selectedNames.value]).toEqual(['beta'])
  })

  it('rechecks administrator access after confirmation', async () => {
    const view = mount(), confirmation = deferred()
    view.toggleSelectAll(true); io.confirm.mockReturnValueOnce(confirmation.promise)
    const operation = view.handleBatchDelete()
    view.isAdmin.value = false; confirmation.resolve(true); await operation
    expect(io.remove).not.toHaveBeenCalled()
  })

  it('restores only submitted failures that are still visible after refreshing', async () => {
    const view = mount()
    view.toggleSelectAll(true)
    io.toggle.mockResolvedValueOnce({ data: { changed: '1', failed: '2', results: [
      { name: 'beta', status: 'failed' }, { name: 'unexpected', status: 'failed' }
    ] } })
    await view.handleBatchToggle(false)
    expect(view.refreshScope).toHaveBeenCalledWith('agent-node')
    expect(view.batchResultTitle.value).toBe('批量禁用结果')
    expect(view.batchResultData.value.changed).toBe(1)
    expect(view.showBatchResultDialog.value).toBe(true)
    expect([...view.selectedNames.value]).toEqual(['beta'])
  })

  it('does not resurrect a selection cleared while a mutation was running', async () => {
    const view = mount(), response = deferred()
    view.toggleSelectAll(true); io.toggle.mockReturnValueOnce(response.promise)
    const operation = view.handleBatchToggle(false)
    await Promise.resolve(); view.clearBatchSelection()
    response.resolve({ data: { results: [{ name: 'beta', status: 'failed' }] } }); await operation
    expect(view.selectedNames.value.size).toBe(0)
  })

  it('ignores old mutation responses and errors without clearing the new scope loading state', async () => {
    const view = mount(), old = deferred(), fresh = deferred()
    view.toggleSelectAll(true); io.toggle.mockReturnValueOnce(old.promise)
    const first = view.handleBatchToggle(false); await Promise.resolve()
    view.activeScope.value = 'platform'; view.toggleSelectAll(true)
    io.toggle.mockReturnValueOnce(fresh.promise)
    const second = view.handleBatchToggle(false); await Promise.resolve()
    old.reject(new Error('stale')); await first
    expect(view.batchToggleLoading.value).toBe(true)
    expect(io.error).not.toHaveBeenCalled()
    expect(view.showBatchResultDialog.value).toBe(false)
    fresh.resolve({ data: {} }); await second
    expect(view.batchToggleLoading.value).toBe(false)
    expect(view.refreshScope).toHaveBeenCalledTimes(1)
    expect(view.refreshScope).toHaveBeenCalledWith('platform')
  })

  it('rechecks scope ownership after the refresh has awaited', async () => {
    const view = mount(), refresh = deferred()
    view.toggleSelectAll(true); view.refreshScope.mockReturnValueOnce(refresh.promise)
    const operation = view.handleBatchToggle(false)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    view.activeScope.value = 'platform'; refresh.resolve([]); await operation
    expect(view.showBatchResultDialog.value).toBe(false)
    expect(view.selectedNames.value.size).toBe(0)
  })

  it('refreshes the submitted catalog after navigation without touching the new view selection', async () => {
    const view = mount(), response = deferred()
    view.toggleSelectAll(true); io.toggle.mockReturnValueOnce(response.promise)
    const operation = view.handleBatchToggle(false); await Promise.resolve()
    view.activeScope.value = 'platform'; view.setSelection([view.items.value[1]])
    response.resolve({ data: { results: [{ name: 'alpha', status: 'failed' }] } }); await operation
    expect(view.refreshScope).toHaveBeenCalledWith('agent-node')
    expect([...view.selectedNames.value]).toEqual(['beta'])
    expect(view.showBatchResultDialog.value).toBe(false)
  })

  it('keeps the latest submitted result when different mutations finish out of order', async () => {
    const view = mount(), old = deferred()
    view.toggleSelectAll(true); io.toggle.mockReturnValueOnce(old.promise)
    const first = view.handleBatchToggle(false); await Promise.resolve()
    await view.handleBatchDelete()
    old.resolve({ data: { results: [{ name: 'alpha', status: 'failed' }] } }); await first
    expect(view.batchResultTitle.value).toBe('批量删除结果')
    expect(view.selectedNames.value.size).toBe(0)
  })

  it('retains a command result even if refreshing the catalog fails', async () => {
    const view = mount()
    view.toggleSelectAll(true); view.refreshScope.mockRejectedValueOnce(new Error('refresh failed'))
    await view.handleBatchDelete()
    expect(view.batchResultTitle.value).toBe('批量删除结果')
    expect(io.error).toHaveBeenCalledWith(expect.any(Error), { defaultMessage: '加载 Skill 列表失败' })
  })

  it('blocks duplicate commands while a confirmation or request is pending', async () => {
    const view = mount(), confirmation = deferred()
    view.toggleSelectAll(true); io.confirm.mockReturnValueOnce(confirmation.promise)
    const first = view.handleBatchDelete()
    await view.handleBatchDelete()
    expect(io.confirm).toHaveBeenCalledOnce()
    confirmation.resolve(true); await first
    expect(io.remove).toHaveBeenCalledOnce()
  })

  it('retains new selections and lets requested downloads finish after navigation', async () => {
    const view = mount(), response = deferred()
    view.setSelection([view.items.value[0]]); io.archive.mockReturnValueOnce(response.promise)
    const exporting = view.handleBatchExport()
    view.setSelection([view.items.value[1]]); response.resolve({ data: new Blob(['fixture']) }); await exporting
    expect([...view.selectedNames.value]).toEqual(['beta'])
    const late = deferred(); io.archive.mockReturnValueOnce(late.promise)
    const second = view.handleBatchExport(); view.dispose()
    late.resolve({ data: new Blob(['late']) }); await second
    expect(io.download).toHaveBeenCalledTimes(2)
  })

  it('keeps an archive bound to its requested scope without clearing a new scope selection', async () => {
    const view = mount(), response = deferred()
    view.toggleSelectAll(true); io.archive.mockReturnValueOnce(response.promise)
    const exporting = view.handleBatchExport()
    view.activeScope.value = 'platform'; view.setSelection([view.items.value[1]])
    response.resolve({ data: new Blob(['archive']) }); await exporting
    expect(io.archive).toHaveBeenCalledWith({ scope: 'agent-node', names: ['alpha', 'beta'] })
    expect(io.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringContaining('skills_agent-node_'))
    expect([...view.selectedNames.value]).toEqual(['beta'])
  })

  it.each(['toggle', 'delete', 'export'])('handles current %s failures without losing the selection', async kind => {
    const view = mount(), failure = new Error('fixture failure')
    view.toggleSelectAll(true)
    const api = { toggle: io.toggle, delete: io.remove, export: io.archive }[kind]
    api.mockRejectedValueOnce(failure)
    await ({ toggle: () => view.handleBatchToggle(false), delete: view.handleBatchDelete, export: view.handleBatchExport }[kind])()
    expect(io.error).toHaveBeenCalledWith(failure, expect.any(Object))
    expect([...view.selectedNames.value]).toEqual(['alpha', 'beta'])
    expect(view.showBatchResultDialog.value).toBe(false)
    expect([view.batchToggleLoading.value, view.batchDeleteLoading.value, view.batchExportLoading.value]).toEqual([false, false, false])
  })
})
