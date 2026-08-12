import { getCurrentScope, onScopeDispose, reactive, ref, watch } from 'vue'

import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/utils/database.js'
import {
  DATABASE_OBJECT_KINDS,
  getDatabaseObjectCacheKey,
  normalizeDatabaseObjectRef
} from './database-domain.js'
import { normalizeQueryRows } from './database-table-model.js'
import { normalizeDatabaseTableQuery } from './database-table-query.js'
import {
  isCanceledDatabaseRequest,
  normalizeDatabaseQueryTimeout
} from './database-query-status.js'

export function useDatabaseTableLoader({
  sessionId,
  connection,
  selectedObject,
  sqlEngine,
  onError
}) {
  const loading = ref(false)
  const tableRows = ref([])
  const tableColumns = ref([])
  const tableColumnsKey = ref('')
  const orderBy = ref([])
  const filters = ref([])
  const totalQueryKey = ref('')
  const queryTimeoutSeconds = ref(normalizeDatabaseQueryTimeout(connection.timeoutSeconds))
  const queryStatus = reactive({
    truncated: false,
    truncationReason: '',
    resultBytes: 0,
    rowCount: 0
  })
  const requestGuard = createLatestRequestGuard(['table'])
  const pagination = reactive({ current: 1, pageSize: DEFAULT_PAGE_SIZE_SMALL, total: 0 })
  let activeController = null

  const cancelActiveRequest = () => {
    activeController?.abort()
    activeController = null
  }

  const resetQueryStatus = () => {
    queryStatus.truncated = false
    queryStatus.truncationReason = ''
    queryStatus.resultBytes = 0
    queryStatus.rowCount = 0
  }

  const invalidate = ({ clearRows = false, clearColumns = false } = {}) => {
    cancelActiveRequest()
    requestGuard.invalidate(['table'])
    loading.value = false
    tableColumnsKey.value = ''
    totalQueryKey.value = ''
    if (clearRows) tableRows.value = []
    if (clearColumns) tableColumns.value = []
    if (clearRows) resetQueryStatus()
  }

  const resetQuery = () => {
    requestGuard.invalidate(['table'])
    orderBy.value = []
    filters.value = []
    totalQueryKey.value = ''
    pagination.current = 1
    pagination.total = 0
  }

  const applyQuery = async ({ orderBy: nextOrderBy = [], filters: nextFilters = [] } = {}) => {
    const normalized = normalizeDatabaseTableQuery({
      orderBy: nextOrderBy,
      filters: nextFilters
    })
    orderBy.value = normalized.orderBy
    filters.value = normalized.filters
    totalQueryKey.value = ''
    pagination.current = 1
    pagination.total = 0
    if (selectedObject.value?.kind !== DATABASE_OBJECT_KINDS.TABLE) return false
    return loadTableRows(selectedObject.value, 1, pagination.pageSize)
  }

  const setQueryTimeout = (value) => {
    queryTimeoutSeconds.value = normalizeDatabaseQueryTimeout(value)
  }

  watch(
    () => [connection.connectionId, connection.timeoutSeconds],
    () => setQueryTimeout(connection.timeoutSeconds)
  )

  const loadTableRows = async (
    objectRef = selectedObject.value,
    page = 1,
    pageSize = null,
    forceColumns = false
  ) => {
    const tableRef = normalizeDatabaseObjectRef(objectRef)
    if (tableRef.kind !== DATABASE_OBJECT_KINDS.TABLE || !tableRef.name) return false

    cancelActiveRequest()
    const controller = new AbortController()
    activeController = controller
    const requestVersion = requestGuard.next('table')
    const columnsKey = getDatabaseObjectCacheKey({
      connection,
      objectRef: tableRef
    })
    const tableChanged = tableColumnsKey.value !== columnsKey
    const queryKey = `${columnsKey}|${JSON.stringify({
      orderBy: orderBy.value,
      filters: filters.value
    })}`

    if (pageSize !== null) pagination.pageSize = pageSize
    pagination.current = page
    if (tableChanged) tableRows.value = []
    resetQueryStatus()
    loading.value = true

    try {
      if (forceColumns || tableColumnsKey.value !== columnsKey) {
        const columnsResponse = await sqlEngine.getTableColumns({
          sessionId,
          connection,
          objectRef: tableRef,
          signal: controller.signal
        })
        if (!requestGuard.isCurrent('table', requestVersion)) return false
        const columns = Array.isArray(columnsResponse?.data?.columns)
          ? columnsResponse.data.columns
          : []
        tableColumns.value = columns.map((column) => ({
          name: column.name,
          type: column.type || '',
          nullable: column.nullable,
          defaultValue: column.defaultValue,
          length: column.length ?? null,
          precision: column.precision ?? null,
          scale: column.scale ?? null,
          primaryKey: !!column.primaryKey,
          comment: column.comment || ''
        }))
        tableColumnsKey.value = columnsKey
      }

      const queryResponse = await sqlEngine.queryTable({
        sessionId,
        connection,
        objectRef: tableRef,
        page: pagination.current,
        pageSize: pagination.pageSize,
        includeTotal:
          tableChanged ||
          forceColumns ||
          totalQueryKey.value !== queryKey,
        queryTimeoutSeconds: queryTimeoutSeconds.value,
        columns: tableColumns.value.map((column) => column.name),
        orderBy: orderBy.value,
        filters: filters.value,
        signal: controller.signal
      })
      if (!requestGuard.isCurrent('table', requestVersion)) return false

      const data = queryResponse?.data || {}
      tableRows.value = normalizeQueryRows({
        queryColumns: data.columns,
        rows: data.rows,
        fallbackColumns: tableColumns.value
      }).rows
      queryStatus.truncated = data.truncated === true
      queryStatus.truncationReason = data.truncationReason || ''
      queryStatus.resultBytes = Number(data.resultBytes || 0)
      queryStatus.rowCount = Number(data.rowCount ?? tableRows.value.length)
      if (data.pagination?.total !== undefined && data.pagination?.total !== null) {
        pagination.total = Number(data.pagination.total)
        totalQueryKey.value = queryKey
      }
      return true
    } catch (error) {
      if (!isCanceledDatabaseRequest(error) && requestGuard.isCurrent('table', requestVersion)) {
        onError?.(error)
      }
      return false
    } finally {
      if (requestGuard.isCurrent('table', requestVersion)) {
        loading.value = false
        if (activeController === controller) activeController = null
      }
    }
  }

  if (getCurrentScope()) onScopeDispose(cancelActiveRequest)

  return {
    loading,
    tableRows,
    tableColumns,
    orderBy,
    filters,
    queryTimeoutSeconds,
    queryStatus,
    pagination,
    invalidate,
    cancelActiveRequest,
    resetQuery,
    applyQuery,
    setQueryTimeout,
    loadTableRows
  }
}
