import { computed, ref } from 'vue'

export function useBatchSelection(items, getId) {
  const selectedIds = ref(new Set())
  const selectedItems = computed(
    () => items.value.filter(item => selectedIds.value.has(getId(item)))
  )
  const allFilteredSelected = computed(
    () => items.value.length > 0 && selectedItems.value.length === items.value.length
  )
  const someFilteredSelected = computed(
    () => selectedItems.value.length > 0 && selectedItems.value.length < items.value.length
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
    selectedItems,
    allFilteredSelected,
    someFilteredSelected,
    setSelected,
    toggleSelectAll,
    clearBatchSelection
  }
}
