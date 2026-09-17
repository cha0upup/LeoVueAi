<template>
  <section
    class="filter-shell"
    aria-label="任务筛选"
  >
    <div class="filter-heading">
      <div
        class="type-options"
        aria-label="任务类型"
      >
        <button
          v-for="option in typeOptions"
          :key="option.value"
          type="button"
          :aria-pressed="activeTaskType === option.value"
          @click="$emit('update:type', option.value)"
        >
          {{ option.label }} <span v-if="option.count">{{ option.count }}</span>
        </button>
      </div>
      <div class="filter-meta">
        <span>{{ resultCount }} 项</span>
        <slot name="sync" />
      </div>
    </div>
    <div class="filter-tools">
      <el-input
        :model-value="searchKeyword"
        aria-label="搜索任务"
        clearable
        size="small"
        placeholder="搜索名称、目标或任务编号"
        @update:model-value="$emit('update:search', $event)"
      >
        <template #prefix>
          <Icon icon="mdi:magnify" />
        </template>
      </el-input>
      <el-select
        :model-value="statusFilter"
        aria-label="任务状态"
        size="small"
        class="status-select"
        @update:model-value="$emit('update:status', $event)"
      >
        <el-option
          v-for="option in statusOptions"
          :key="option.value"
          :value="option.value"
          :label="option.label"
        >
          <span>{{ option.label }}</span><span class="option-count">{{ option.count }}</span>
        </el-option>
      </el-select>
      <el-select
        :model-value="sortOption"
        aria-label="任务排序"
        size="small"
        class="sort-select"
        @update:model-value="$emit('update:sort', $event)"
      >
        <el-option
          label="最新优先"
          value="latest"
        />
        <el-option
          label="最早优先"
          value="oldest"
        />
        <el-option
          label="进度优先"
          value="progress"
        />
        <el-option
          label="名称排序"
          value="name"
        />
      </el-select>
    </div>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue'
defineProps({
  typeOptions: { type: Array, default: () => [] },
  statusOptions: { type: Array, default: () => [] },
  activeTaskType: { type: String, default: 'all' },
  statusFilter: { type: String, default: 'all' },
  searchKeyword: { type: String, default: '' },
  sortOption: { type: String, default: 'latest' },
  resultCount: { type: Number, default: 0 }
})
defineEmits(['update:type', 'update:status', 'update:search', 'update:sort'])
</script>

<style scoped>
.filter-shell {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.filter-heading,
.type-options,
.filter-meta,
.filter-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.filter-heading {
  justify-content: space-between;
  flex-wrap: wrap;
}
.type-options {
  flex-wrap: wrap;
  gap: 4px;
}
.type-options button {
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  font-size: 12px;
  padding: 6px 9px;
  border-radius: 4px;
  cursor: pointer;
}
.type-options button:hover {
  background: var(--el-fill-color-light);
}
.type-options button[aria-pressed='true'] {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
}
.type-options button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.type-options button span {
  margin-left: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.filter-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.filter-tools > .el-input {
  flex: 1;
  min-width: 140px;
}
.status-select {
  width: 130px;
  flex-shrink: 0;
}
.sort-select {
  width: 112px;
  flex-shrink: 0;
}
.option-count {
  float: right;
  margin-left: 20px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
@container (max-width: 520px) {
  .filter-tools {
    flex-wrap: wrap;
  }
  .filter-tools > .el-input {
    flex-basis: 100%;
  }
  .status-select,
  .sort-select {
    flex: 1;
    width: auto;
  }
}
</style>
