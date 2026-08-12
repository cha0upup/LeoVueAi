import { computed, ref } from 'vue'
import { getRequiredTransferIds } from '@/utils/puppetTransfer.js'

export function usePuppetImportBatch() {
  const batchPuppets = ref([])
  const batchSelectedIndices = ref(new Set())
  const batchTargetIds = ref(new Set())
  const batchSelectedTargetIds = ref(new Set())

  const batchAllSelected = computed(
    () =>
      batchTargetIds.value.size > 0 &&
      batchSelectedTargetIds.value.size === batchTargetIds.value.size
  )
  const batchIndeterminate = computed(
    () =>
      batchSelectedTargetIds.value.size > 0 &&
      batchSelectedTargetIds.value.size < batchTargetIds.value.size
  )

  const isSelectableTargetItem = (item) =>
    Boolean(item?.__transferId && batchTargetIds.value.has(item.__transferId))

  const isDependencyItem = (item) =>
    Boolean(item?.__transferId && !batchSelectedTargetIds.value.has(item.__transferId))

  const selectedDependencyCount = computed(
    () =>
      [...batchSelectedIndices.value].filter((index) =>
        isDependencyItem(batchPuppets.value[index])
      ).length
  )
  const batchSelectionSummary = computed(
    () =>
      `已选 ${batchSelectedTargetIds.value.size} 台目标，自动包含 ${selectedDependencyCount.value} 台依赖`
  )
  const batchSubmitLabel = computed(
    () =>
      `导入 ${batchSelectedTargetIds.value.size} 台目标及 ${selectedDependencyCount.value} 台依赖`
  )
  const selectedBatchPuppets = computed(() =>
    batchPuppets.value.filter((_, index) => batchSelectedIndices.value.has(index))
  )

  const syncSelection = () => {
    const records = batchPuppets.value.map((item) => ({
      transferId: item.__transferId,
      parentTransferId: item.__parentTransferId
    }))
    const requiredIds = getRequiredTransferIds(records, batchSelectedTargetIds.value)
    batchSelectedIndices.value = new Set(
      batchPuppets.value.flatMap((item, index) =>
        requiredIds.has(item.__transferId) ? [index] : []
      )
    )
  }

  const loadBundle = (puppets, targetIds) => {
    batchPuppets.value = Array.isArray(puppets) ? puppets : []
    batchTargetIds.value = new Set(targetIds || [])
    batchSelectedTargetIds.value = new Set(batchTargetIds.value)
    syncSelection()
  }

  const isBatchItemChecked = (item, index) =>
    isSelectableTargetItem(item)
      ? batchSelectedTargetIds.value.has(item.__transferId)
      : batchSelectedIndices.value.has(index)

  const toggleSelectAll = (selected) => {
    batchSelectedTargetIds.value = selected ? new Set(batchTargetIds.value) : new Set()
    syncSelection()
  }

  const toggleBatchItem = (index) => {
    const item = batchPuppets.value[index]
    if (!isSelectableTargetItem(item)) return
    const nextTargets = new Set(batchSelectedTargetIds.value)
    if (nextTargets.has(item.__transferId)) nextTargets.delete(item.__transferId)
    else nextTargets.add(item.__transferId)
    batchSelectedTargetIds.value = nextTargets
    syncSelection()
  }

  const resetBatch = () => {
    batchPuppets.value = []
    batchSelectedIndices.value = new Set()
    batchTargetIds.value = new Set()
    batchSelectedTargetIds.value = new Set()
  }

  return {
    batchPuppets,
    batchSelectedIndices,
    batchSelectedTargetIds,
    batchAllSelected,
    batchIndeterminate,
    batchSelectionSummary,
    batchSubmitLabel,
    selectedBatchPuppets,
    isDependencyItem,
    isSelectableTargetItem,
    isBatchItemChecked,
    toggleSelectAll,
    toggleBatchItem,
    loadBundle,
    resetBatch
  }
}
