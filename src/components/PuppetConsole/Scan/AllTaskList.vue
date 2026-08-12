<template>
  <div class="all-task-list">
    <div
      v-if="allTasks.length === 0"
      class="all-task-empty"
    >
      <ScanEmptyState
        title="暂无扫描任务"
        description="端口、指纹和侦察任务创建后，将在这里统一汇总。"
      />
    </div>

    <template v-else>
      <!-- Summary bar -->
      <div class="all-task-summary">
        <span class="summary-pill">共 {{ allTasks.length }} 个任务</span>
        <span
          v-if="activeCount > 0"
          class="summary-pill summary-pill-active"
        >{{ activeCount }} 活跃中</span>
        <span
          v-if="portCount > 0"
          class="summary-type-dot"
        >
          <span class="type-dot type-dot-port" />
          端口 {{ portCount }}
        </span>
        <span
          v-if="fpCount > 0"
          class="summary-type-dot"
        >
          <span class="type-dot type-dot-fp" />
          指纹 {{ fpCount }}
        </span>
        <span
          v-if="reconCount > 0"
          class="summary-type-dot"
        >
          <span class="type-dot type-dot-recon" />
          侦察 {{ reconCount }}
        </span>
      </div>

      <!-- Task list -->
      <div class="all-task-items">
        <template
          v-for="task in allTasks"
          :key="task.taskId + task._kind"
        >
          <div class="all-task-wrapper">
            <!-- Type label strip -->
            <div
              class="task-kind-label"
              :class="`task-kind-${task._kind}`"
            >
              {{ kindLabel(task._kind) }}
            </div>
            <ScanTaskItem
              v-if="task._kind === 'port_scan'"
              :task="task"
              :selected="false"
              @pause="$emit('pause', { taskId: $event, kind: task._kind })"
              @resume="$emit('resume', { taskId: $event, kind: task._kind })"
              @stop="$emit('stop', { taskId: $event, kind: task._kind })"
              @remove="$emit('remove', { taskId: $event, kind: task._kind })"
              @query="$emit('query', { taskId: $event, kind: task._kind })"
            />
            <FingerprintScanTaskItem
              v-else-if="task._kind === 'fingerprint_tcp' || task._kind === 'fingerprint_http'"
              :task="task"
              :selected="false"
              @pause="$emit('pause', { taskId: $event, kind: task._kind })"
              @resume="$emit('resume', { taskId: $event, kind: task._kind })"
              @stop="$emit('stop', { taskId: $event, kind: task._kind })"
              @remove="$emit('remove', { taskId: $event, kind: task._kind })"
              @query="$emit('query', { taskId: $event, kind: task._kind })"
            />
            <ReconScanTaskItem
              v-else-if="task._kind === 'recon_scan'"
              :task="task"
              :selected="false"
              @pause="$emit('pause', { taskId: $event, kind: task._kind })"
              @resume="$emit('resume', { taskId: $event, kind: task._kind })"
              @stop="$emit('stop', { taskId: $event, kind: task._kind })"
              @remove="$emit('remove', { taskId: $event, kind: task._kind })"
              @query="$emit('query', { taskId: $event, kind: task._kind })"
            />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ScanTaskItem from './ScanTaskItem.vue'
import FingerprintScanTaskItem from './FingerprintScanTaskItem.vue'
import ReconScanTaskItem from './ReconScanTaskItem.vue'
import ScanEmptyState from './ScanEmptyState.vue'

const props = defineProps({
  allTasks: {
    type: Array,
    default: () => []
  }
})

defineEmits(['pause', 'resume', 'stop', 'remove', 'query'])

const activeCount = computed(() => props.allTasks.filter((t) => t.status !== 'STOPPED').length)
const portCount = computed(() => props.allTasks.filter((t) => t._kind === 'port_scan').length)
const fpCount = computed(() => props.allTasks.filter((t) => t._kind?.startsWith('fingerprint')).length)
const reconCount = computed(() => props.allTasks.filter((t) => t._kind === 'recon_scan').length)

function kindLabel(kind) {
  if (kind === 'port_scan') return '端口扫描'
  if (kind === 'fingerprint_tcp') return 'TCP 指纹'
  if (kind === 'fingerprint_http') return 'HTTP 指纹'
  if (kind === 'recon_scan') return '侦察扫描'
  return kind
}
</script>

<style scoped>
.all-task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.all-task-empty {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  min-height: 0;
  padding: 6px 4px;
  background: var(--app-page-background);
}

/* ── Summary bar ─────────────────────────────────────────────────── */
.all-task-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-radius: var(--radius-control);
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

.summary-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: var(--el-font-size-extra-small);
  font-weight: 600;
  background: color-mix(in srgb, var(--el-border-color) 12%, transparent);
  color: var(--el-text-color-secondary);
}

.summary-pill-active {
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  color: var(--el-color-primary);
}

.summary-type-dot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.type-dot-port {
  background: color-mix(in srgb, var(--el-color-primary) 55%, transparent);
}

.type-dot-fp {
  background: color-mix(in srgb, var(--el-color-warning) 55%, transparent);
}

.type-dot-recon {
  background: color-mix(in srgb, var(--el-color-success) 55%, transparent);
}

/* ── Task list ───────────────────────────────────────────────────── */
.all-task-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.all-task-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Kind label ──────────────────────────────────────────────────── */
.task-kind-label {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  height: 20px;
  padding: 0 9px;
  border-radius: 6px 6px 0 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-border-color) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  border-bottom: none;
  margin-bottom: -1px;
  position: relative;
  z-index: 1;
}

.task-kind-port_scan {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 20%, transparent);
}

.task-kind-fingerprint_tcp,
.task-kind-fingerprint_http {
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 8%, transparent);
  border-color: color-mix(in srgb, var(--el-color-warning) 20%, transparent);
}

.task-kind-recon_scan {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 8%, transparent);
  border-color: color-mix(in srgb, var(--el-color-success) 20%, transparent);
}
</style>
