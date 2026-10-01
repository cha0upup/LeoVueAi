<template>
  <div class="table-structure">
    <div class="structure-toolbar">
      <div class="toolbar-left">
        <el-button
          size="small"
          :loading="loading"
          @click="handleRefresh"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          刷新
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchText"
          placeholder="搜索字段名..."
          size="small"
          clearable
          style="width: 12.5rem"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredColumns"
      border
      stripe
      height="calc(100% - 3.75rem)"
      style="width: 100%"
    >
      <el-table-column
        prop="name"
        label="字段名"
        min-width="150"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <div class="column-name">
            <el-icon
              v-if="row.primaryKey"
              class="primary-key-icon"
            >
              <Icon :icon="iconMap.key" />
            </el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        prop="type"
        label="类型"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column
        prop="length"
        label="长度"
        width="100"
        align="center"
      >
        <template #default="{ row }">
          {{ row.length || row.precision || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="nullable"
        label="允许NULL"
        width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag
            :type="isNullable(row.nullable) ? 'success' : 'info'"
            size="small"
          >
            {{ isNullable(row.nullable) ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="defaultValue"
        label="默认值"
        width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span class="default-value">{{ formatDefaultValue(row.defaultValue) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="comment"
        label="注释"
        min-width="200"
        show-overflow-tooltip
      />
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

import { icons } from '@/utils/icons.js'

const iconMap = icons

const props = defineProps({
  tableColumns: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['refresh'])

const searchText = ref('')

const filteredColumns = computed(() => {
  if (!searchText.value) {
    return props.tableColumns
  }
  const search = searchText.value.toLowerCase()
  return props.tableColumns.filter(
    (col) =>
      col.name?.toLowerCase().includes(search) ||
      col.type?.toLowerCase().includes(search) ||
      col.comment?.toLowerCase().includes(search)
  )
})

const isNullable = (nullable) => {
  return nullable === 'YES' || nullable === true || nullable === 1
}

const formatDefaultValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

const handleRefresh = () => {
  emit('refresh')
}

</script>

<style scoped>
.table-structure {
  --table-structure-muted-surface: var(--app-control-background-soft);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-overlay);
}

:global(html:not(.dark) .table-structure),
:global(html[data-theme='light'] .table-structure) {
  --table-structure-muted-surface: #f2f2f2;
}

.structure-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--el-spacing-base) var(--el-spacing-large);
  background: var(--table-structure-muted-surface);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.toolbar-left {
  display: flex;
  gap: var(--el-spacing-base);
}

.toolbar-right {
  display: flex;
  gap: var(--el-spacing-base);
}

.column-name {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.primary-key-icon {
  color: var(--el-color-warning);
  font-size: 0.875rem;
}

.default-value {
  font-family: var(--el-font-family-mono, monospace);
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}
</style>
