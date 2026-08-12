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
            <span class="task-fingerprint-badge">
              <el-icon><Icon :icon="iconMap.fingerprint" /></el-icon>
              {{ task.fingerprintId }}
            </span>
            <span
              v-if="task.protocol"
              class="task-protocol-badge"
              :data-protocol="task.protocol"
            >
              {{ task.protocol.toUpperCase() }}
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
          <span>{{ task.targetCount || totalTargets }} 个目标</span>
          <span
            v-if="totalTargets > 0"
            :class="hitCount > 0 ? 'subline-hit' : ''"
          >
            命中 {{ hitCount }}
          </span>
        </div>
      </div>

      <div class="task-actions">
        <el-tooltip
          content="查询最新结果"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            :loading="task.isQuerying"
            :aria-label="`刷新指纹任务 ${task.taskName || task.taskId}`"
            @click="$emit('query', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip
          v-if="task.status === 'RUNNING'"
          content="暂停"
          placement="top"
        >
          <el-button
            circle
            text
            size="small"
            :aria-label="`暂停指纹任务 ${task.taskName || task.taskId}`"
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
            :aria-label="`继续指纹任务 ${task.taskName || task.taskId}`"
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
            :aria-label="`停止指纹任务 ${task.taskName || task.taskId}`"
            @click="$emit('stop', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.stop" /></el-icon>
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
            :aria-label="`删除指纹任务 ${task.taskName || task.taskId}`"
            @click="$emit('remove', task.taskId)"
          >
            <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- Thin progress bar (active tasks) -->
    <div
      v-if="task.status !== 'STOPPED' && totalTargets > 0"
      class="task-progress-bar"
    >
      <div
        class="task-progress-fill"
        :class="{ 'fill-paused': task.status === 'PAUSED' }"
        :style="{ width: progressPct + '%' }"
      />
    </div>

    <!-- Result summary toggle -->
    <div
      v-if="task.result != null"
      class="task-result-toggle"
      @click="showResult = !showResult"
    >
      <span class="result-toggle-label">扫描结果</span>
      <span
        v-if="totalTargets > 0"
        class="result-toggle-value"
      >命中 {{ hitCount }} / {{ totalTargets }}</span>
      <span
        v-else
        class="result-toggle-value"
      >暂无结果</span>
      <el-icon
        class="toggle-arrow"
        :class="{ collapsed: !showResult }"
      >
        <Icon :icon="iconMap.arrowDown" />
      </el-icon>
    </div>

    <transition name="fade-slide">
      <div
        v-if="task.result != null && showResult"
        class="task-results"
      >
        <div
          v-if="totalTargets > 0"
          class="result-grid"
        >
          <div
            v-for="item in resultEntries"
            :key="item.key"
            class="result-chip"
            :class="item.hit ? 'result-chip-hit' : 'result-chip-miss'"
            :title="item.key"
          >
            <span
              class="chip-dot"
              :class="item.hit ? 'chip-dot-hit' : 'chip-dot-miss'"
            />
            <span class="chip-label">{{ item.key }}</span>
            <span class="chip-tag">{{ item.hit ? '命中' : '未命中' }}</span>
          </div>
        </div>
        <div
          v-else
          class="result-empty"
        >
          暂无结果数据
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

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

const showResult = ref(true)

const handleSelect = (checked) => {
  emit('select', props.task.taskId, checked)
}

const shortTaskId = computed(() => {
  const taskId = props.task.taskId || '--'
  return taskId.length > 16 ? taskId.slice(-12) : taskId
})

const statusText = computed(() => {
  const s = props.task.status
  if (s === 'RUNNING') return '运行中'
  if (s === 'PAUSED') return '已暂停'
  if (s === 'STOPPED') return '已终止'
  return s || '—'
})

const statusDotClass = computed(() => {
  const s = props.task.status
  if (s === 'RUNNING') return 'dot-running'
  if (s === 'PAUSED') return 'dot-paused'
  return 'dot-stopped'
})

const taskStateClass = computed(() => {
  const s = props.task.status
  if (s === 'PAUSED') return 'paused'
  if (s === 'STOPPED') return 'stopped'
  return 'running'
})

const parsedResult = computed(() => {
  const r = props.task.result
  return r && typeof r === 'object' ? r : {}
})

const resultsMap = computed(() => {
  const m = parsedResult.value.results
  return m && typeof m === 'object' ? m : {}
})

const resultEntries = computed(() =>
  Object.entries(resultsMap.value).map(([key, hit]) => ({ key, hit: Boolean(hit) }))
)

const totalTargets = computed(() => resultEntries.value.length)
const hitCount = computed(() => resultEntries.value.filter((e) => e.hit).length)

// Progress: treat each target as a work item (completed when result is present)
const progressPct = computed(() => {
  const total = props.task.targetCount || 0
  if (total <= 0) return 0
  return Math.min(100, Math.round((totalTargets.value / total) * 100))
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

.task-item.running {
  border-left-color: color-mix(in srgb, var(--el-color-primary) 70%, transparent);
}

.task-item.paused {
  border-left-color: var(--el-color-warning);
  background: var(--task-item-muted-surface);
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

.task-fingerprint-badge {
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

.task-protocol-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: var(--radius-tag);
  border: 1px solid var(--task-item-border-soft);
  background: var(--task-item-muted-surface);
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-extra-small);
  font-weight: 700;
  letter-spacing: 0.03em;
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

.status-dot.dot-stopped {
  background: color-mix(in srgb, var(--el-border-color) 70%, transparent);
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

.subline-hit {
  color: var(--el-text-color-primary);
  font-weight: 600;
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
  gap: 8px;
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

.result-toggle-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.result-toggle-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle-arrow {
  flex-shrink: 0;
  transition: transform 0.18s ease;
}

.toggle-arrow.collapsed {
  transform: rotate(-90deg);
}

/* ── Results ─────────────────────────────────────────────────────── */
.task-results {
  margin-top: 10px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 6px;
}

.result-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 10px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  border: 1px solid var(--task-item-border-soft);
  background: var(--task-item-strong-surface);
}

.result-chip-hit {
  border-color: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

.result-chip-miss {
  opacity: 0.65;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.chip-dot-hit {
  background: var(--el-color-primary);
}

.chip-dot-miss {
  background: color-mix(in srgb, var(--el-border-color) 60%, transparent);
}

.chip-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

.chip-tag {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.result-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 2px;
}

/* ── Animation ───────────────────────────────────────────────────── */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
