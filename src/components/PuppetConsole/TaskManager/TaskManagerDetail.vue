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
            :stroke-width="8"
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
          <el-button
            v-for="action in secondaryActions"
            :key="action.key"
            size="small"
            :type="action.type || 'default'"
            :plain="action.type !== 'primary'"
            :disabled="action.disabled"
            @click="$emit('action', action.key)"
          >
            <el-icon><Icon :icon="action.icon" /></el-icon>
            {{ action.label }}
          </el-button>
        </div>
      </div>

      <div class="detail-card">
        <div class="panel-title">
          关键指标
        </div>
        <div class="metric-grid">
          <div class="metric-item">
            <span>来源</span>
            <strong>{{ task.isManagedLocally ? '当前会话可控' : '服务端快照' }}</strong>
          </div>
          <div class="metric-item">
            <span>大小</span>
            <strong>{{ formatFileSize(task.fileSize) }}</strong>
          </div>
          <div class="metric-item">
            <span>速度</span>
            <strong>{{ formatSpeed(task.speed) }}</strong>
          </div>
          <div class="metric-item">
            <span>任务编号</span>
            <strong>{{ task.serverTaskId || task.taskId || '-' }}</strong>
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
              v-if="task.protocol"
              class="detail-info-item"
            >
              <label>协议</label>
              <span>{{ String(task.protocol).toUpperCase() }}</span>
            </div>
            <div
              v-if="task.fingerprintId"
              class="detail-info-item"
            >
              <label>指纹</label>
              <span>{{ task.fingerprintId }}</span>
            </div>
            <div
              v-if="task.totalCount"
              class="detail-info-item"
            >
              <label>处理进度</label>
              <span>{{ task.processedCount || 0 }} / {{ task.totalCount }}</span>
            </div>
            <div
              v-if="task.hitCount || task.missCount"
              class="detail-info-item"
            >
              <label>结果统计</label>
              <span>命中 {{ task.hitCount || 0 }} / 未命中 {{ task.missCount || 0 }}</span>
            </div>
            <div
              v-if="task.resultSummary"
              class="detail-info-item detail-info-item--full"
            >
              <label>摘要</label>
              <span>{{ task.resultSummary }}</span>
            </div>
            <div
              v-if="task.openPortList?.length"
              class="detail-info-item detail-info-item--full"
            >
              <label>开放端口</label>
              <span>{{ task.openPortList.join(', ') }}</span>
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
              v-if="getDownloadRelativePath(task.downloadPath)"
              class="detail-info-item detail-info-item--full"
            >
              <label>落盘路径</label>
              <span>{{ getDownloadRelativePath(task.downloadPath) }}</span>
            </div>
            <TaskError :task="task" />
            <div
              v-if="task.type === TaskType.DOWNLOAD && !task.isManagedLocally"
              class="detail-note"
            >
              当前下载任务来自服务端快照，暂停、继续、重试及清理操作会直接作用于服务端任务。
            </div>
          </template>
        </div>
      </div>
    </template>

    <div
      v-else
      class="detail-placeholder"
    >
      <el-empty
        description="选择左侧任务查看详情"
        :image-size="110"
      />
    </div>
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
  getDownloadRelativePath,
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

const formatSpeed = bytes => {
  const value = Number(bytes || 0)
  return value > 0 ? `${formatFileSize(value)}/s` : '-'
}

const formatTransferStage = stage =>
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
  min-height: 0;
  padding: var(--space-3);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--task-border);
  border-radius: var(--radius-container);
  background: var(--task-surface);
}

.detail-card {
  border: 1px solid color-mix(in srgb, var(--task-border) 85%, white);
  border-radius: var(--radius-container);
  background: var(--task-surface-strong);
  padding: 16px;
}

.detail-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.detail-type-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-tag);
  background: var(--task-surface-muted);
  font-size: 12px;
  font-weight: 600;
}

.detail-title {
  margin: 0 0 14px;
  font-size: var(--font-size-section-title);
  line-height: 1.35;
  word-break: break-word;
}

.detail-progress-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.detail-progress-value {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 700;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.panel-title {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.metric-grid,
.detail-info-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-item,
.detail-info-item {
  min-width: 0;
  padding: 12px 13px;
  border-radius: var(--radius-control);
  background: var(--task-surface-muted);
  border: 1px solid color-mix(in srgb, var(--task-border) 70%, transparent);
}

.metric-item span,
.detail-info-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.metric-item strong,
.detail-info-item span {
  display: block;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}

.detail-info-item--full,
.detail-note {
  grid-column: 1 / -1;
}

.detail-info-item.is-danger {
  background: color-mix(in srgb, var(--el-color-danger-light-9) 82%, white);
  border-color: color-mix(in srgb, var(--el-color-danger) 26%, transparent);
}

.is-danger-text {
  color: var(--el-color-danger);
  font-weight: 600;
}

.detail-note {
  padding: 12px 13px;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--el-color-info-light-9) 78%, white);
  border: 1px solid color-mix(in srgb, var(--el-color-info) 22%, transparent);
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.65;
}

.detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 18px;
}

@media (max-width: 768px) {
  .metric-grid,
  .detail-info-list,
  .detail-progress-row {
    grid-template-columns: 1fr;
  }
}
</style>
