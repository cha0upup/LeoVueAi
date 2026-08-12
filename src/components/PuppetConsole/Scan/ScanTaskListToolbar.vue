<template>
  <div class="task-toolbar">
    <div class="toolbar-summary">
      <span
        v-for="(item, i) in summaryItems"
        :key="i"
        class="summary-item"
        :class="{ 'summary-item-active': item.active }"
      >{{ item.text }}</span>
    </div>
    <div class="toolbar-actions">
      <slot />
      <el-button
        v-if="showRefresh"
        text
        size="small"
        :loading="isRefreshing"
        @click="$emit('refresh')"
      >
        <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
        刷新
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

defineProps({
  /** [{ text: 'X 个任务', active: false }, { text: 'Y 活跃中', active: true }] */
  summaryItems: {
    type: Array,
    default: () => []
  },
  isRefreshing: {
    type: Boolean,
    default: false
  },
  /** 是否显示内置刷新按钮 */
  showRefresh: {
    type: Boolean,
    default: true
  }
})

defineEmits(['refresh'])
</script>

<style scoped>
.task-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 38px;
  margin-bottom: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 34%, transparent);
  flex-wrap: wrap;
}

.toolbar-summary {
  display: inline-flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
}

.summary-item {
  display: inline-flex;
  align-items: center;
  font-size: var(--el-font-size-extra-small);
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.summary-item + .summary-item::before {
  content: '';
  width: 1px;
  height: 12px;
  margin: 0 9px;
  background: color-mix(in srgb, var(--el-border-color) 48%, transparent);
}

.summary-item-active {
  color: var(--el-color-primary);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.toolbar-actions :deep(.el-button) {
  margin-left: 0;
}

@media (max-width: 900px) {
  .task-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-actions {
    width: 100%;
  }
}
</style>
