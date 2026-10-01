<template>
  <div
    class="test-conn-result"
    :class="result.success ? 'result-ok' : 'result-fail'"
  >
    <div class="result-row">
      <span class="result-icon">{{ result.success ? '✓' : '✗' }}</span>
      <span class="result-title">{{ result.success ? '连接成功' : '连接失败' }}</span>
      <span
        v-if="result.latencyMs != null"
        class="result-latency"
      >{{ result.latencyMs }} ms</span>
      <button
        class="result-dismiss"
        type="button"
        @click="emit('dismiss')"
      >
        ×
      </button>
    </div>
    <div
      v-if="result.success"
      class="result-detail"
    >
      <span>Host ID：<code>{{ result.hostId || '-' }}</code></span>
    </div>
    <div
      v-else
      class="result-detail"
    >
      <span>{{ result.message || '连接无响应' }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  result: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['dismiss'])
</script>

<style scoped>
.test-conn-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 12px;
  line-height: 1.4;
  animation: fadeIn 0.18s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-ok {
  border-color: color-mix(in srgb, var(--pm-green) 30%, transparent);
  background: color-mix(in srgb, var(--pm-green) 8%, var(--pm-panel-strong));
  color: var(--pm-green);
}

.result-fail {
  border-color: color-mix(in srgb, var(--pm-red) 30%, transparent);
  background: color-mix(in srgb, var(--pm-red) 8%, var(--pm-panel-strong));
  color: var(--el-color-danger);
}

.result-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.result-icon {
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
}

.result-title {
  font-weight: 700;
  flex: 1;
}

.result-latency {
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 11px;
  font-weight: 700;
  font-family: var(--el-font-family-mono);
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
  color: currentColor;
  opacity: 0.6;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.result-dismiss:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.result-detail {
  color: var(--pm-muted);
  font-size: 11.5px;
}

.result-detail code {
  font-family: var(--el-font-family-mono);
  color: var(--pm-ink);
}
</style>
