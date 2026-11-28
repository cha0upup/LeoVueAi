import { onScopeDispose, ref, shallowRef } from 'vue'
import { getAuditLogSummaryPageApi } from '@/services/api/admin.js'
import { handleError } from '@/utils/errorHandler.js'
import { areAuditFiltersEqual } from './auditManagerModel.js'

export function useAuditLogPage() {
  const appliedFilters = shallowRef({})
  const currentPage = ref(1)
  const pageSize = ref(20)
  const page = shallowRef(null)
  const updatedAt = shallowRef(null)
  const loading = ref(false)
  const errorMessage = ref('')
  let pending

  onScopeDispose(() => pending?.controller.abort())

  async function fetchPage(filters, limit, offset, signal) {
    const { data } = await getAuditLogSummaryPageApi({ ...filters, limit, offset }, { signal })
    if (!Array.isArray(data?.logs) || !Number.isSafeInteger(data.total)
      || !Number.isSafeInteger(data.successCount) || !Number.isSafeInteger(data.failedCount)) {
      throw new Error('审计日志响应不完整，请重试')
    }
    return data
  }

  function loadPage({ pageNumber = currentPage.value, size = pageSize.value, keepPrevious = true, force = false } = {}) {
    const filters = appliedFilters.value
    if (!force && pending?.filters === filters && pending.pageNumber === pageNumber && pending.size === size) {
      return pending.promise
    }
    pending?.controller.abort()
    const request = { filters, pageNumber, size, controller: new AbortController(), promise: null }
    pending = request
    request.promise = readPage(request, keepPrevious)
    return request.promise
  }

  async function readPage(request, keepPrevious) {
    const { filters, pageNumber, size, controller: { signal } } = request
    const offset = (pageNumber - 1) * size
    loading.value = true
    errorMessage.value = ''
    if (!keepPrevious) {
      page.value = null
      updatedAt.value = null
    }
    try {
      let data = await fetchPage(filters, size, offset, signal)
      if (signal.aborted) return
      // 并发删除可能让原页码失效；回到首页，避免反复追赶最后一页。
      const pageDisappeared = offset > 0 && offset >= data.total
      if (pageDisappeared && data.total > 0) {
        data = await fetchPage(filters, size, 0, signal)
        if (signal.aborted) return
      }
      currentPage.value = pageDisappeared ? 1 : pageNumber
      pageSize.value = size
      page.value = data
      updatedAt.value = new Date()
    } catch (error) {
      if (signal.aborted) return
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
    const sameFilters = areAuditFiltersEqual(filters, appliedFilters.value)
    if (!sameFilters) {
      appliedFilters.value = { ...filters }
      currentPage.value = 1
    }
    return loadPage({ pageNumber: 1, keepPrevious: sameFilters })
  }

  function changePage(nextPage) {
    if (nextPage === currentPage.value) return
    return loadPage({ pageNumber: nextPage })
  }

  function changePageSize(size) {
    if (size === pageSize.value) return
    return loadPage({ pageNumber: 1, size })
  }

  return { appliedFilters, currentPage, pageSize, page, updatedAt, loading, errorMessage,
    applyFilters, loadPage, changePage, changePageSize }
}
