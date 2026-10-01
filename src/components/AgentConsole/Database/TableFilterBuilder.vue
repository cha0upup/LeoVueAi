<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-start"
    :width="720"
    trigger="click"
    popper-class="database-filter-popper"
  >
    <template #reference>
      <el-badge
        :value="filters.length"
        :hidden="filters.length === 0"
        class="filter-badge"
      >
        <el-button
          size="small"
          :type="filters.length ? 'primary' : 'default'"
          :plain="filters.length > 0"
        >
          筛选条件
        </el-button>
      </el-badge>
    </template>

    <div class="filter-panel">
      <div class="filter-panel-header">
        <strong>组合筛选</strong>
        <span>全部条件使用 AND 连接</span>
      </div>
      <div class="filter-condition-list">
        <div
          v-for="condition in drafts"
          :key="condition.key"
          class="filter-condition"
        >
          <el-select
            v-model="condition.field"
            clearable
            filterable
            placeholder="选择列"
            size="small"
            class="condition-field"
          >
            <el-option
              v-for="column in columns"
              :key="column.name"
              :label="column.name"
              :value="column.name"
            />
          </el-select>
          <el-select
            v-model="condition.operator"
            size="small"
            class="condition-operator"
          >
            <el-option
              v-for="operator in operators"
              :key="operator.value"
              :label="operator.label"
              :value="operator.value"
            />
          </el-select>
          <el-input
            v-if="operatorNeedsValue(condition.operator)"
            v-model="condition.value"
            clearable
            size="small"
            :placeholder="isListOperator(condition.operator) ? '多个值用逗号分隔' : '输入筛选值'"
            class="condition-value"
            @keyup.enter="apply"
          />
          <span
            v-else
            class="condition-value-placeholder"
          >无需输入值</span>
          <el-button
            size="small"
            text
            type="danger"
            aria-label="删除筛选条件"
            @click="remove(condition.key)"
          >
            删除
          </el-button>
        </div>
      </div>
      <div class="filter-panel-actions">
        <el-button
          size="small"
          text
          type="primary"
          :disabled="drafts.length >= maxConditions"
          @click="add"
        >
          + 添加条件
        </el-button>
        <span class="filter-panel-spacer" />
        <el-button
          size="small"
          @click="clear"
        >
          清空
        </el-button>
        <el-button
          size="small"
          type="primary"
          @click="apply"
        >
          应用
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, watch } from 'vue'

import {
  DATABASE_FILTER_OPERATORS,
  createDatabaseFilterDraft,
  hydrateDatabaseFilterDrafts,
  operatorNeedsValue,
  serializeDatabaseFilters
} from './database-table-query.js'

const props = defineProps({
  columns: { type: Array, default: () => [] },
  filters: { type: Array, default: () => [] }
})

const emit = defineEmits(['apply', 'clear'])
const visible = ref(false)
const drafts = ref(hydrateDatabaseFilterDrafts(props.filters))
const operators = DATABASE_FILTER_OPERATORS
const maxConditions = 10

watch(
  () => props.filters,
  (filters) => {
    drafts.value = hydrateDatabaseFilterDrafts(filters)
  },
  { deep: true }
)

const isListOperator = (operator) => ['in', 'not_in'].includes(operator)

const add = () => {
  if (drafts.value.length >= maxConditions) return
  drafts.value.push(createDatabaseFilterDraft())
}

const remove = (key) => {
  drafts.value = drafts.value.filter((condition) => condition.key !== key)
  if (drafts.value.length === 0) drafts.value.push(createDatabaseFilterDraft())
}

const apply = () => {
  emit('apply', serializeDatabaseFilters(drafts.value))
  visible.value = false
}

const clear = () => {
  drafts.value = hydrateDatabaseFilterDrafts([])
  emit('clear')
  visible.value = false
}
</script>

<style scoped>
.filter-badge {
  display: inline-flex;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: var(--el-text-color-primary);
}

.filter-panel-header span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.filter-condition-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.filter-condition {
  display: flex;
  align-items: center;
  gap: 8px;
}

.condition-field {
  width: 180px;
}

.condition-operator {
  width: 150px;
}

.condition-value,
.condition-value-placeholder {
  flex: 1;
  min-width: 180px;
}

.condition-value-placeholder {
  padding: 0 11px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.filter-panel-actions {
  display: flex;
  align-items: center;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.filter-panel-spacer {
  flex: 1;
}
</style>
