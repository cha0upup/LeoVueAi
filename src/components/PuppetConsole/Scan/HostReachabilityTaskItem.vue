<template>
  <div
    class="task-item"
    :class="{ completed: task.status, running: !task.status }"
  >
    <div class="task-header">
      <el-checkbox
        :model-value="selected"
        class="task-checkbox"
        @change="handleSelect"
      />
      <div class="task-info">
        <div class="task-main-row">
          <div class="task-hosts">
            <span class="task-host-badge">
              <el-icon><Icon :icon="iconMap.server" /></el-icon>
              {{ task.scanHosts?.length || 0 }} 个主机
            </span>
            <span class="task-id">ID {{ shortTaskId }}</span>
          </div>
          <div class="task-meta">
            <div class="task-status-indicator">
              <span
                class="status-dot"
                :class="task.status ? 'dot-success' : 'dot-running'"
              />
              <span class="status-text">{{ task.status ? '已完成' : '进行中' }}</span>
            </div>
            <span class="task-time">{{ formatTime(task.createTime) }}</span>
          </div>
        </div>
        <div class="task-subline">
          <span>超时 {{ task.scanTimeout || 3000 }} ms</span>
          <span v-if="task.result">可达率 {{ reachableRate }}</span>
        </div>
      </div>
      <div class="task-actions">
        <el-button
          v-if="
            task.status &&
              task.result &&
              task.result.reachableHostList &&
              task.result.reachableHostList.length > 0
          "
          text
          size="small"
          type="primary"
          @click="handleExport"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          导出
        </el-button>
        <el-button
          text
          size="small"
          type="danger"
          @click="$emit('remove', task.taskId)"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除
        </el-button>
      </div>
    </div>

    <!-- 结果统计 -->
    <div
      v-if="task.status && task.result"
      class="task-results"
    >
      <div class="result-stats">
        <div class="stat-item">
          <div class="stat-number">
            {{ task.result.totalCount || 0 }}
          </div>
          <div class="stat-label">
            总主机数
          </div>
        </div>
        <div class="stat-item success">
          <div class="stat-number">
            {{ task.result.reachableCount || 0 }}
          </div>
          <div class="stat-label">
            可达主机
          </div>
        </div>
        <div class="stat-item danger">
          <div class="stat-number">
            {{ task.result.unreachableCount || 0 }}
          </div>
          <div class="stat-label">
            不可达主机
          </div>
        </div>
      </div>

      <!-- 可达主机列表 -->
      <div
        v-if="task.result.reachableHostList && task.result.reachableHostList.length > 0"
        class="result-section"
      >
        <div class="result-header">
          <div
            class="result-header-left"
            @click="showReachable = !showReachable"
          >
            <el-icon class="result-icon success">
              <Icon :icon="iconMap.circleCheck" />
            </el-icon>
            <span class="result-title">可达主机 ({{ task.result.reachableHostList.length }})</span>
            <el-icon
              class="collapse-icon"
              :class="{ collapsed: !showReachable }"
            >
              <Icon :icon="iconMap.arrowDown" />
            </el-icon>
          </div>
          <div
            v-show="showReachable"
            class="result-header-actions"
          >
            <el-checkbox
              :model-value="isAllReachableSelected"
              :indeterminate="isReachableIndeterminate"
              size="small"
              @change="handleSelectAllReachable"
            >
              全选
            </el-checkbox>
            <el-button
              type="primary"
              size="small"
              :disabled="selectedHosts.length === 0"
              @click="handleBatchScan"
            >
              <el-icon><Icon :icon="iconMap.scan" /></el-icon>
              批量端口扫描 ({{ selectedHosts.length }})
            </el-button>
          </div>
        </div>
        <div
          v-show="showReachable"
          class="host-list reachable-hosts"
        >
          <el-checkbox-group
            v-model="selectedHosts"
            class="host-checkbox-group"
          >
            <el-checkbox
              v-for="host in task.result.reachableHostList"
              :key="host"
              :label="host"
              class="host-checkbox"
            >
              <el-tag
                type="primary"
                class="host-tag"
                @click.stop="copyToClipboard(host)"
              >
                {{ host }}
              </el-tag>
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <!-- 不可达主机列表 -->
      <div
        v-if="task.result.unreachableHostList && task.result.unreachableHostList.length > 0"
        class="result-section"
      >
        <div
          class="result-header"
          @click="showUnreachable = !showUnreachable"
        >
          <el-icon class="result-icon danger">
            <Icon :icon="iconMap.circleClose" />
          </el-icon>
          <span class="result-title">不可达主机 ({{ task.result.unreachableHostList.length }})</span>
          <el-icon
            class="collapse-icon"
            :class="{ collapsed: !showUnreachable }"
          >
            <Icon :icon="iconMap.arrowDown" />
          </el-icon>
        </div>
        <div
          v-show="showUnreachable"
          class="host-list unreachable-hosts"
        >
          <el-tag
            v-for="host in task.result.unreachableHostList"
            :key="host"
            type="info"
            effect="plain"
            class="host-tag"
            @click="copyToClipboard(host)"
          >
            {{ host }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 进行中状态 -->
    <div
      v-else
      class="task-running-bar"
    >
      <div class="task-running-fill" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select', 'remove', 'batch-scan'])

const showReachable = ref(true)
const showUnreachable = ref(false)

const selectedHosts = ref([])

const shortTaskId = computed(() => {
  const taskId = props.task.taskId || '--'
  return taskId.length > 16 ? taskId.slice(-12) : taskId
})

const reachableRate = computed(() => {
  const total = props.task.result?.totalCount || 0
  const reachable = props.task.result?.reachableCount || 0
  if (!total) return '0%'
  return `${Math.round((reachable / total) * 100)}%`
})

const isAllReachableSelected = computed(() => {
  if (!props.task.result?.reachableHostList?.length) return false
  return (
    selectedHosts.value.length === props.task.result.reachableHostList.length &&
    props.task.result.reachableHostList.every((host) => selectedHosts.value.includes(host))
  )
})

const isReachableIndeterminate = computed(() => {
  if (!props.task.result?.reachableHostList?.length) return false
  const selectedCount = props.task.result.reachableHostList.filter((host) =>
    selectedHosts.value.includes(host)
  ).length
  return selectedCount > 0 && selectedCount < props.task.result.reachableHostList.length
})

const handleSelect = (checked) => {
  emit('select', props.task.taskId, checked)
}

const handleSelectAllReachable = (checked) => {
  if (!props.task.result?.reachableHostList) return

  if (checked) {
    const newHosts = props.task.result.reachableHostList.filter(
      (host) => !selectedHosts.value.includes(host)
    )
    selectedHosts.value.push(...newHosts)
  } else {
    selectedHosts.value = selectedHosts.value.filter(
      (host) => !props.task.result.reachableHostList.includes(host)
    )
  }
}

const handleBatchScan = () => {
  if (selectedHosts.value.length === 0) {
    showWarning('请至少选择一个主机')
    return
  }
  emit('batch-scan', selectedHosts.value)
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(`已复制: ${text}`)
  } catch {
    showError('复制失败')
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

// 导出单个任务结果为CSV
const handleExport = () => {
  const task = props.task
  if (!task.result) return

  const headers = [
    '任务ID',
    '主机列表',
    '总主机数',
    '可达主机数',
    '不可达主机数',
    '可达主机',
    '不可达主机',
    '创建时间'
  ]

  const reachableHosts = task.result.reachableHostList?.join(',') || ''
  const unreachableHosts = task.result.unreachableHostList?.join(',') || ''
  const createTime = task.createTime ? new Date(task.createTime).toLocaleString('zh-CN') : ''
  const hostList = task.scanHosts?.join(',') || ''

  const row = [
    task.taskId || '',
    hostList,
    task.result.totalCount || 0,
    task.result.reachableCount || 0,
    task.result.unreachableCount || 0,
    reachableHosts,
    unreachableHosts,
    createTime
  ]

  // 创建CSV内容
  const csvContent = [
    headers.join(','),
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ].join('\n')

  // 添加BOM以支持中文
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const filename = `主机探活_${task.taskId}_${timestamp}.csv`

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  showSuccess('探活结果已导出')
}

// 监听结果变化，清空选择
watch(
  () => props.task.result,
  (newResult) => {
    if (!newResult) {
      selectedHosts.value = []
    }
  }
)
</script>

<style scoped>
.task-item {
  --task-item-surface: var(--app-card-background);
  --task-item-muted-surface: var(--app-control-background-soft);
  --task-item-strong-surface: var(--app-control-background);
  --task-item-border-soft: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  background: var(--task-item-surface);
  border-radius: var(--radius-control);
  padding: 10px;
  border: 1px solid var(--task-item-border-soft);
  border-left: 3px solid transparent;
  box-shadow: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

:global(html:not(.dark) .task-item),
:global(html[data-theme='light'] .task-item) {
  --task-item-muted-surface: color-mix(in srgb, var(--app-control-background-soft) 82%, white);
  --task-item-strong-surface: var(--app-surface-background);
}

:global(html.dark .task-item),
:global(html[data-theme='dark'] .task-item) {
  --task-item-surface: color-mix(
    in srgb,
    var(--app-card-background) 80%,
    var(--app-surface-background)
  );
  --task-item-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 72%,
    var(--app-card-background)
  );
  --task-item-strong-surface: color-mix(
    in srgb,
    var(--app-control-background) 84%,
    var(--app-card-background)
  );
  --task-item-border-soft: color-mix(in srgb, var(--el-border-color) 54%, transparent);
}

.task-item:hover {
  box-shadow: none;
  transform: none;
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, var(--el-border-color));
  background: color-mix(in srgb, var(--task-item-surface) 96%, var(--el-color-primary));
}

.task-item.running {
  border-left-color: color-mix(in srgb, var(--el-color-primary) 70%, transparent);
}

.task-item.completed {
  border-left-color: color-mix(in srgb, var(--el-color-success) 55%, transparent);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 10px;
  min-width: 0;
}

.task-checkbox {
  margin-top: 2px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-main-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.task-hosts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.task-host-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 3px 9px;
  border-radius: var(--radius-tag);
  background: var(--task-item-strong-surface);
  border: 1px solid var(--task-item-border-soft);
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-small);
  font-weight: 700;
  max-width: 100%;
  word-break: break-word;
}

.task-id {
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-extra-small);
  font-family: var(--el-font-family-mono);
  min-width: 0;
  overflow-wrap: anywhere;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}

.task-status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}

.status-dot.dot-running {
  background: var(--el-color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.status-dot.dot-success {
  background: var(--el-color-success);
}

.status-text {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.task-time {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.task-subline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-extra-small);
}

.task-actions {
  display: flex;
  gap: var(--el-spacing-small);
  flex-shrink: 0;
}

.task-actions :deep(.el-button) {
  border-radius: var(--radius-control);
}

.task-running-bar {
  height: 3px;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  border-radius: 999px;
  margin: 10px 0 0;
  overflow: hidden;
}

.task-running-fill {
  height: 100%;
  background: var(--el-color-primary);
  border-radius: 999px;
  animation: indeterminate-slide 1.6s ease-in-out infinite;
}

@keyframes indeterminate-slide {
  0% { transform: translateX(-100%) scaleX(0.4); }
  50% { transform: translateX(60%) scaleX(0.6); }
  100% { transform: translateX(200%) scaleX(0.4); }
}

.task-results {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--task-item-border-soft);
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin-bottom: 14px;
  overflow: hidden;
  border: 1px solid var(--task-item-border-soft);
  border-radius: var(--radius-control);
  background: var(--task-item-muted-surface);
}

.stat-item {
  text-align: center;
  padding: 8px 10px;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--task-item-border-soft);
  border-radius: 0;
}

.stat-item:last-child {
  border-right: 0;
}

.stat-item.success .stat-number {
  color: var(--el-color-success);
}

.stat-item.danger .stat-number {
  color: var(--el-color-danger);
}

.stat-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.result-section {
  margin-bottom: 12px;
}

.result-section:last-child {
  margin-bottom: 0;
}

.result-header {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
  margin-bottom: 8px;
  user-select: none;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  background: var(--task-item-strong-surface);
  border: 1px solid var(--task-item-border-soft);
}

.result-header-left {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
  flex: 1;
  cursor: pointer;
}

.result-header-actions {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
}

.collapse-icon {
  margin-left: auto;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  transition: transform 0.3s ease;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.result-icon {
  font-size: var(--el-font-size-small);
}

.result-icon.success {
  color: var(--el-color-success);
}

.result-icon.danger {
  color: var(--el-color-danger);
}

.result-title {
  font-size: var(--el-font-size-small);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.host-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px;
  max-height: 260px;
  overflow: auto;
  padding-right: 4px;
}

.host-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.host-checkbox {
  display: flex;
  align-items: center;
  margin: 0;
  min-height: 24px;
}

.host-checkbox :deep(.el-checkbox) {
  margin-right: 4px;
}

.host-checkbox :deep(.el-checkbox__label) {
  padding-left: 0;
  line-height: 1.2;
}

.host-tag {
  margin: 0;
  cursor: pointer;
  transition: all 0.2s;
  font-size: var(--el-font-size-small);
  padding: 5px 10px;
  line-height: 1.2;
  border-radius: 999px;
  max-width: 100%;
}

.host-tag:hover {
  transform: scale(1.05);
  box-shadow: var(--el-box-shadow-light);
}

.reachable-hosts .host-tag {
  background: var(--task-item-strong-surface);
  border-color: color-mix(in srgb, var(--el-border-color) 28%, transparent);
  color: var(--el-text-color-primary);
}

.unreachable-hosts .host-tag {
  background: color-mix(in srgb, var(--el-border-color) 8%, var(--task-item-strong-surface));
  border-color: color-mix(in srgb, var(--el-border-color) 54%, transparent);
  color: var(--el-text-color-secondary);
}

.unreachable-hosts .host-tag {
  margin: 0;
}

/* 响应式 */
@media (max-width: 900px) {
  .task-header,
  .task-main-row,
  .result-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-actions,
  .task-meta,
  .result-header-actions {
    width: 100%;
  }

  .task-meta,
  .result-header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .result-stats {
    grid-template-columns: 1fr;
  }
}
</style>
