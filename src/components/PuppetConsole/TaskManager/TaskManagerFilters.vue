<template>
  <section class="filter-shell">
    <div class="filter-row">
      <div class="filter-group">
        <span class="group-label">任务类型</span>
        <div class="pill-row">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            class="filter-pill"
            :class="{ active: activeTaskType === option.value }"
            @click="$emit('update:type', option.value)"
          >
            <span>{{ option.label }}</span>
            <strong>{{ option.count }}</strong>
          </button>
        </div>
      </div>

      <div class="filter-group filter-group--meta">
        <span class="group-label">列表结果</span>
        <div class="result-indicator">
          {{ resultCount }} 个任务
        </div>
      </div>
    </div>

    <div class="filter-row filter-row--compact">
      <div class="pill-row">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          class="sub-pill"
          :class="{ active: statusFilter === option.value }"
          @click="$emit('update:status', option.value)"
        >
          {{ option.label }} <strong>{{ option.count }}</strong>
        </button>
      </div>

      <div class="tool-row">
        <el-input
          :model-value="searchKeyword"
          clearable
          placeholder="搜索文件名、数据库或任务编号"
          @update:model-value="$emit('update:search', $event)"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>

        <el-select
          :model-value="sortOption"
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
    </div>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

defineProps({
  typeOptions: {
    type: Array,
    default: () => []
  },
  statusOptions: {
    type: Array,
    default: () => []
  },
  activeTaskType: {
    type: String,
    default: ''
  },
  statusFilter: {
    type: String,
    default: 'all'
  },
  searchKeyword: {
    type: String,
    default: ''
  },
  sortOption: {
    type: String,
    default: 'latest'
  },
  resultCount: {
    type: Number,
    default: 0
  }
})

defineEmits(['update:type', 'update:status', 'update:search', 'update:sort'])
</script>

<style scoped>
.filter-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 24%, transparent);
}

.filter-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.filter-row--compact {
  align-items: center;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.filter-group--meta {
  align-items: flex-end;
  flex-shrink: 0;
}

.group-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-pill,
.sub-pill {
  border: 1px solid color-mix(in srgb, var(--el-border-color) 32%, transparent);
  background: color-mix(in srgb, var(--app-control-background-soft) 90%, white);
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: color var(--motion-fast) var(--motion-easing),
    background-color var(--motion-fast) var(--motion-easing),
    border-color var(--motion-fast) var(--motion-easing);
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  font-size: 13px;
  font-weight: 700;
}

.filter-pill strong,
.sub-pill strong {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.sub-pill {
  min-height: var(--control-height-sm);
  padding: 0 var(--space-2);
  border-radius: var(--radius-control);
  font-size: 12px;
  font-weight: 600;
}

.filter-pill.active,
.sub-pill.active {
  border-color: color-mix(in srgb, var(--el-color-primary) 34%, transparent);
  background: color-mix(in srgb, var(--el-color-primary-light-9) 74%, white);
  color: var(--el-color-primary-dark-2);
}

.result-indicator {
  min-height: var(--control-height);
  padding: 0 14px;
  border-radius: var(--radius-control);
  display: inline-flex;
  align-items: center;
  background: color-mix(in srgb, var(--app-card-background) 88%, white);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  font-size: 13px;
  font-weight: 700;
}

.tool-row {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 160px;
  gap: 10px;
  width: min(520px, 100%);
}

.sort-select {
  width: 100%;
}

@media (max-width: 900px) {
  .filter-row,
  .filter-row--compact {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group--meta {
    align-items: flex-start;
  }

  .tool-row {
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
