import { onScopeDispose, ref, shallowRef } from 'vue'
import { getAuditLogSummaryPageApi } from '@/services/api/admin.js'
import { handleError } from '@/utils/errorHandler.js'

export function useAuditLogPage() {
  const appliedFilters = shallowRef({})
  const currentPage = ref(1)
  const pageSize = ref(20)
  const page = shallowRef(null)
  const updatedAt = shallowRef(null)
  const loading = ref(false)
  const errorMessage = ref('')
  let pending

  onScopeDispose(() => pending?.abort())

  async function fetchPage(filters, limit, offset, signal) {
    const { data } = await getAuditLogSummaryPageApi({ ...filters, limit, offset }, { signal })
    if (!Array.isArray(data?.logs) || !Number.isSafeInteger(data.total)
      || !Number.isSafeInteger(data.successCount) || !Number.isSafeInteger(data.failedCount)) {
      throw new Error('审计日志响应不完整，请检查前后端版本是否匹配')
    }
    return data
  }

  async function loadPage() {
    pending?.abort()
    const request = new AbortController()
    const { signal } = request
    pending = request
    const filters = appliedFilters.value
    const limit = pageSize.value
    const offset = (currentPage.value - 1) * limit
    loading.value = true
    errorMessage.value = ''
    try {
      let data = await fetchPage(filters, limit, offset, signal)
      if (signal.aborted) return
      if (offset > 0 && offset >= data.total) {
        // 并发删除可能让原页码失效；回到首页，避免反复追赶最后一页。
        if (data.total > 0) {
          data = await fetchPage(filters, limit, 0, signal)
          if (signal.aborted) return
        }
        currentPage.value = 1
      }
      page.value = data
      updatedAt.value = new Date()
    } catch (error) {
      if (signal.aborted) return
      page.value = null
      updatedAt.value = null
      errorMessage.value = handleError(error, {
        defaultMessage: '获取审计日志失败，请重试',
        showMessage: false
      })
    } finally {
      if (pending === request) {
        pending = undefined
        loading.value = false
      }
    }
  }

  function applyFilters(filters) {
    appliedFilters.value = { ...filters }
    currentPage.value = 1
    page.value = null
    updatedAt.value = null
    return loadPage()
  }

  function changePage(nextPage) {
    if (nextPage === currentPage.value) return
    currentPage.value = nextPage
    return loadPage()
  }

  function changePageSize(size) {
    if (size === pageSize.value) return
    pageSize.value = size
    currentPage.value = 1
    return loadPage()
  }

  return { appliedFilters, currentPage, pageSize, page, updatedAt, loading, errorMessage,
    applyFilters, loadPage, changePage, changePageSize }
}
