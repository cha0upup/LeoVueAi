<template>
  <article
    class="task-card"
    :class="{ selected: isSelected }"
  >
    <div class="task-card-top">
      <button
        type="button"
        class="task-title"
        :aria-expanded="isSelected"
        @click="$emit('select', $event)"
      >
        <Icon :icon="typeIcon" />
        <span :title="task.fileName">{{ task.fileName || '未命名任务' }}</span>
      </button>
      <StatusIndicator
        :status="statusKey"
        :label="statusText"
        compact
      />
    </div>
    <div class="task-meta">
      <span>{{ typeLabel }}</span>
      <template v-if="task.type === 'scan'">
        <span>目标 {{ task.totalCount ?? task.targetCount ?? '—' }}</span>
        <span>发现 {{ task.hitCount || 0 }}</span>
      </template>
      <template v-else>
        <span>{{ formatFileSize(task.fileSize) }}</span>
        <span v-if="statusKey === 'running' && task.speed > 0">{{ formatFileSize(task.speed) }}/s</span>
      </template>
      <span>{{
        formatDateTime(task.updatedAt || task.endTime || task.startTime || task.createdTime)
      }}</span>
    </div>
    <div class="task-card-bottom">
      <el-progress
        :percentage="normalizedProgress"
        :status="progressStatus"
        :stroke-width="5"
      />
      <el-button
        v-if="primaryAction"
        size="small"
        type="primary"
        text
        @click="$emit('action', primaryAction.key)"
      >
        {{ primaryAction.label }}
      </el-button>
      <el-dropdown
        trigger="click"
        @command="$emit('action', $event)"
      >
        <el-button
          size="small"
          text
          :aria-label="`${task.fileName || '任务'} 的更多操作`"
        >
          <Icon icon="mdi:dots-horizontal" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="action in secondaryActions"
              :key="action.key"
              :command="action.key"
              :disabled="action.disabled"
              :class="{ 'remove-action': action.key === 'remove' }"
            >
              {{ action.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <p
      v-if="task.error || task.lastError"
      class="task-error"
      :title="task.error || task.lastError"
    >
      {{ task.error || task.lastError }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { formatFileSize, formatDate as formatDateTime } from '@/utils/format.js'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
const props = defineProps({
  task: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
  statusText: { type: String, default: '' },
  statusKey: { type: String, default: 'untested' },
  typeLabel: { type: String, default: '' },
  typeIcon: { type: String, default: '' },
  progressStatus: { type: String, default: '' },
  primaryAction: { type: Object, default: null },
  secondaryActions: { type: Array, default: () => [] }
})
defineEmits(['select', 'action'])
const normalizedProgress = computed(() => {
  const value = Number(props.task.progress || 0)
  return Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value)) * 10) / 10 : 0
})
</script>

<style scoped>
.task-card {
  flex-shrink: 0;
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.task-card.selected {
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--el-bg-color));
  box-shadow: inset 3px 0 var(--el-color-primary);
}
.task-card-top,
.task-card-bottom,
.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.task-card-top {
  justify-content: space-between;
}
.task-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border: 0;
  padding: 2px 0;
  background: transparent;
  text-align: left;
  font: inherit;
  font-size: 13px;
  color: var(--el-text-color-primary);
  cursor: pointer;
}
.task-title > svg {
  flex-shrink: 0;
  color: var(--el-color-primary);
}
.task-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-title:hover {
  color: var(--el-color-primary);
}
.task-title:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}
.task-meta {
  flex-wrap: wrap;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.task-card-bottom {
  margin-top: 8px;
}
.task-card-bottom .el-progress {
  flex: 1;
  min-width: 0;
}
.task-card-bottom :deep(.el-progress__text) {
  min-width: 38px;
  font-size: 11px !important;
}
.task-error {
  margin: 6px 0 0;
  color: var(--el-color-danger);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.remove-action:not(.is-disabled) {
  color: var(--el-color-danger);
}
</style>
