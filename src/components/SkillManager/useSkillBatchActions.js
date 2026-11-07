import { computed, onScopeDispose, ref, watch } from 'vue'
import { useBatchSelection } from '@/composables/useBatchSelection.js'
import { deleteSkillsBatchApi, exportSkillsBatchApi, toggleSkillsBatchApi } from '@/services/api/skills.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { handleError } from '@/utils/errorHandler.js'
import { showWarning } from '@/utils/messageUtils.js'
import { keepVisibleSelection } from './skillUiModel.js'

/** Batch commands operate on immutable scope/name snapshots, never on the table instance. */
export function useSkillBatchActions({ activeScope, items, isAdmin, dirtyFilePaths, confirmEnable, refreshScope }) {
  const {
    selectedIds: selectedNames, selectedItems: selectedSkills, allFilteredSelected, someFilteredSelected
  } = useBatchSelection(items, skill => skill?.name)
  const hasBatchEnableTarget = computed(() => selectedSkills.value.some(skill => !skill.enabled))
  const hasBatchDisableTarget = computed(() => selectedSkills.value.some(skill => skill.enabled))
  const batchToggleLoading = ref(false), batchExportLoading = ref(false), batchDeleteLoading = ref(false)
  const loading = { toggle: batchToggleLoading, export: batchExportLoading, delete: batchDeleteLoading }
  const showBatchResultDialog = ref(false)
  const batchResultTitle = ref('批量操作结果')
  const batchResultData = ref({ changed: 0, unchanged: 0, failed: 0, results: [] })
  const revisions = { toggle: 0, export: 0, delete: 0 }
  let epoch = 0, selectionIntent = 0, resultRevision = 0, disposed = false

  const setSelection = (rows) => {
    selectionIntent += 1
    selectedNames.value = keepVisibleSelection((rows || []).map(row => row.name), items.value)
  }
  const clearBatchSelection = () => { selectionIntent += 1; selectedNames.value = new Set() }
  const toggleSelectAll = (selected) => setSelection(selected ? items.value : [])
  watch(items, () => {
    selectedNames.value = keepVisibleSelection(selectedNames.value, items.value)
  })

  const resetContext = () => {
    epoch += 1
    resultRevision += 1
    clearBatchSelection()
    showBatchResultDialog.value = false
    for (const kind of Object.keys(loading)) {
      revisions[kind] += 1
      loading[kind].value = false
    }
  }
  watch(activeScope, resetContext, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; resetContext() })

  const begin = (kind) => {
    if (disposed || loading[kind].value || (kind !== 'export' && !isAdmin.value)) return null
    const targets = selectedSkills.value.map(skill => ({ ...skill }))
    if (!targets.length) return null
    const request = {
      scope: activeScope.value, epoch, revision: ++revisions[kind], selectionIntent,
      targets, names: targets.map(skill => skill.name)
    }
    loading[kind].value = true
    return request
  }
  const current = (kind, request) => !disposed && request.epoch === epoch && request.scope === activeScope.value && request.revision === revisions[kind]
  const canMutate = (kind, request) => current(kind, request) && isAdmin.value
  const manifestIsDirty = () => {
    if (!dirtyFilePaths.value.includes('manifest.yaml')) return false
    showWarning('manifest.yaml 有未保存修改，请先保存或放弃修改')
    return true
  }
  const finish = (kind, request) => { if (current(kind, request)) loading[kind].value = false }

  const applyResult = async (kind, request, revision, title, response) => {
    // A completed mutation invalidates its own catalog even after switching views.
    // Only result dialogs and selection restoration depend on current view ownership.
    if (disposed) return
    try { await refreshScope(request.scope) }
    catch (error) {
      if (current(kind, request)) handleError(error, { defaultMessage: '加载 Skill 列表失败' })
    }
    if (!current(kind, request) || revision !== resultRevision) return
    const data = response.data || {}
    const results = Array.isArray(data.results) ? data.results : []
    batchResultTitle.value = title
    batchResultData.value = {
      changed: Number(data.changed) || 0, unchanged: Number(data.unchanged) || 0,
      failed: Number(data.failed) || 0, results
    }
    showBatchResultDialog.value = true
    if (request.selectionIntent === selectionIntent) {
      const submitted = new Set(request.names)
      const failed = new Set(results.filter(row => row.status === 'failed' && submitted.has(row.name)).map(row => row.name))
      selectedNames.value = keepVisibleSelection(failed, items.value)
    }
  }

  const handleBatchToggle = async (enabled) => {
    const request = begin('toggle')
    if (!request) return
    try {
      if (manifestIsDirty()) return
      if (enabled && !(await confirmEnable(request.targets))) return
      if (!canMutate('toggle', request)) return
      const action = enabled ? '启用' : '禁用'
      const needsConfirmation = !enabled || !request.targets.some(skill => skill.requiresExplicitApproval || ['high', 'critical'].includes(skill.risk))
      if (needsConfirmation && !(await confirmAction({
        title: `批量${action}`,
        message: enabled
          ? `确认启用选中的 ${request.names.length} 个 Skill？只有已发布且校验通过的条目会被启用。`
          : `确认禁用选中的 ${request.names.length} 个 Skill？`,
        type: enabled ? 'warning' : 'info', confirmButtonText: action
      }))) return
      if (!canMutate('toggle', request) || manifestIsDirty()) return
      const revision = ++resultRevision
      const response = await toggleSkillsBatchApi({ scope: request.scope, names: request.names, enabled })
      await applyResult('toggle', request, revision, `批量${action}结果`, response)
    } catch (error) {
      if (current('toggle', request)) handleError(error, { defaultMessage: '批量操作失败' })
    } finally { finish('toggle', request) }
  }

  const handleBatchExport = async () => {
    const request = begin('export')
    if (!request) return
    const date = new Date().toISOString().slice(0, 10)
    try {
      const response = await exportSkillsBatchApi({ scope: request.scope, names: request.names })
      // The requested archive still downloads after navigation; selection cleanup belongs only to its view.
      downloadBlob(response.data, `skills_${request.scope}_${date}.zip`)
      if (current('export', request) && request.selectionIntent === selectionIntent) selectedNames.value = new Set()
    } catch (error) {
      if (current('export', request)) handleError(error, { defaultMessage: '批量导出失败' })
    } finally { finish('export', request) }
  }

  const handleBatchDelete = async () => {
    const request = begin('delete')
    if (!request) return
    try {
      if (!(await confirmAction({
        title: '批量删除确认',
        message: `确认删除选中的 ${request.names.length} 个 Skill？删除后不可恢复。`,
        type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger'
      })) || !canMutate('delete', request)) return
      const revision = ++resultRevision
      const response = await deleteSkillsBatchApi({ scope: request.scope, names: request.names })
      await applyResult('delete', request, revision, '批量删除结果', response)
    } catch (error) {
      if (current('delete', request)) handleError(error, { defaultMessage: '批量删除失败' })
    } finally { finish('delete', request) }
  }

  return {
    selectedNames, allFilteredSelected, someFilteredSelected, hasBatchEnableTarget, hasBatchDisableTarget,
    setSelection, clearBatchSelection, toggleSelectAll, batchToggleLoading, batchExportLoading, batchDeleteLoading,
    showBatchResultDialog, batchResultTitle, batchResultData, handleBatchToggle, handleBatchExport, handleBatchDelete
  }
}
