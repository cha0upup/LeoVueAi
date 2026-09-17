import { computed, inject, ref, unref, watch } from 'vue'

export function useContainerAssetList(getItems, searchValues, searchKeyword = ref('')) {
  const currentPage = ref(1)
  const configuredPageSize = inject('puppetListPageSize', 50)
  const pageSize = computed(() => Math.max(1, Number(unref(configuredPageSize)) || 50))
  const filteredItems = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    const items = getItems()
    return keyword
      ? items.filter(item => searchValues(item).flat().some(value =>
        String(value ?? '').toLowerCase().includes(keyword)))
      : items
  })
  const pagedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredItems.value.slice(start, start + pageSize.value)
  })

  watch([searchKeyword, pageSize], () => { currentPage.value = 1 })
  watch(() => filteredItems.value.length, length => {
    currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(length / pageSize.value)))
  })

  return { searchKeyword, currentPage, pageSize, filteredItems, pagedItems }
}
