<template>
  <div
    v-if="steps.length"
    class="plan-step-list"
  >
    <div
      v-for="step in steps"
      :key="step.index"
      class="plan-step-item"
      :class="`is-${stepTone(step.status)}`"
    >
      <span class="step-num">
        <Icon
          v-if="stepIcon(step.status)"
          :icon="stepIcon(step.status)"
        />
        <template v-else>{{ step.index + 1 }}</template>
      </span>
      <div class="step-body">
        <div class="step-desc">
          {{ step.description }}
        </div>
        <div
          v-if="!compact && (step.toolHint || step.successCriteria)"
          class="step-meta"
        >
          <span
            v-if="step.toolHint"
            class="step-hint"
          >{{ step.toolHint }}</span>
          <span
            v-if="step.successCriteria"
            class="step-criteria"
          >{{ step.successCriteria }}</span>
        </div>
        <div
          v-if="step.result"
          class="step-result"
        >
          {{ step.result }}
        </div>
        <div
          v-if="step.reason"
          class="step-reason"
        >
          {{ step.reason }}
        </div>
      </div>
      <span class="step-status-label">{{ stepStatusLabel(step.status) }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  steps: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false }
})

function stepTone(status) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'primary'
  if (status === 'SKIPPED') return 'muted'
  return 'default'
}

function stepStatusLabel(status) {
  const map = {
    PENDING: '待执行', RUNNING: '执行中', COMPLETED: '已完成',
    FAILED: '失败', SKIPPED: '已跳过'
  }
  return map[status] ?? ''
}

function stepIcon(status) {
  const map = {
    RUNNING: 'mdi:progress-clock',
    COMPLETED: 'mdi:check',
    FAILED: 'mdi:close',
    SKIPPED: 'mdi:minus'
  }
  return map[status] ?? null
}
</script>

<style scoped>
.plan-step-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.plan-step-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 8px;
  font-size: 12px;
  border: 0;
  background: transparent;
}
.plan-step-item.is-success { background: color-mix(in srgb, var(--el-color-success) 3%, transparent); }
.plan-step-item.is-primary { background: color-mix(in srgb, var(--el-color-primary) 6%, transparent); }
.plan-step-item.is-danger  { background: color-mix(in srgb, var(--el-color-danger) 5%, transparent); }

.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
  font-size: 10px;
  font-weight: 700;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
}
.is-success .step-num { background: color-mix(in srgb, var(--el-color-success) 18%, transparent); color: var(--el-color-success); }
.is-primary .step-num { background: color-mix(in srgb, var(--el-color-primary) 18%, transparent); color: var(--el-color-primary); }
.is-danger .step-num { background: color-mix(in srgb, var(--el-color-danger) 14%, transparent); color: var(--el-color-danger); }

.step-body { flex: 1; min-width: 0; }
.step-desc { font-size: 12px; color: var(--el-text-color-primary); }

.step-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.step-hint, .step-criteria {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  font-family: ui-monospace, monospace;
}
.step-hint    { background: color-mix(in srgb, var(--el-color-primary) 10%, transparent); color: var(--el-color-primary); }
.step-criteria { background: color-mix(in srgb, var(--el-color-warning) 10%, transparent); color: var(--el-color-warning); }

.step-result { font-size: 11px; color: var(--el-text-color-secondary); margin-top: 2px; }
.step-reason { font-size: 10px; color: var(--el-color-danger); margin-top: 2px; font-style: italic; }

.step-status-label {
  font-size: 10px;
  flex-shrink: 0;
  font-family: ui-monospace, monospace;
  color: var(--el-text-color-secondary);
}
.is-success .step-status-label { color: var(--el-color-success); }
.is-primary .step-status-label { color: var(--el-color-primary); }
.is-danger .step-status-label { color: var(--el-color-danger); }
</style>
