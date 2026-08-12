<template>
  <div
    class="scan-empty-state"
    role="status"
  >
    <span class="empty-icon-shell">
      <el-icon><Icon :icon="iconMap.scan" /></el-icon>
    </span>
    <div class="empty-copy">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.scan-empty-state {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px dashed color-mix(in srgb, var(--el-border-color) 42%, transparent);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--app-card-background) 58%, transparent);
}

.empty-icon-shell {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 16%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--app-card-background));
  color: var(--el-color-primary);
}

.empty-icon-shell .el-icon {
  font-size: 17px;
}

.empty-copy {
  min-width: 0;
}

.empty-copy strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
}

.empty-copy p {
  margin: 3px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.55;
}
</style>
