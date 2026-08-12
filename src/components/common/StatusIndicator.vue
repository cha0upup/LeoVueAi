<template>
  <span
    class="status-indicator"
    :class="[`status-indicator--${definition.tone}`, { 'is-compact': compact }]"
    role="status"
    :aria-label="displayLabel"
  >
    <span
      class="status-indicator__mark"
      aria-hidden="true"
    >
      <Icon :icon="definition.icon" />
    </span>
    <span class="status-indicator__label">{{ displayLabel }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const STATUS_DEFINITIONS = {
  online: { label: '在线', tone: 'success', icon: 'mdi:check-circle' },
  offline: { label: '离线', tone: 'neutral', icon: 'mdi:minus-circle' },
  normal: { label: '正常', tone: 'success', icon: 'mdi:check-circle' },
  running: { label: '运行中', tone: 'primary', icon: 'mdi:play-circle' },
  waiting: { label: '等待中', tone: 'warning', icon: 'mdi:clock-outline' },
  success: { label: '成功', tone: 'success', icon: 'mdi:check-circle' },
  warning: { label: '警告', tone: 'warning', icon: 'mdi:alert-circle' },
  failed: { label: '失败', tone: 'danger', icon: 'mdi:close-circle' },
  disabled: { label: '禁用', tone: 'neutral', icon: 'mdi:minus-circle-outline' },
  unconfigured: { label: '未配置', tone: 'neutral', icon: 'mdi:help-circle-outline' },
  untested: { label: '未测试', tone: 'neutral', icon: 'mdi:flask-empty-outline' },
  expired: { label: '已过期', tone: 'warning', icon: 'mdi:calendar-alert' },
  danger: { label: '危险', tone: 'danger', icon: 'mdi:alert-octagon' }
}

const props = defineProps({
  status: { type: String, default: 'normal' },
  label: { type: String, default: '' },
  compact: { type: Boolean, default: false }
})

const definition = computed(
  () =>
    STATUS_DEFINITIONS[props.status] ?? {
      label: props.status || '未知',
      tone: 'neutral',
      icon: 'mdi:help-circle-outline'
    }
)
const displayLabel = computed(() => props.label || definition.value.label)
</script>

<style scoped>
.status-indicator {
  --status-color: var(--status-info-color);
  --status-background: var(--status-info-bg);
  --status-border: var(--status-info-border);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 24px;
  padding: 0 var(--space-2);
  border: 1px solid var(--status-border);
  border-radius: var(--radius-tag);
  background: var(--status-background);
  color: var(--status-color);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.status-indicator__mark {
  display: inline-flex;
  font-size: 13px;
}
.status-indicator--primary {
  --status-color: var(--status-primary-color);
  --status-background: var(--status-primary-bg);
  --status-border: var(--status-primary-border);
}
.status-indicator--success {
  --status-color: var(--status-success-color);
  --status-background: var(--status-success-bg);
  --status-border: var(--status-success-border);
}
.status-indicator--warning {
  --status-color: var(--status-warning-color);
  --status-background: var(--status-warning-bg);
  --status-border: var(--status-warning-border);
}
.status-indicator--danger {
  --status-color: var(--status-danger-color);
  --status-background: var(--status-danger-bg);
  --status-border: var(--status-danger-border);
}
.status-indicator.is-compact {
  min-height: 20px;
  padding-inline: 6px;
}
</style>
