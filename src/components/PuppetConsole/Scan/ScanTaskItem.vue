<template>
  <div
    class="task-item"
    :class="taskStateClass"
  >
    <div class="task-header">
      <el-checkbox
        :model-value="selected"
        class="task-checkbox"
        @change="handleSelect"
      />

      <div class="task-info">
        <div class="task-main-row">
          <div class="task-title-group">
            <span class="task-host-badge">
              <el-icon><Icon :icon="iconMap.server" /></el-icon>
              {{ task.scanHost }}
            </span>
            <span class="task-id">{{ shortTaskId }}</span>
          </div>

          <div class="task-meta">
            <div class="task-status-indicator">
              <span
                class="status-dot"
                :class="statusDotClass"
              />
              <span class="status-text">{{ statusText }}</span>
            </div>
            <span class="task-time">{{ formatTimeShort(task.createTime) }}</span>
          </div>
        </div>

        <div class="task-subline">
          <span>{{ task.scannedCount || 0 }}/{{ task.portLength || 0 }} 已扫</span>
          <span
            v-if="openCount > 0"
            class="subline-open"
          >{{ openCount }} 开放</span>
          <span
            v-if="task.status !== 'STOPPED' && (task.progress || 0) > 0"
            class="subline-progress"
          >{{ task.progress }}%</span>
        </div>
      </div>

      <div class="task-actions">
        <el-tooltip
          v-if="task.status === 'RUNNING'"
          content="暂停"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            :aria-label="`暂停扫描任务 ${task.taskName || task.taskId}`"
            @click="$emit('pause', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.pause" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          v-if="task.status === 'PAUSED'"
          content="继续"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            type="primary"
            :aria-label="`继续扫描任务 ${task.taskName || task.taskId}`"
            @click="$emit('resume', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.play" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          v-if="task.status !== 'STOPPED'"
          content="终止"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            type="warning"
            :aria-label="`停止扫描任务 ${task.taskName || task.taskId}`"
            @click="$emit('stop', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.stop" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          v-if="canExport"
          content="导出结果"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            :aria-label="`导出扫描任务 ${task.taskName || task.taskId}`"
            @click="handleExport"
          >
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          content="查询"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            :loading="task.isQuerying"
            :aria-label="`刷新扫描任务 ${task.taskName || task.taskId}`"
            @click="$emit('query', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          content="删除"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            type="danger"
            :aria-label="`删除扫描任务 ${task.taskName || task.taskId}`"
            @click="$emit('remove', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- Thin progress bar (only while active) -->
    <div
      v-if="task.status !== 'STOPPED'"
      class="task-progress-bar"
    >
      <div
        class="task-progress-fill"
        :class="{ 'fill-paused': task.status === 'PAUSED' }"
        :style="{ width: (task.progress || 0) + '%' }"
      />
    </div>

    <!-- Open ports result (collapsible) -->
    <template v-if="openCount > 0">
      <div
        class="task-result-toggle"
        @click="showPorts = !showPorts"
      >
        <el-icon class="result-toggle-icon">
          <Icon :icon="iconMap.circleCheck" />
        </el-icon>
        <span class="result-toggle-label">开放端口 {{ openCount }}</span>
        <el-icon
          class="toggle-arrow"
          :class="{ collapsed: !showPorts }"
        >
          <Icon :icon="iconMap.arrowDown" />
        </el-icon>
      </div>
      <transition name="fade-slide">
        <div
          v-if="showPorts"
          class="port-chips"
        >
          <span
            v-for="port in task.openPortList"
            :key="port"
            class="port-chip"
          >{{ port }}</span>
        </div>
      </transition>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { showSuccess } from '@/utils/messageUtils.js'

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

const emit = defineEmits(['query', 'remove', 'select', 'pause', 'resume', 'stop'])

const showPorts = ref(true)

const shortTaskId = computed(() => {
  const taskId = props.task.taskId || '--'
  return taskId.length > 16 ? taskId.slice(-12) : taskId
})

const openCount = computed(() => props.task.openPortList?.length || 0)

const canExport = computed(() =>
  props.task.status === 'STOPPED' &&
  props.task.scannedCount === props.task.portLength &&
  openCount.value > 0
)

const handleSelect = (checked) => {
  emit('select', props.task.taskId, checked)
}

const statusText = computed(() => {
  const t = props.task
  if (t.status === 'STOPPED' && t.scannedCount === t.portLength) return '已完成'
  if (t.status === 'STOPPED') return '已终止'
  if (t.status === 'PAUSED') return '已暂停'
  return '运行中'
})

const statusDotClass = computed(() => {
  const t = props.task
  if (t.status === 'STOPPED' && t.scannedCount === t.portLength) return 'dot-success'
  if (t.status === 'STOPPED') return 'dot-danger'
  if (t.status === 'PAUSED') return 'dot-warning'
  return 'dot-running'
})

const taskStateClass = computed(() => {
  const t = props.task
  if (t.status === 'STOPPED' && t.scannedCount === t.portLength) return 'completed'
  if (t.status === 'STOPPED') return 'stopped'
  if (t.status === 'PAUSED') return 'paused'
  return 'running'
})

function formatTimeShort(timestamp) {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

const handleExport = () => {
  const task = props.task
  const headers = ['主机地址', '任务ID', '扫描状态', '总端口数', '已扫描', '开放端口数', '开放端口', '创建时间']
  const openPorts = task.openPortList?.join(',') || ''
  const createTime = task.createTime ? new Date(task.createTime).toLocaleString('zh-CN') : ''
  const row = [
    task.scanHost || '',
    task.taskId || '',
    statusText.value,
    task.portLength || 0,
    task.scannedCount || 0,
    openCount.value,
    openPorts,
    createTime
  ]
  const csvContent = [
    headers.join(','),
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ].join('\n')
  const BOM = '﻿'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  link.setAttribute('href', url)
  link.setAttribute('download', `端口扫描_${task.scanHost}_${timestamp}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  showSuccess('扫描结果已导出')
}
</script>

<style scoped>
/* ── CSS custom properties ─────────────────────────────────────────── */
.task-item {
  --task-item-surface: var(--app-card-background);
  --task-item-muted-surface: var(--app-control-background-soft);
  --task-item-strong-surface: var(--app-control-background);
  --task-item-border-soft: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

:global(html:not(.dark) .task-item),
:global(html[data-theme='light'] .task-item) {
  --task-item-muted-surface: color-mix(in srgb, var(--app-control-background-soft) 82%, white);
  --task-item-strong-surface: var(--app-surface-background);
}

:global(html.dark .task-item),
:global(html[data-theme='dark'] .task-item) {
  --task-item-surface: color-mix(in srgb, var(--app-card-background) 80%, var(--app-surface-background));
  --task-item-muted-surface: color-mix(in srgb, var(--app-control-background-soft) 72%, var(--app-card-background));
  --task-item-strong-surface: color-mix(in srgb, var(--app-control-background) 84%, var(--app-card-background));
  --task-item-border-soft: color-mix(in srgb, var(--el-border-color) 54%, transparent);
}

/* ── Card ─────────────────────────────────────────────────────────── */
.task-item {
  background: var(--task-item-surface);
  border-radius: var(--radius-control);
  padding: 10px;
  border: 1px solid var(--task-item-border-soft);
  border-left: 3px solid transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.task-item:hover {
  box-shadow: none;
  transform: none;
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, var(--el-border-color));
  background: color-mix(in srgb, var(--task-item-surface) 96%, var(--el-color-primary));
}

/* State stripe colors */
.task-item.running {
  border-left-color: color-mix(in srgb, var(--el-color-primary) 70%, transparent);
}

.task-item.paused {
  border-left-color: var(--el-color-warning);
  background: var(--task-item-muted-surface);
}

.task-item.completed {
  border-left-color: color-mix(in srgb, var(--el-color-success) 55%, transparent);
}

.task-item.stopped {
  border-left-color: color-mix(in srgb, var(--el-border-color) 50%, transparent);
  background: var(--task-item-muted-surface);
}

/* ── Header ─────────────────────────────────────────────────────────── */
.task-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.task-checkbox {
  margin-top: 3px;
  flex-shrink: 0;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.task-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.task-host-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border-radius: var(--radius-tag);
  background: var(--task-item-strong-surface);
  border: 1px solid var(--task-item-border-soft);
  color: var(--el-text-color-primary);
  font-size: var(--el-font-size-small);
  font-weight: 700;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-id {
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-extra-small);
  font-family: var(--el-font-family-mono);
  white-space: nowrap;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* ── Status indicator ─────────────────────────────────────────────── */
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

.status-dot.dot-paused {
  background: var(--el-color-warning);
}

.status-dot.dot-success {
  background: var(--el-color-success);
}

.status-dot.dot-danger {
  background: var(--el-color-info);
}

.status-text {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.task-time {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ── Subline ─────────────────────────────────────────────────────── */
.task-subline {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.subline-open {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.subline-progress {
  color: var(--el-text-color-regular);
}

/* ── Actions ─────────────────────────────────────────────────────── */
.task-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  align-items: center;
}

/* ── Progress bar ────────────────────────────────────────────────── */
.task-progress-bar {
  height: 3px;
  background: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  border-radius: 999px;
  margin: 10px 0 0;
  overflow: hidden;
}

.task-progress-fill {
  height: 100%;
  background: var(--el-color-primary);
  border-radius: 999px;
  transition: width 0.5s ease;
}

.task-progress-fill.fill-paused {
  background: var(--el-color-warning);
}

/* ── Result toggle ────────────────────────────────────────────────── */
.task-result-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-control);
  background: var(--task-item-muted-surface);
  border: 1px solid var(--task-item-border-soft);
  cursor: pointer;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: background 0.15s ease, border-color 0.15s ease;
  user-select: none;
}

.task-result-toggle:hover {
  background: var(--task-item-strong-surface);
  border-color: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

.result-toggle-icon {
  font-size: 14px;
  color: var(--el-color-success);
}

.result-toggle-label {
  flex: 1;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.toggle-arrow {
  flex-shrink: 0;
  transition: transform 0.18s ease;
}

.toggle-arrow.collapsed {
  transform: rotate(-90deg);
}

/* ── Port chips ──────────────────────────────────────────────────── */
.port-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 2px 2px;
  max-height: 220px;
  overflow-y: auto;
}

.port-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-tag);
  background: var(--task-item-muted-surface);
  border: 1px solid var(--task-item-border-soft);
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family-mono);
  cursor: default;
}

/* ── Animation ───────────────────────────────────────────────────── */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: none;
}

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .task-main-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .task-meta {
    flex-wrap: wrap;
  }
}
</style>
