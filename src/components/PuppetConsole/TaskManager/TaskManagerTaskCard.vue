<template>
  <article
    class="task-card"
    :class="{ selected: isSelected }"
    @click="$emit('select')"
  >
    <div class="task-card-top">
      <div class="task-title-wrap">
        <div class="task-icon">
          <el-icon><Icon :icon="typeIcon" /></el-icon>
        </div>
        <div class="task-heading">
          <span class="task-type">{{ typeLabel }}</span>
          <h3>{{ task.fileName }}</h3>
        </div>
      </div>

      <div class="task-status-wrap">
        <StatusIndicator
          :status="statusKey"
          :label="statusText"
          compact
        />
        <span
          v-if="task.isManagedLocally"
          class="task-source task-source--live"
        >可控</span>
        <span
          v-else
          class="task-source"
        >快照</span>
      </div>
    </div>

    <div class="task-meta-grid">
      <div
        v-for="item in metaItems"
        :key="item.label"
        class="meta-pill"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div class="task-progress">
      <el-progress
        :percentage="normalizedProgress"
        :status="progressStatus"
        :stroke-width="7"
      />
    </div>

    <div
      v-if="
        task.currentTable ||
          task.databaseName ||
          task.downloadPath ||
          task.scanKind ||
          task.resultSummary
      "
      class="task-context"
    >
      <span v-if="task.databaseName">数据库 {{ task.databaseName }}</span>
      <span v-if="task.currentTable">当前 {{ task.currentTable }}</span>
      <span v-if="task.downloadPath">落盘 {{ task.downloadPath }}</span>
      <span v-if="task.scanKind">{{ getScanKindLabel(task.scanKind) }}</span>
      <span v-if="task.targetLabel">目标 {{ task.targetLabel }}</span>
      <span v-if="task.resultSummary">{{ task.resultSummary }}</span>
    </div>

    <div
      v-if="task.error || task.lastError"
      class="task-error"
    >
      {{ task.error || task.lastError }}
    </div>

    <div class="task-actions">
      <el-button
        v-if="primaryAction"
        size="small"
        type="primary"
        @click.stop="$emit('action', primaryAction.key)"
      >
        <el-icon><Icon :icon="primaryAction.icon" /></el-icon>
        {{ primaryAction.label }}
      </el-button>

      <el-button
        v-for="action in secondaryActions"
        :key="action.key"
        size="small"
        :type="action.type || 'default'"
        :plain="action.type !== 'primary'"
        :disabled="action.disabled"
        @click.stop="$emit('action', action.key)"
      >
        <el-icon><Icon :icon="action.icon" /></el-icon>
        {{ action.label }}
      </el-button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { formatFileSize, formatDate as formatDateTime } from '@/utils/format.js'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  statusText: {
    type: String,
    default: ''
  },
  statusKey: {
    type: String,
    default: 'untested'
  },
  typeLabel: {
    type: String,
    default: ''
  },
  typeIcon: {
    type: String,
    default: ''
  },
  progressStatus: {
    type: String,
    default: ''
  },
  primaryAction: {
    type: Object,
    default: null
  },
  secondaryActions: {
    type: Array,
    default: () => []
  }
})

defineEmits(['select', 'action'])

const normalizedProgress = computed(() => {
  const value = Number(props.task.progress || 0)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
})

const isScanTask = computed(() => props.task.type === 'scan')

const metaItems = computed(() => {
  const updatedTime = formatDateTime(
    props.task.endTime || props.task.startTime || props.task.createdTime
  )

  if (isScanTask.value) {
    return [
      { label: '进度', value: `${normalizedProgress.value.toFixed(2)}%` },
      { label: '目标', value: props.task.totalCount || props.task.targetCount || '-' },
      { label: '发现', value: props.task.hitCount || 0 },
      { label: '更新时间', value: updatedTime }
    ]
  }

  return [
    { label: '进度', value: `${normalizedProgress.value.toFixed(2)}%` },
    { label: '大小', value: formatFileSize(props.task.fileSize) },
    { label: '速度', value: formatSpeed(props.task.speed) },
    { label: '更新时间', value: updatedTime }
  ]
})

const getScanKindLabel = (scanKind) => {
  const map = {
    host_reachability: '主机探活',
    port_scan: '端口扫描',
    fingerprint_scan: '指纹识别'
  }
  return map[scanKind] || '扫描'
}

const formatSpeed = (bytes) => {
  const value = Number(bytes || 0)
  return value > 0 ? `${formatFileSize(value)}/s` : '-'
}
</script>

<style scoped>
.task-card {
  padding: 12px;
  border-radius: var(--radius-container);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 26%, transparent);
  background: color-mix(in srgb, var(--app-card-background) 94%, var(--el-bg-color-overlay));
  box-shadow: none;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.task-card:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  background: var(--app-hover-background);
}

.task-card.selected {
  border-color: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
  background: var(--app-selected-background);
  box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.task-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.task-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary-light-9) 80%, white);
}

.task-heading {
  min-width: 0;
}

.task-type {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 700;
}

.task-heading h3 {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  word-break: break-word;
}

.task-status-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.task-source {
  padding: 4px 8px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--app-control-background-soft) 92%, white);
}

.task-source--live {
  color: var(--el-color-primary-dark-2);
  background: color-mix(in srgb, var(--el-color-primary-light-9) 76%, white);
}

.task-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.meta-pill {
  min-width: 0;
  padding: 8px 10px;
  border-radius: var(--radius-control);
  background: var(--app-control-background-soft);
  border: 0;
}

.meta-pill span {
  display: block;
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 700;
}

.meta-pill strong {
  display: block;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
}

.task-progress {
  margin-top: 14px;
}

.task-context {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.task-context span {
  padding: 5px 9px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  background: color-mix(in srgb, var(--el-color-info-light-9) 72%, white);
  color: var(--el-text-color-regular);
}

.task-error {
  margin-top: 12px;
  padding: 11px 12px;
  border-radius: var(--radius-control);
  font-size: 12px;
  line-height: 1.65;
  color: var(--el-color-danger-dark-2);
  background: color-mix(in srgb, var(--el-color-danger-light-9) 82%, white);
  border: 1px solid color-mix(in srgb, var(--el-color-danger) 24%, transparent);
}

.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

@media (max-width: 900px) {
  .task-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .task-card-top {
    flex-direction: column;
  }

  .task-status-wrap {
    flex-wrap: wrap;
  }

  .task-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
