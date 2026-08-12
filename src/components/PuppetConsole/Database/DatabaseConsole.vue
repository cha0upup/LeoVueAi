<template>
  <div class="database-console">
    <DatabaseConsoleSidebar
      :connection="connection"
      :namespaces="namespaces"
      :namespaces-loading="namespacesLoading"
      :tree-revision="treeRevision"
      :load-tables="loadNamespaceTables"
      :connection-status="connectionStatus"
      :show-connection-info="showConnectionInfo"
      :refreshing="refreshing"
      @toggle-connection-info="toggleConnectionInfo"
      @open-create-db="openCreateDb"
      @refresh-structure="refreshStructure"
      @select-object="selectObject"
    />

    <DatabaseConsoleWorkspace
      v-model:active-sub-tab="activeSubTab"
      v-model:pagination="pagination"
      :session-id="sessionId"
      :connection="connection"
      :connection-status="connectionStatus"
      :connection-error="connectionError"
      :connection-details="connectionDetails"
      :selected-object="selectedObject"
      :show-connection-info="showConnectionInfo"
      :loading="loading"
      :table-rows="tableRows"
      :namespace-tables="namespaceTables"
      :namespace-tables-loading="namespaceTablesLoading"
      :table-columns="tableColumns"
      :table-filters="filters"
      :table-order-by="orderBy"
      :query-status="queryStatus"
      :query-timeout-seconds="queryTimeoutSeconds"
      :table-info="tableInfo"
      :selected-rows-count="selectedRowsCount"
      @add-row="showAddRowDialog"
      @edit-selected="handleEditSelected"
      @delete-selected="handleDeleteSelected"
      @refresh-table="refreshCurrentTable"
      @export-data="exportData"
      @export-database="exportDatabase"
      @create-table="openCreateTableFromTree"
      @select-object="selectObject"
      @refresh-namespace="refreshNamespace"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
      @selection-change="handleTableSelectionChange"
      @query-change="applyQuery"
      @query-timeout-change="setQueryTimeout"
      @cancel-query="cancelActiveRequest"
      @retry-connection="connectDatabase"
    />

    <CreateTableDialog
      v-model:visible="createTableVisible"
      :session-id="sessionId"
      :connection="connection"
      :database="newTableDatabase"
      :object-ref="currentNamespaceRef"
      @success="handleCreateTableSuccess"
    />

    <AddRowDialog
      v-model:visible="addRowDialogVisible"
      :table-columns="tableColumns"
      :loading="loading"
      :connection="connection"
      :object-ref="currentTableRef"
      :session-id="sessionId"
      @success="handleAddRowSuccess"
    />

    <EditRowDialog
      v-model:visible="editRowDialogVisible"
      :table-columns="tableColumns"
      :row-data="editingRowData"
      :original-row-data="editingOriginalRowData"
      :loading="loading"
      :connection="connection"
      :object-ref="currentTableRef"
      :session-id="sessionId"
      @success="handleEditRowSuccess"
    />
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { executeDeleteWithConfirm } from '@/utils/confirmUtils.js'
import sqlEngine from './SqlEngine.js'
import { taskEngine } from '../File/TaskEngine.js'
import AddRowDialog from './AddRowDialog.vue'
import DatabaseConsoleSidebar from './DatabaseConsoleSidebar.vue'
import DatabaseConsoleWorkspace from './DatabaseConsoleWorkspace.vue'
import EditRowDialog from './EditRowDialog.vue'
import CreateTableDialog from './CreateTableDialog.vue'
import { getTableColumnNames } from './database-table-model.js'
import { createTableRef, DATABASE_OBJECT_KINDS } from './database-domain.js'
import { useDatabaseTableLoader } from './useDatabaseTableLoader.js'
import { useDatabaseWorkspaceSelection } from './useDatabaseWorkspaceSelection.js'
import { useDatabaseMetadataExplorer } from './useDatabaseMetadataExplorer.js'
import { useDatabaseConnectionState } from './useDatabaseConnectionState.js'
import { showError, showMessage, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { formatDatabaseError } from '@/utils/databaseError.js'
import {
  deleteRowsData as deleteRowsDataUtil,
  exportTableData as exportTableDataUtil,
  performDatabaseExport as performDatabaseExportUtil,
  DATABASE_MESSAGES,
  DATABASE_DIALOG_CONFIG
} from '@/utils/database.js'

const props = defineProps({
  sessionId: { type: String, required: true },
  connectionId: { type: String, default: '' },
  initialConnection: { type: Object, default: null }
})

const connection = reactive({
  connectionId: props.connectionId,
  dialect: '',
  connectionMode: 'standard',
  variant: '',
  host: '',
  port: null,
  database: '',
  service: '',
  sid: '',
  file: '',
  username: '',
  timeoutSeconds: 30,
  options: {},
  runtimeOptions: {},
  password: ''
})

const {
  status: connectionStatus,
  error: connectionError,
  details: connectionDetails,
  ready: connectionReady,
  connect: testConnection,
  reset: resetConnectionState
} = useDatabaseConnectionState({
  sessionId: props.sessionId,
  connection,
  sqlEngine
})

const {
  selectedObject,
  currentDatabase,
  currentTable,
  currentNamespaceRef,
  currentTableRef,
  selectObject: updateSelectedObject,
  clearSelection
} = useDatabaseWorkspaceSelection()
const refreshing = ref(false)
const {
  namespaces,
  namespacesLoading,
  treeRevision,
  getTables: getCachedNamespaceTables,
  isTablesLoading,
  loadNamespaces,
  loadTables: loadNamespaceTables,
  refreshNamespaces,
  refreshTables,
  reset: resetMetadata
} = useDatabaseMetadataExplorer({
  sessionId: props.sessionId,
  connection,
  sqlEngine,
  onError: (error, fallback) => showError(formatDatabaseError(error, fallback))
})
const namespaceTables = computed(() =>
  currentNamespaceRef.value ? getCachedNamespaceTables(currentNamespaceRef.value) : []
)
const namespaceTablesLoading = computed(() =>
  currentNamespaceRef.value ? isTablesLoading(currentNamespaceRef.value) : false
)
const {
  loading,
  tableRows,
  tableColumns,
  orderBy,
  filters,
  queryStatus,
  queryTimeoutSeconds,
  pagination,
  invalidate,
  cancelActiveRequest,
  resetQuery,
  applyQuery,
  setQueryTimeout,
  loadTableRows
} =
  useDatabaseTableLoader({
    sessionId: props.sessionId,
    connection,
    selectedObject,
    sqlEngine,
    onError: (error) => showError(formatDatabaseError(error, DATABASE_MESSAGES.GET_DATA_FAILED))
  })
const tableInfo = computed(() => {
  const tableRef = currentTableRef.value
  if (!tableRef || !currentNamespaceRef.value) return { comment: '' }
  const metadata = getCachedNamespaceTables(currentNamespaceRef.value).find((table) =>
    table.objectRef?.catalog === tableRef.catalog &&
    table.objectRef?.schema === tableRef.schema &&
    table.objectRef?.name === tableRef.name
  )
  return { comment: metadata?.comment || '' }
})
// 子标签页状态
const activeSubTab = ref('database-info')
const showConnectionInfo = ref(false)

const createTableVisible = ref(false)
const newTableDatabase = ref('')

const addRowDialogVisible = ref(false)
const editRowDialogVisible = ref(false)
const editingRowData = reactive({})
const editingOriginalRowData = ref({})
const selectedRows = ref([])
const selectedRowsCount = ref(0)
watch(tableRows, () => {
  selectedRows.value = []
  selectedRowsCount.value = 0
})

const hasCapability = (capability) => sqlEngine.hasCapability(connection.dialect, capability)
const getDefaultWorkspaceTab = () => {
  if (currentTable.value) return 'data'
  if (currentDatabase.value) return 'database-info'
  return hasCapability('rawSql') ? 'query' : 'database-info'
}

const registerSqlExportTask = (snapshot) => {
  if (!snapshot?.taskId) return null

  const tableRefs = Array.isArray(snapshot.tableRefs) ? snapshot.tableRefs : []
  const localTaskId = taskEngine.createDbExportTask(
    props.sessionId,
    snapshot.database || currentDatabase.value || '',
    snapshot.tableCount ?? tableRefs.length,
    {
      connection: { ...connection },
      exportFormat: snapshot.format || 'zip',
      includeData:
        snapshot.includeData === null || snapshot.includeData === undefined
          ? true
          : snapshot.includeData,
      includeStructure:
        snapshot.includeStructure === null || snapshot.includeStructure === undefined
          ? true
          : snapshot.includeStructure
    }
  )

  taskEngine.hydrateDbExportTask(localTaskId, snapshot)
  return localTaskId
}

// 切换连接信息显示
const toggleConnectionInfo = () => {
  showConnectionInfo.value = !showConnectionInfo.value
  // 关闭连接信息时，如果有选中的数据库，自动切换到合适的标签页
  if (!showConnectionInfo.value && currentDatabase.value) {
    activeSubTab.value = currentTable.value ? 'data' : 'database-info'
  } else if (!showConnectionInfo.value) {
    activeSubTab.value = getDefaultWorkspaceTab()
  }
}

const openCreateDb = () => {
  if (!hasCapability('createDatabase')) {
    showWarning('当前 SQL 方言未开放新建数据库能力')
    return
  }
  if (!connectionReady.value) {
    showWarning(DATABASE_MESSAGES.CONFIG_REQUIRED)
    return
  }
  ElMessageBox.prompt('请输入新数据库名称', '新建数据库', DATABASE_DIALOG_CONFIG.CREATE_DB)
    .then(async ({ value }) => {
      try {
        await sqlEngine.createDatabase({
          sessionId: props.sessionId,
          connection,
          database: value
        })
        showSuccess(DATABASE_MESSAGES.CREATE_SUCCESS)
        refreshStructure()
      } catch {
        showError('创建数据库失败')
      }
    })
    .catch(() => {})
}

const openCreateTableFromTree = (dbName) => {
  if (!hasCapability('createTable')) {
    showWarning('当前 SQL 方言未开放新建数据表能力')
    return
  }
  if (!connectionReady.value) {
    showWarning(DATABASE_MESSAGES.CONFIG_REQUIRED)
    return
  }
  newTableDatabase.value = dbName || currentDatabase.value || ''
  createTableVisible.value = true
}

const handleCreateTableSuccess = () => {
  refreshStructure()
}
const refreshStructure = async () => {
  if (!connectionReady.value) {
    showWarning(DATABASE_MESSAGES.CONFIG_REQUIRED)
    return
  }

  refreshing.value = true
  invalidate()
  try {
    await refreshNamespaces()
    if (currentNamespaceRef.value) {
      await loadNamespaceTables(currentNamespaceRef.value)
    }
    if (currentTableRef.value) {
      await loadTableRows(
        currentTableRef.value,
        pagination.current,
        pagination.pageSize,
        true
      )
    }
  } finally {
    refreshing.value = false
  }
}

const refreshNamespace = async (objectRef = currentNamespaceRef.value) => {
  if (!objectRef) return
  await refreshTables(objectRef)
}

const refreshCurrentTable = async () => {
  if (!currentDatabase.value || !currentTable.value) return
  await loadTableRows(
    currentTableRef.value,
    pagination.current,
    pagination.pageSize,
    true
  )
}

const showAddRowDialog = () => {
  if (!currentTable.value) {
    showWarning(DATABASE_MESSAGES.TABLE_REQUIRED)
    return
  }
  addRowDialogVisible.value = true
}

const handleAddRowSuccess = async () => {
  if (currentDatabase.value && currentTable.value) {
    await loadTableRows(currentTableRef.value)
  }
}

const clearEditingData = () => {
  Object.keys(editingRowData).forEach((k) => delete editingRowData[k])
  editingOriginalRowData.value = {}
}

const handleEditRow = (rowData) => {
  clearEditingData()
  Object.assign(editingRowData, rowData)
  editingOriginalRowData.value = { ...rowData }
  editRowDialogVisible.value = true
}

const handleEditRowSuccess = async () => {
  if (currentDatabase.value && currentTable.value) {
    await loadTableRows(currentTableRef.value)
  }
  clearEditingData()
}

const handleTableSelectionChange = (selection) => {
  selectedRows.value = selection
  selectedRowsCount.value = selection.length
}

const handleEditSelected = () => {
  if (selectedRows.value.length === 0) {
    showWarning(DATABASE_MESSAGES.SELECT_ROW_REQUIRED)
    return
  }
  if (selectedRows.value.length > 1) {
    showWarning(DATABASE_MESSAGES.ONE_ROW_ONLY)
    return
  }

  handleEditRow(selectedRows.value[0])
}

const handleDeleteSelected = async () => {
  if (selectedRows.value.length === 0) {
    showWarning(DATABASE_MESSAGES.SELECT_DELETE_REQUIRED)
    return
  }

  await executeDeleteWithConfirm(
    async () => {
      const successCount = await deleteRowsDataUtil({
        sessionId: props.sessionId,
        connection,
        objectRef: currentTableRef.value,
        headers: getTableColumnNames(tableColumns.value),
        rows: selectedRows.value,
        columnsMeta: tableColumns.value,
        sqlEngine
      })

      if (successCount === selectedRows.value.length) {
        showSuccess(`成功删除 ${successCount} 条数据`)
      } else {
        showWarning(`成功删除 ${successCount}/${selectedRows.value.length} 条数据`)
      }

      selectedRows.value = []
      selectedRowsCount.value = 0

      if (currentDatabase.value && currentTable.value) {
        await loadTableRows(currentTableRef.value)
      }

      return { successCount }
    },
    {
      title: '确认删除',
      message: `确定要删除选中的 ${selectedRows.value.length} 条数据吗？此操作不可恢复。`,
      successMessage: null, // 在函数内部处理消息
      errorMessage: '删除失败',
      loadingRef: loading
    }
  )
}

const exportData = async () => {
  if (!currentDatabase.value || !currentTable.value) {
    showWarning(DATABASE_MESSAGES.SELECT_EXPORT_REQUIRED)
    return
  }

  if (tableRows.value.length === 0) {
    showWarning(DATABASE_MESSAGES.NO_DATA_EXPORT)
    return
  }

  const exportLoading = showMessage({
    message: '正在导出数据，请稍候...',
    type: 'info',
    duration: 0
  })

  try {
    await exportTableDataUtil({
      sessionId: props.sessionId,
      connection,
      databaseName: currentDatabase.value,
      tableName: currentTable.value,
      objectRef: currentTableRef.value,
      tableRows: tableRows.value,
      pagination,
      sqlEngine,
      onProgress: (message) => {
        exportLoading.message = message
      },
      onSuccess: (task) => {
        registerSqlExportTask(task)
        exportLoading.close()
        showSuccess(`导出任务已创建：${task?.fileName || currentTable.value}`)
      },
      onError: (error) => {
        exportLoading.close()
        showError(formatDatabaseError(error, DATABASE_MESSAGES.EXPORT_FAILED))
      }
    })
  } catch (error) {
    exportLoading.close()
    showError(formatDatabaseError(error, DATABASE_MESSAGES.EXPORT_FAILED))
  }
}

const exportDatabase = async (
  databaseName,
  selectedTables = null,
  objectRef = currentNamespaceRef.value
) => {
  if (!databaseName || !connection.dialect) {
    showWarning(DATABASE_MESSAGES.DATABASE_INFO_FAILED)
    return
  }

  let tableRefs

  if (selectedTables && selectedTables.length > 0) {
    tableRefs = selectedTables
      .map((table) => {
        if (typeof table === 'object' && (table?.objectRef || table?.ref)) {
          return table.objectRef || table.ref
        }
        const name = typeof table === 'string' ? table : table?.name
        return name ? createTableRef({ namespaceRef: objectRef, table: name }) : null
      })
      .filter((ref) => ref?.name)
  } else {
    try {
      let tableItems = getCachedNamespaceTables(objectRef)
      if (!tableItems.length) tableItems = await loadNamespaceTables(objectRef)
      tableRefs = tableItems.map((table) => table.objectRef).filter(Boolean)

      if (!tableRefs.length) {
        showWarning(DATABASE_MESSAGES.NO_TABLES)
        return
      }
    } catch (error) {
      showError(formatDatabaseError(error, DATABASE_MESSAGES.GET_TABLES_FAILED))
      return
    }
  }

  try {
    await performDatabaseExport(databaseName, objectRef, tableRefs)
  } catch (error) {
    showError(formatDatabaseError(error, DATABASE_MESSAGES.EXPORT_TASK_FAILED))
  }
}

const performDatabaseExport = async (
  databaseName,
  objectRef = null,
  tableRefs = null
) => {
  const task = await performDatabaseExportUtil({
    sessionId: props.sessionId,
    connection,
    objectRef,
    tableRefs,
    sqlEngine
  })

  registerSqlExportTask(task)

  showSuccess({
    message: `导出任务已创建：${task?.fileName || databaseName}`,
    duration: 5000
  })
}

const handlePageChange = async (page) => {
  if (!currentDatabase.value || !currentTable.value) return
  await loadTableRows(currentTableRef.value, page)
}

const handleSizeChange = async (size) => {
  if (!currentDatabase.value || !currentTable.value) return
  await loadTableRows(currentTableRef.value, 1, size)
}

const selectObject = async (objectRef) => {
  if (!connectionReady.value) return
  const changed = updateSelectedObject(objectRef)
  if (!selectedObject.value) return

  if (changed) {
    invalidate({ clearRows: true, clearColumns: true })
    resetQuery()
  }
  showConnectionInfo.value = false

  if (selectedObject.value.kind === DATABASE_OBJECT_KINDS.TABLE) {
    activeSubTab.value = 'data'
    if (changed) await loadTableRows(selectedObject.value)
  } else {
    activeSubTab.value = 'database-info'
    await loadNamespaceTables(selectedObject.value)
  }
}

const resetWorkspace = () => {
  invalidate({ clearRows: true, clearColumns: true })
  resetQuery()
  resetMetadata()
  clearSelection()
  selectedRows.value = []
  selectedRowsCount.value = 0
}

const connectDatabase = async () => {
  const wasReady = connectionReady.value
  if (!wasReady) resetWorkspace()
  showConnectionInfo.value = true
  activeSubTab.value = getDefaultWorkspaceTab()

  const connected = await testConnection()
  if (!connected) return

  if (!wasReady && hasCapability('listDatabases')) {
    await loadNamespaces()
  }
  activeSubTab.value = getDefaultWorkspaceTab()
}

onMounted(async () => {
  if (props.initialConnection) {
    const ic = props.initialConnection
    Object.assign(connection, ic)
    connection.username = ic.username || ''
    await connectDatabase()
  } else {
    resetConnectionState()
  }
})
</script>

<style scoped>
.database-console {
  --database-console-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --database-console-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 94%,
    var(--el-bg-color-overlay)
  );
  --database-console-soft-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
  display: flex;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  gap: 0;
  padding: 0;
}

:global(html:not(.dark) .database-console),
:global(html[data-theme='light'] .database-console) {
  --database-console-muted-surface: #f3f2ef;
  --database-console-panel-surface: #fbfbfa;
  --database-console-soft-border: rgba(24, 24, 27, 0.06);
}

:global(html.dark .database-console),
:global(html[data-theme='dark'] .database-console) {
  --database-console-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --database-console-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 86%,
    var(--el-bg-color-overlay)
  );
  --database-console-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

@media (max-width: 1100px) {
  .database-console {
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .database-console {
    padding: 0;
  }
}
</style>
