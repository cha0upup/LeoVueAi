<template>
  <div class="main-content">
    <div class="top-bar">
      <div class="breadcrumb context-breadcrumb">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item v-if="currentDatabase">
            <el-icon>
              <Icon :icon="iconMap.database" />
            </el-icon>
            {{ currentDatabase }}
          </el-breadcrumb-item>
          <el-breadcrumb-item v-if="currentSchema && currentSchema !== currentDatabase">
            <el-icon>
              <Icon :icon="iconMap.folderOpened" />
            </el-icon>
            {{ currentSchema }}
          </el-breadcrumb-item>
          <el-breadcrumb-item v-if="currentTable">
            <el-icon>
              <Icon :icon="iconMap.document" />
            </el-icon>
            {{ currentTable }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div
        v-if="showTableActions"
        class="table-actions"
      >
        <el-button-group class="action-group">
          <el-tooltip
            content="新增"
            placement="top"
          >
            <el-button
              v-if="canInsert"
              type="primary"
              size="small"
              class="action-btn"
              @click="emit('add-row')"
            >
              <el-icon>
                <Icon :icon="iconMap.plus" />
              </el-icon>
              新增
            </el-button>
          </el-tooltip>
          <el-tooltip
            content="编辑"
            placement="top"
          >
            <el-button
              v-if="canUpdate"
              type="primary"
              plain
              size="small"
              class="action-btn"
              :disabled="selectedRowsCount === 0 || selectedRowsCount > 1"
              @click="emit('edit-selected')"
            >
              <el-icon>
                <Icon :icon="iconMap.edit" />
              </el-icon>
              编辑
            </el-button>
          </el-tooltip>
          <el-tooltip
            content="删除"
            placement="top"
          >
            <el-button
              v-if="canDelete"
              size="small"
              type="danger"
              class="action-btn"
              :disabled="selectedRowsCount === 0"
              @click="emit('delete-selected')"
            >
              <el-icon>
                <Icon :icon="iconMap.delete" />
              </el-icon>
              删除
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-button-group class="action-group">
          <el-tooltip
            content="刷新"
            placement="top"
          >
            <el-button
              :loading="loading"
              class="action-btn"
              size="small"
              aria-label="刷新数据表"
              @click="emit('refresh-table')"
            >
              <el-icon>
                <Icon :icon="iconMap.refresh" />
              </el-icon>
            </el-button>
          </el-tooltip>

          <el-tooltip
            content="导出数据"
            placement="top"
          >
            <el-button
              v-if="canExportTable"
              :disabled="!tableRows.length"
              class="action-btn"
              size="small"
              type="success"
              aria-label="导出表数据"
              @click="emit('export-data')"
            >
              <el-icon>
                <Icon :icon="iconMap.download" />
              </el-icon>
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
    </div>

    <div
      v-if="workspaceView === 'connection-info'"
      class="connection-info-view"
    >
      <ConnectionInfo
        :connection="connection"
        :status="connectionStatus"
        :error-message="connectionError"
        :details="connectionDetails"
        @retry="emit('retry-connection')"
      />
    </div>

    <div
      v-else-if="workspaceView === 'connecting'"
      class="connection-state-view"
    >
      <el-icon class="connection-state-icon is-loading">
        <Icon :icon="iconMap.refresh" />
      </el-icon>
      <h3>正在连接数据库</h3>
      <p>连接成功后会加载数据库结构。</p>
    </div>

    <div
      v-else-if="workspaceView === 'error'"
      class="connection-state-view"
    >
      <el-icon class="connection-state-icon is-error">
        <Icon :icon="iconMap.close" />
      </el-icon>
      <h3>数据库连接失败</h3>
      <p>{{ connectionError || '请检查连接配置后重试。' }}</p>
      <el-button
        type="primary"
        @click="emit('retry-connection')"
      >
        重新连接
      </el-button>
    </div>

    <div
      v-else-if="workspaceView === 'tabs'"
      class="content-tabs"
    >
      <el-tabs
        v-model="localActiveSubTab"
        type="border-card"
        class="sub-tabs"
      >
        <el-tab-pane
          v-if="currentDatabase && !currentTable"
          :label="namespaceInfoLabel"
          name="database-info"
        >
          <template #label>
            <span class="tab-label">
              <el-icon><Icon :icon="iconMap.database" /></el-icon>
              {{ namespaceInfoLabel }}
            </span>
          </template>
          <DatabaseInfo
            :connection="connection"
            connected
            :object-ref="currentNamespaceRef"
            :tables="namespaceTables"
            :loading="namespaceTablesLoading"
            @refresh-namespace="(objectRef) => emit('refresh-namespace', objectRef)"
            @export-database="(...args) => emit('export-database', ...args)"
            @create-table="(database) => emit('create-table', database)"
            @select-object="(objectRef) => emit('select-object', objectRef)"
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="currentTable"
          label="表数据"
          name="data"
        >
          <template #label>
            <span class="tab-label">
              <el-icon><Icon :icon="iconMap.table" /></el-icon>
              表数据
            </span>
          </template>
          <DatabaseTable
            v-model:pagination="pagination"
            :loading="loading"
            :table-columns="tableColumns"
            :rows="tableRows"
            :filters="tableFilters"
            :order-by="tableOrderBy"
            :query-status="queryStatus"
            :query-timeout-seconds="queryTimeoutSeconds"
            @page-change="(page) => emit('page-change', page)"
            @size-change="(size) => emit('size-change', size)"
            @selection-change="(selection) => emit('selection-change', selection)"
            @query-change="(query) => emit('query-change', query)"
            @query-timeout-change="(value) => emit('query-timeout-change', value)"
            @cancel-query="emit('cancel-query')"
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="currentTable"
          label="表结构"
          name="structure"
        >
          <template #label>
            <span class="tab-label">
              <el-icon><Icon :icon="iconMap.list" /></el-icon>
              表结构
            </span>
          </template>
          <TableStructure
            :table-columns="tableColumns"
            :loading="loading"
            @refresh="emit('refresh-table')"
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="currentTable"
          label="表信息"
          name="table-info"
        >
          <template #label>
            <span class="tab-label">
              <el-icon><Icon :icon="iconMap.info" /></el-icon>
              表信息
            </span>
          </template>
          <TableInfo
            v-model:pagination="pagination"
            :object-ref="normalizedSelection"
            :table-columns="tableColumns"
            :table-info="tableInfo"
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="canRawSql"
          label="SQL 查询"
          name="query"
        >
          <template #label>
            <span class="tab-label">
              <el-icon><Icon :icon="iconMap.code" /></el-icon>
              SQL 查询
            </span>
          </template>
          <SqlQuery
            :session-id="sessionId"
            :connection="connection"
            connected
            :current-database="currentDatabase"
          />
        </el-tab-pane>
      </el-tabs>
    </div>

    <div
      v-else-if="workspaceView === 'selection-empty'"
      class="empty-prompt"
    >
      <el-empty description="请从左侧选择数据库、Schema 或表" />
    </div>

    <div
      v-else
      class="empty-prompt"
    >
      <el-empty description="请先建立数据库连接">
        <el-icon class="empty-icon">
          <Icon :icon="iconMap.database" />
        </el-icon>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'
import sqlEngine from './SqlEngine.js'
import { DATABASE_OBJECT_KINDS, normalizeDatabaseObjectRef } from './database-domain.js'
import ConnectionInfo from './ConnectionInfo.vue'
import DatabaseInfo from './DatabaseInfo.vue'
import DatabaseTable from './DatabaseTable.vue'
import SqlQuery from './SqlQuery.vue'
import TableInfo from './TableInfo.vue'
import TableStructure from './TableStructure.vue'

const iconMap = icons

const pagination = defineModel('pagination', { type: Object, required: true })

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  connection: {
    type: Object,
    required: true
  },
  connectionStatus: {
    type: String,
    default: 'idle'
  },
  connectionError: {
    type: String,
    default: ''
  },
  connectionDetails: {
    type: Object,
    default: () => ({})
  },
  selectedObject: {
    type: Object,
    default: null
  },
  activeSubTab: {
    type: String,
    required: true
  },
  showConnectionInfo: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  tableRows: {
    type: Array,
    default: () => []
  },
  namespaceTables: {
    type: Array,
    default: () => []
  },
  namespaceTablesLoading: {
    type: Boolean,
    default: false
  },
  tableColumns: {
    type: Array,
    default: () => []
  },
  tableFilters: {
    type: Array,
    default: () => []
  },
  tableOrderBy: {
    type: Array,
    default: () => []
  },
  queryStatus: {
    type: Object,
    default: () => ({})
  },
  queryTimeoutSeconds: {
    type: Number,
    default: 30
  },
  tableInfo: {
    type: Object,
    required: true
  },
  selectedRowsCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'update:activeSubTab',
  'add-row',
  'edit-selected',
  'delete-selected',
  'refresh-table',
  'export-data',
  'export-database',
  'create-table',
  'select-object',
  'refresh-namespace',
  'page-change',
  'size-change',
  'selection-change',
  'query-change',
  'query-timeout-change',
  'cancel-query',
  'retry-connection'
])

const dialectCapabilities = computed(() => sqlEngine.getCapabilities(props.connection.dialect))
const canRawSql = computed(() => dialectCapabilities.value.rawSql === true)
const canInsert = computed(() => dialectCapabilities.value.insert === true)
const canUpdate = computed(() => dialectCapabilities.value.update === true)
const canDelete = computed(() => dialectCapabilities.value.delete === true)
const canExportTable = computed(() => dialectCapabilities.value.exportTable === true)

const normalizedSelection = computed(() =>
  props.selectedObject ? normalizeDatabaseObjectRef(props.selectedObject) : null
)
const currentDatabase = computed(() =>
  normalizedSelection.value?.catalog || normalizedSelection.value?.schema || ''
)
const currentTable = computed(() =>
  normalizedSelection.value?.kind === DATABASE_OBJECT_KINDS.TABLE
    ? normalizedSelection.value.name
    : ''
)
const currentSchema = computed(() => normalizedSelection.value?.schema || '')
const hasVisibleTabs = computed(() => Boolean(currentDatabase.value || canRawSql.value))
const workspaceView = computed(() => {
  if (props.showConnectionInfo) return 'connection-info'
  if (props.connectionStatus === 'connecting') return 'connecting'
  if (props.connectionStatus === 'error') return 'error'
  if (props.connectionStatus === 'ready') {
    return hasVisibleTabs.value ? 'tabs' : 'selection-empty'
  }
  return 'connection-empty'
})
const showTableActions = computed(
  () =>
    workspaceView.value === 'tabs' &&
    props.activeSubTab === 'data' &&
    Boolean(currentTable.value)
)
const currentNamespaceRef = computed(() =>
  normalizedSelection.value?.kind === DATABASE_OBJECT_KINDS.TABLE
    ? null
    : normalizedSelection.value
)
const namespaceInfoLabel = computed(() =>
  normalizedSelection.value?.kind === DATABASE_OBJECT_KINDS.SCHEMA
    ? 'Schema 信息'
    : '数据库信息'
)

const localActiveSubTab = computed({
  get: () => props.activeSubTab,
  set: (value) => emit('update:activeSubTab', value)
})
</script>

<style scoped>
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--database-console-panel-surface);
  border: 0;
  border-radius: 0;
  box-shadow: none;
  height: 100%;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 7px 12px;
  background: color-mix(
    in srgb,
    var(--database-console-muted-surface) 88%,
    var(--database-console-panel-surface)
  );
  border-bottom: 1px solid var(--database-console-soft-border);
  border-radius: 0;
}

.breadcrumb {
  flex: 1;
}

.context-breadcrumb {
  min-width: 0;
}

.breadcrumb :deep(.el-breadcrumb__inner) {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.table-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-group {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  border-radius: var(--el-border-radius-small);
  font-size: var(--el-font-size-small);
  padding: var(--el-spacing-small) var(--el-spacing-large);
  height: 2rem;
  font-weight: 600;
  transition: all var(--el-transition-duration) var(--el-transition-function);
}

.action-btn:hover:not(:disabled) {
  transform: none;
  box-shadow: none;
}

.action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.connection-info-view {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin: 0;
  background: var(--database-console-panel-surface);
  border-radius: var(--el-border-radius-base);
}

.content-tabs {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin: 0;
}

.sub-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sub-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: color-mix(
    in srgb,
    var(--database-console-muted-surface) 84%,
    var(--database-console-panel-surface)
  );
  border-bottom: 1px solid var(--database-console-soft-border);
}

.sub-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0 8px;
}

.sub-tabs :deep(.el-tabs__item) {
  height: 36px;
  padding: 0 12px;
  font-size: 12px;
}

.sub-tabs :deep(.el-tabs__item.is-active) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
}

.sub-tabs.el-tabs--border-card {
  border: 0;
  box-shadow: none;
}

.sub-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.sub-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: auto;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--el-font-size-base);
}

.empty-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.connection-state-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
}

.connection-state-view h3,
.connection-state-view p {
  margin: 0;
}

.connection-state-view p {
  max-width: 36rem;
  color: var(--el-text-color-secondary);
  word-break: break-word;
}

.connection-state-icon {
  font-size: 32px;
  color: var(--el-color-primary);
}

.connection-state-icon.is-error {
  color: var(--el-color-danger);
}

.empty-icon {
  font-size: 3rem;
  color: var(--el-text-color-placeholder);
  margin-bottom: var(--el-spacing-large);
}

@media (max-width: 1100px) {
  .main-content {
    width: 100%;
    height: auto;
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .table-actions {
    justify-content: space-between;
    flex-wrap: wrap;
  }
}
</style>
