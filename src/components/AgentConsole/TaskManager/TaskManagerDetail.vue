<template>
  <aside class="task-detail-panel">
    <template v-if="task">
      <div class="detail-card hero-card">
        <div class="detail-hero-top">
          <div class="detail-type-chip">
            <el-icon><Icon :icon="getTaskTypeIcon(task.type, iconMap)" /></el-icon>
            <span>{{ getTaskTypeLabel(task.type) }}</span>
          </div>
          <StatusIndicator
            :status="getIndicatorStatus(task.status)"
            :label="getStatusText(task.status)"
          />
        </div>

        <h3 class="detail-title">
          {{ task.fileName }}
        </h3>

        <div class="detail-progress-row">
          <el-progress
            :percentage="normalizedProgress"
            :status="getProgressStatus(task.status)"
            :stroke-width="5"
            :show-text="false"
          />
          <span class="detail-progress-value">{{ normalizedProgress.toFixed(2) }}%</span>
        </div>

        <div class="detail-actions">
          <el-button
            v-if="primaryAction"
            size="small"
            type="primary"
            @click="$emit('action', primaryAction.key)"
          >
            <el-icon><Icon :icon="primaryAction.icon" /></el-icon>
            {{ primaryAction.label }}
          </el-button>
          <el-dropdown
            trigger="click"
            @command="$emit('action', $event)"
          >
            <el-button
              size="small"
              aria-label="更多任务操作"
            >
              更多
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
      </div>

      <div class="detail-card">
        <div class="panel-title">
          关键指标
        </div>
        <div class="metric-grid">
          <template v-if="task.type !== TaskType.SCAN">
            <div class="metric-item">
              <span>大小</span><strong>{{ formatFileSize(task.fileSize) }}</strong>
            </div>
            <div class="metric-item">
              <span>速度</span><strong>{{ formatSpeed(task.speed) }}</strong>
            </div>
          </template>
          <div class="metric-item">
            <span>任务编号</span>
            <strong>{{ task.type === TaskType.SCAN ? task.backendTaskId : task.serverTaskId || task.taskId || '-' }}</strong>
          </div>
          <div
            v-if="task.currentStage"
            class="metric-item"
          >
            <span>当前阶段</span>
            <strong>{{ formatTransferStage(task.currentStage) }}</strong>
          </div>
          <div class="metric-item">
            <span>开始时间</span>
            <strong>{{ formatDateTime(task.startTime) }}</strong>
          </div>
          <div class="metric-item">
            <span>结束时间</span>
            <strong>{{ formatDateTime(task.endTime) }}</strong>
          </div>
        </div>
      </div>

      <div class="detail-card">
        <div class="panel-title">
          任务上下文
        </div>
        <div class="detail-info-list">
          <template v-if="task.type === TaskType.SCAN">
            <div
              v-if="task.scanKind"
              class="detail-info-item"
            >
              <label>扫描类型</label>
              <span>{{ getScanKindLabel(task.scanKind) }}</span>
            </div>
            <div
              v-if="task.targetLabel"
              class="detail-info-item"
            >
              <label>目标</label>
              <span>{{ task.targetLabel }}</span>
            </div>
            <div
              v-if="task.targetCount"
              class="detail-info-item"
            >
              <label>处理进度</label>
              <span>{{ task.processedCount || 0 }} / {{ task.targetCount }}</span>
            </div>
            <div
              v-if="task.reachableHostList?.length"
              class="detail-info-item detail-info-item--full"
            >
              <label>可达主机</label>
              <span>{{ task.reachableHostList.join(', ') }}</span>
            </div>
            <TaskError :task="task" />
          </template>
          <template v-else>
            <div
              v-if="task.databaseName"
              class="detail-info-item"
            >
              <label>数据库</label>
              <span>{{ task.databaseName }}</span>
            </div>
            <div
              v-if="task.tableCount"
              class="detail-info-item"
            >
              <label>表数量</label>
              <span>{{ task.processedTables || 0 }} / {{ task.tableCount }}</span>
            </div>
            <div
              v-if="task.currentTable"
              class="detail-info-item"
            >
              <label>当前处理</label>
              <span>{{ task.currentTable }}</span>
            </div>
            <div
              v-if="task.filePath"
              class="detail-info-item detail-info-item--full"
            >
              <label>目标路径</label><span>{{ task.filePath }}</span>
            </div>
            <div
              v-if="task.downloadPath"
              class="detail-info-item detail-info-item--full"
            >
              <label>落盘路径</label>
              <span>{{ task.downloadPath }}</span>
            </div>
            <TaskError :task="task" />
          </template>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { computed, defineComponent, h } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { TaskType } from '@/constants/task.js'
import { formatFileSize, formatDate as formatDateTime } from '@/utils/format.js'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import {
  getIndicatorStatus,
  getProgressStatus,
  getScanKindLabel,
  getStatusText,
  getTaskTypeIcon,
  getTaskTypeLabel
} from './taskManagerModel.js'

const props = defineProps({
  task: { type: Object, default: null },
  primaryAction: { type: Object, default: null },
  secondaryActions: { type: Array, default: () => [] }
})

defineEmits(['action'])

const iconMap = icons
const normalizedProgress = computed(() => {
  const value = Number(props.task?.progress || 0)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
})

const formatSpeed = (bytes) => {
  const value = Number(bytes || 0)
  return value > 0 ? `${formatFileSize(value)}/s` : '-'
}

const formatTransferStage = (stage) =>
  ({
    CREATED: '已创建',
    PREPARING: '准备中',
    TRANSFERRING: '传输中',
    VERIFYING_REMOTE: '校验远端文件',
    VERIFYING_LOCAL: '校验本地文件',
    COMMITTING: '提交文件',
    FINISHED: '已结束'
  })[stage] || stage

const TaskError = defineComponent({
  props: { task: { type: Object, required: true } },
  setup(errorProps) {
    return () => {
      const message = errorProps.task.error || errorProps.task.lastError
      return message
        ? h('div', { class: 'detail-info-item detail-info-item--full is-danger' }, [
            h(
              'label',
              errorProps.task.errorStage
                ? `错误阶段 · ${formatTransferStage(errorProps.task.errorStage)}`
                : '错误信息'
            ),
            h('span', message)
          ])
        : null
    }
  }
})
</script>

<style scoped>
.task-detail-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 18px;
  min-height: 0;
  min-width: 0;
  padding: 12px;
  overflow: auto;
}
.detail-card {
  flex-shrink: 0;
}
.detail-card + .detail-card {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 14px;
}
.detail-hero-top,
.detail-type-chip,
.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-hero-top {
  justify-content: space-between;
  font-size: 12px;
}
.detail-type-chip {
  color: var(--el-text-color-secondary);
}
.detail-title {
  margin: 12px 0;
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.detail-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-progress-row > .el-progress {
  flex: 1;
  min-width: 0;
}
.detail-progress-value {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.detail-actions {
  flex-wrap: wrap;
  margin-top: 12px;
}
.panel-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.metric-grid,
.detail-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.metric-item,
.detail-info-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
  font-size: 12px;
  line-height: 1.6;
}
.metric-item > span,
.detail-info-item > label {
  color: var(--el-text-color-secondary);
}
.metric-item strong,
.detail-info-item > span {
  min-width: 0;
  font-weight: 400;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.detail-info-item.is-danger {
  display: block;
  padding: 10px;
  border-radius: 4px;
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 8%, var(--el-bg-color));
}
.detail-info-item.is-danger label,
.detail-info-item.is-danger span {
  display: block;
  color: inherit;
}
.remove-action:not(.is-disabled) {
  color: var(--el-color-danger);
}
</style>
