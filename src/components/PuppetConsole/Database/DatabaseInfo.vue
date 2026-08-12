<template>
  <div class="database-info database-info-shell">
    <!-- 数据库操作工具栏 -->
    <div class="database-toolbar database-info-header">
      <div class="toolbar-left">
        <h3 class="toolbar-title database-info-title">
          <el-icon class="title-icon database-info-title-icon">
            <Icon :icon="iconMap.database" />
          </el-icon>
          {{ currentDatabase || '未选择数据库' }}
        </h3>
      </div>
      <div class="toolbar-right database-info-toolbar">
        <el-button
          :loading="loading"
          size="small"
          @click="handleRefresh"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          刷新
        </el-button>
        <el-button
          v-if="canCreateTable"
          type="primary"
          size="small"
          @click="handleCreateTable"
        >
          <el-icon><Icon :icon="iconMap.documentAdd" /></el-icon>
          新建表
        </el-button>
        <el-button
          v-if="canExportDatabase"
          type="success"
          size="small"
          @click="handleExport"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          导出数据库
        </el-button>
      </div>
    </div>

    <el-descriptions
      :column="2"
      border
      class="database-info-descriptions"
    >
      <el-descriptions-item :label="`${namespaceTypeLabel}名称`">
        <el-tag
          type="primary"
          size="large"
        >
          <el-icon><Icon :icon="iconMap.database" /></el-icon>
          {{ currentDatabase || '-' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="数据库类型">
        <el-tag
          :type="getDialectTag()"
          size="large"
        >
          {{ getDialectDisplay() }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="连接状态">
        <el-tag
          :type="isConnected ? 'success' : 'info'"
          size="small"
        >
          <el-icon>
            <Icon :icon="isConnected ? iconMap.success : iconMap.close" />
          </el-icon>
          {{ isConnected ? '已连接' : '未连接' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="表总数">
        <el-statistic :value="tableCount" />
      </el-descriptions-item>
    </el-descriptions>

    <div class="info-section database-info-section">
      <div class="section-header database-info-section-header">
        <h3 class="database-info-section-title">
          <el-icon><Icon :icon="iconMap.table" /></el-icon>
          数据表列表
        </h3>
        <el-input
          v-model="searchText"
          placeholder="搜索表名..."
          size="small"
          clearable
          style="width: 12.5rem"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>
      </div>

      <el-table
        v-loading="loading"
        :data="filteredTables"
        border
        stripe
        max-height="400"
        style="width: 100%"
        @row-click="openTable"
      >
        <el-table-column
          label="表名"
          min-width="200"
        >
          <template #default="{ row }">
            <div class="table-name-cell">
              <el-icon class="table-icon">
                <Icon :icon="iconMap.table" />
              </el-icon>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="comment"
          label="注释"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          label="操作"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click.stop="openTable(row)"
            >
              <el-icon><Icon :icon="iconMap.view" /></el-icon>
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页组件 -->
      <div
        v-if="pagination.total > 0"
        class="pagination-container"
      >
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, prev, pager, next, sizes"
          size="small"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

import { icons } from '@/utils/icons.js'
import { getDialectTagType } from '@/utils/database.js'
import sqlEngine from './SqlEngine.js'
import { normalizeDatabaseObjectRef } from './database-domain.js'

const iconMap = icons

const props = defineProps({
  connection: {
    type: Object,
    required: true
  },
  connected: {
    type: Boolean,
    default: false
  },
  objectRef: {
    type: Object,
    default: null
  },
  tables: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits([
  'refresh-namespace',
  'export-database',
  'create-table',
  'select-object'
])

const normalizedObjectRef = computed(() => normalizeDatabaseObjectRef(props.objectRef))
const currentDatabase = computed(() =>
  normalizedObjectRef.value.catalog || normalizedObjectRef.value.schema || ''
)
const namespaceTypeLabel = computed(() =>
  normalizedObjectRef.value.kind === 'schema' ? 'Schema' : '数据库'
)
const searchText = ref('')
const isConnected = computed(() => props.connected && !!currentDatabase.value)

// 分页相关
const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0
})

const tableCount = computed(() => props.tables.length)
const dialectCapabilities = computed(() => sqlEngine.getCapabilities(props.connection.dialect))
const canCreateTable = computed(() => dialectCapabilities.value.createTable === true)
const canExportDatabase = computed(() => dialectCapabilities.value.exportDatabase === true)

// 过滤后的表列表（不含分页）
const filteredTablesAll = computed(() => {
  if (!searchText.value) {
    return props.tables
  }
  const search = searchText.value.toLowerCase()
  return props.tables.filter((table) => table.name?.toLowerCase().includes(search))
})

// 分页后的表列表
const filteredTables = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  return filteredTablesAll.value.slice(start, end)
})

// 监听过滤结果变化，重置分页
watch(
  filteredTablesAll,
  () => {
    pagination.value.total = filteredTablesAll.value.length
    // 如果当前页超出范围，重置到第一页
    if (pagination.value.current > Math.ceil(pagination.value.total / pagination.value.pageSize)) {
      pagination.value.current = 1
    }
  },
  { immediate: true }
)

// 监听搜索文本变化，重置到第一页
watch(searchText, () => {
  pagination.value.current = 1
})

const getDialectDisplay = () => sqlEngine.getDialectName(props.connection.dialect)

const getDialectTag = () => getDialectTagType(props.connection.dialect)

const handleRefresh = () => {
  emit('refresh-namespace', props.objectRef)
}

const handleExport = () => {
  emit(
    'export-database',
    currentDatabase.value,
    props.tables.map((table) => ({ name: table.name, objectRef: table.objectRef })),
    props.objectRef
  )
}

const handleCreateTable = () => {
  emit('create-table', currentDatabase.value)
}

const openTable = (row) => {
  if (row.objectRef) emit('select-object', row.objectRef)
}

const handleSizeChange = (size) => {
  pagination.value.pageSize = size
  pagination.value.current = 1 // 改变每页数量时重置到第一页
}

const handleCurrentChange = (page) => {
  pagination.value.current = page
}

</script>

<style scoped>
@import '@/styles/database-info-shared.css';

.database-info {
  display: flex;
  flex-direction: column;
}

.database-toolbar {
  flex-shrink: 0;
}

.toolbar-left {
  flex: 1;
  min-width: 12.5rem;
}

.toolbar-right {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .database-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left {
    min-width: auto;
  }

  .toolbar-right {
    justify-content: flex-start;
  }

  .toolbar-right .el-button {
    flex: 1;
    min-width: 0;
  }
}

.info-section {
  flex-shrink: 0;
}

.info-section h3 {
  margin-bottom: 0;
}

.table-name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.table-icon {
  color: var(--el-color-primary);
  font-size: 1rem;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: color-mix(
    in srgb,
    var(--database-inspector-muted-surface) 70%,
    var(--database-inspector-panel-surface)
  );
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--el-spacing-base) 0 0;
  margin-top: var(--el-spacing-base);
}
</style>
