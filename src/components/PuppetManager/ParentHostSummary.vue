<template>
  <section
    class="parent-host-summary"
    aria-label="父节点信息"
  >
    <div class="parent-host-summary__icon">
      <el-icon><Icon :icon="iconMap.network" /></el-icon>
    </div>

    <div class="parent-host-summary__content">
      <span class="parent-host-summary__label">父节点</span>
      <strong class="parent-host-summary__name">
        {{ host?.puppetName || host?.puppetId || '未选择' }}
      </strong>
      <span
        class="parent-host-summary__address"
        :title="host?.connLink || ''"
      >
        <el-icon><Icon :icon="iconMap.link" /></el-icon>
        {{ host?.connLink || '未配置连接地址' }}
      </span>
    </div>

    <StatusIndicator
      :status="status"
      :label="statusLabel"
      compact
      class="parent-host-summary__status"
    />
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

defineProps({
  host: { type: Object, default: null },
  status: { type: String, default: 'untested' },
  statusLabel: { type: String, default: '' }
})
</script>

<style scoped>
.parent-host-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 14%, var(--el-border-color));
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-primary) 3%, var(--dialog-surface-muted));
}

.parent-host-summary__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
  font-size: 17px;
}

.parent-host-summary__content {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 3px 10px;
  min-width: 0;
  flex: 1;
}

.parent-host-summary__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.parent-host-summary__name {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parent-host-summary__address {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parent-host-summary__address .el-icon {
  flex: 0 0 auto;
}

.parent-host-summary__status {
  flex: 0 0 auto;
}

@media (max-width: 600px) {
  .parent-host-summary {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .parent-host-summary__content {
    width: calc(100% - 46px);
    flex: 0 1 calc(100% - 46px);
  }

  .parent-host-summary__status {
    margin-left: 46px;
  }
}
</style>
