import { computed, ref } from 'vue'

export function useBatchSelection(items, getId) {
  const selectedIds = ref(new Set())
  const selectedCount = computed(
    () => items.value.filter(item => selectedIds.value.has(getId(item))).length
  )
  const allFilteredSelected = computed(
    () => items.value.length > 0 && selectedCount.value === items.value.length
  )
  const someFilteredSelected = computed(
    () => selectedCount.value > 0 && selectedCount.value < items.value.length
  )

  function setSelected(item, selected) {
    const id = getId(item)
    if (!id) return
    if (selected) selectedIds.value.add(id)
    else selectedIds.value.delete(id)
  }

  function toggleSelectAll(selected) {
    for (const item of items.value) setSelected(item, selected)
  }

  function clearBatchSelection() {
    selectedIds.value.clear()
  }

  return {
    selectedIds,
    allFilteredSelected,
    someFilteredSelected,
    setSelected,
    toggleSelectAll,
    clearBatchSelection
  }
}
