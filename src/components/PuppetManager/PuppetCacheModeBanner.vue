<template>
  <div class="cache-mode-banner">
    <div class="cache-banner-row">
      <el-icon class="cache-icon">
        <Icon :icon="iconMap.database" />
      </el-icon>
      <div class="cache-banner-text">
        <span class="cache-banner-title">连接失败，检测到本地缓存</span>
        <span
          v-if="result.saveTime"
          class="cache-banner-time"
        >
          采集于 {{ formatDate(result.saveTime) }}
        </span>
      </div>
      <el-button
        type="warning"
        size="small"
        :loading="loading"
        @click="emit('enter-cache-mode')"
      >
        进入缓存
      </el-button>
      <button
        class="result-dismiss"
        type="button"
        @click="emit('dismiss')"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup>
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'

const iconMap = icons

defineProps({
  result: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['enter-cache-mode', 'dismiss'])
</script>

<style scoped>
.cache-mode-banner {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 35%, transparent);
}

.cache-banner-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cache-icon {
  color: var(--el-color-warning);
  font-size: 16px;
  flex-shrink: 0;
}

.cache-banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cache-banner-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--pm-ink);
}

.cache-banner-time {
  font-size: 11px;
  color: var(--pm-muted);
}

.result-dismiss {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: var(--pm-muted);
  opacity: 0.7;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.result-dismiss:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--pm-muted) 12%, transparent);
}
</style>
