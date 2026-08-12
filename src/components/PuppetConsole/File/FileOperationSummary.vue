<template>
  <div
    class="operation-summary"
    :class="{
      'is-danger': tone === 'danger',
      'is-warning': tone === 'warning'
    }"
  >
    <div class="summary-icon">
      <el-icon :style="{ color: iconColor || undefined }">
        <Icon :icon="icon || iconMap.document" />
      </el-icon>
    </div>
    <div class="summary-main">
      <div class="summary-title-row">
        <h3 class="summary-name">
          {{ name || '未知文件' }}
        </h3>
        <div
          v-if="visibleBadges.length"
          class="summary-tags"
        >
          <el-tag
            v-for="badge in visibleBadges"
            :key="badge.label"
            :type="badge.type || 'info'"
            size="small"
            effect="plain"
          >
            {{ badge.label }}
          </el-tag>
        </div>
      </div>
      <el-tooltip
        v-if="path"
        :content="path"
        placement="top"
        :show-after="500"
      >
        <p class="summary-path">
          {{ path }}
        </p>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

const props = defineProps({
  name: {
    type: String,
    default: ''
  },
  path: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  iconColor: {
    type: String,
    default: ''
  },
  badges: {
    type: Array,
    default: () => []
  },
  tone: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'warning', 'danger'].includes(value)
  }
})

const visibleBadges = computed(() => props.badges.filter((badge) => badge?.label))
</script>

<style scoped>
.operation-summary {
  --file-operation-panel-surface: color-mix(in srgb, var(--app-control-background-soft) 86%, var(--el-bg-color));
  --file-operation-raised-surface: color-mix(in srgb, var(--el-bg-color-overlay) 92%, var(--app-control-background-soft));
  --file-operation-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border-radius: 12px;
  background: var(--file-operation-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-operation-soft-border) 88%, transparent);
}

:global(html:not(.dark)) .operation-summary,
:global(html[data-theme='light']) .operation-summary {
  --file-operation-panel-surface: #f7f9fc;
  --file-operation-raised-surface: #ffffff;
  --file-operation-soft-border: rgba(30, 41, 59, 0.1);
}

.operation-summary.is-warning {
  background: color-mix(in srgb, var(--el-color-warning) 6%, var(--file-operation-panel-surface));
  border-color: color-mix(in srgb, var(--el-color-warning) 18%, transparent);
}

.operation-summary.is-danger {
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--file-operation-panel-surface));
  border-color: color-mix(in srgb, var(--el-color-danger) 18%, transparent);
}

.summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--file-operation-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-operation-soft-border) 86%, transparent);
  color: var(--el-color-primary);
}

.summary-icon .el-icon {
  font-size: 18px;
}

.summary-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.summary-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.summary-name {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.summary-tags {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.summary-path {
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

@media (max-width: 768px) {
  .operation-summary,
  .summary-title-row {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-tags {
    flex-wrap: wrap;
  }

  .summary-name,
  .summary-path {
    white-space: normal;
    word-break: break-all;
  }
}
</style>
