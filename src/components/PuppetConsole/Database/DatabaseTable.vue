<template>
  <div class="database-table-surface">
    <template v-if="tableColumns.length > 0">
      <div class="table-query-bar">
        <TableFilterBuilder
          :columns="tableColumns"
          :filters="filters"
          @apply="handleFilterApply"
          @clear="handleFilterClear"
        />
        <el-button
          v-if="orderBy.length"
          size="small"
          text
          @click="clearSort"
        >
          清除排序
        </el-button>
        <span class="timeout-label">超时</span>
        <el-input-number
          :model-value="queryTimeoutSeconds"
          :min="1"
          :max="300"
          :controls="false"
          size="small"
          class="timeout-input"
          aria-label="查询超时秒数"
          @change="(value) => emit('query-timeout-change', value)"
        />
        <span class="timeout-label">秒</span>
        <el-button
          v-if="loading"
          size="small"
          type="warning"
          plain
          @click="emit('cancel-query')"
        >
          停止等待
        </el-button>
        <span class="query-summary">
          <template v-if="filters.length">{{ filters.length }} 个筛选条件</template>
          <template v-if="filters.length && orderBy.length"> · </template>
          <template v-if="orderBy.length">按 {{ orderBy[0].field }} 排序</template>
          <template v-if="!filters.length && !orderBy.length">点击列标题可进行服务端排序</template>
          <template v-if="!loading && queryStatus.rowCount">
            · 本页 {{ queryStatus.rowCount }} 行<template v-if="resultSize"> / {{ resultSize }}</template>
          </template>
        </span>
      </div>
      <el-alert
        v-if="queryStatus.truncated"
        class="table-boundary-alert"
        :title="truncationMessage"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="rows"
        style="width: 100%"
        stripe
        highlight-current-row
        max-height="calc(100vh - 18.75rem)"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column
          type="selection"
          width="55"
          align="center"
          fixed="left"
        />
        <el-table-column
          v-for="column in tableColumns"
          :key="column.name"
          :label="column.name"
          :prop="column.name"
          show-overflow-tooltip
          :min-width="120"
          sortable="custom"
        >
          <template #default="scope">
            <div class="cell-content-wrapper">
              <span
                class="cell-content"
                :title="formatCellValue(scope.row[column.name], column)"
              >
                {{ formatCellValue(scope.row[column.name], column) }}
              </span>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <!-- 分页组件 -->
      <div
        v-if="pagination && pagination.total > pagination.pageSize"
        class="pagination-container"
      >
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 50, 100, 200, 500]"
          :total="pagination.total"
          layout="total, prev, pager, next, sizes"
          size="small"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatCellValue as formatCellValueUtil } from '@/utils/database.js'
import TableFilterBuilder from './TableFilterBuilder.vue'
import {
  formatDatabaseResultSize,
  getDatabaseTruncationMessage
} from './database-query-status.js'

const pagination = defineModel('pagination', {
  type: Object,
  default: () => ({
    current: 1,
    pageSize: 100,
    total: 0
  })
})

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  tableColumns: {
    type: Array,
    default: () => []
  },
  filters: {
    type: Array,
    default: () => []
  },
  orderBy: {
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
  }
})

const emit = defineEmits([
  'page-change',
  'size-change',
  'selection-change',
  'query-change',
  'query-timeout-change',
  'cancel-query'
])
const tableRef = ref(null)
const truncationMessage = computed(() => getDatabaseTruncationMessage(props.queryStatus))
const resultSize = computed(() => formatDatabaseResultSize(props.queryStatus.resultBytes))

const handleFilterApply = (filters) => {
  emit('query-change', { filters, orderBy: props.orderBy })
}

const handleFilterClear = () => {
  emit('query-change', { filters: [], orderBy: props.orderBy })
}

const handleSortChange = ({ prop, order }) => {
  emit('query-change', {
    filters: props.filters,
    orderBy: prop && order
      ? [{ field: prop, direction: order === 'descending' ? 'DESC' : 'ASC' }]
      : []
  })
}

const clearSort = () => {
  tableRef.value?.clearSort()
  emit('query-change', { filters: props.filters, orderBy: [] })
}
const handleCurrentChange = (page) => {
  emit('page-change', page)
}

const handleSizeChange = (size) => {
  emit('size-change', size)
}

const formatCellValue = (value, column) => formatCellValueUtil(value, column)

const handleSelectionChange = (selection) => {
  emit('selection-change', selection)
}
</script>

<style scoped>
.database-table-surface {
  --database-table-muted-surface: var(--app-control-background-soft);
  height: 100%;
  overflow: hidden;
}

.database-table-surface :deep(.el-table) {
  --el-table-border-color: color-mix(in srgb, var(--el-border-color) 42%, transparent);
  --el-table-header-bg-color: var(--database-table-muted-surface);
  font-size: 12px;
}

.database-table-surface :deep(.el-table__cell) {
  padding: 5px 0;
}

.table-query-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 6px 10px;
  background: var(--database-table-muted-surface);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.query-summary {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.timeout-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.timeout-input {
  width: 64px;
}

.table-boundary-alert {
  border-radius: 0;
}

:global(html:not(.dark) .database-table-surface),
:global(html[data-theme='light'] .database-table-surface) {
  --database-table-muted-surface: #f2f2f2;
}

.cell-content-wrapper {
  padding: 0.25rem 0;
}

.cell-content {
  word-break: break-all;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  font-size: 0.8125rem;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--el-spacing-base) var(--el-spacing-large);
  background: var(--database-table-muted-surface);
  border-top: 1px solid var(--el-border-color-lighter);
}

.el-table .cell {
  padding: 0.5rem;
}

.el-table th {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-weight: 600;
}

</style>
