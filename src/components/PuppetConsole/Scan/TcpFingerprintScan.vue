<template>
  <div class="fingerprint-workspace">
    <section class="workspace-section">
      <header class="section-heading">
        <div>
          <strong>TCP 指纹配置</strong>
          <span>选择规则并投递 host:port 目标</span>
        </div>
        <span class="section-step">01</span>
      </header>
      <FingerprintScanConfigForm
        protocol="tcp"
        :is-starting="isStarting"
        :initial-targets="initialTargets"
        @start-scan="startScan"
        @initial-targets-applied="$emit('initial-targets-applied')"
      />
    </section>

    <section class="workspace-section">
      <header class="section-heading">
        <div>
          <strong>识别任务</strong>
          <span>查看协议特征与规则命中结果</span>
        </div>
        <span class="section-step">02</span>
      </header>
      <FingerprintScanTaskList
        :tasks="tasks"
        :is-refreshing="isRefreshing"
        @refresh="refresh"
        @query="queryResult"
        @remove="remove"
        @batch-remove="batchRemove"
        @pause="pause"
        @resume="resume"
        @stop="stop"
      />
    </section>
  </div>
</template>

<script setup>
import { toRef } from 'vue'
import { useFingerprintScan } from '@/composables/useFingerprintScan.js'
import FingerprintScanConfigForm from './FingerprintScanConfigForm.vue'
import FingerprintScanTaskList from './FingerprintScanTaskList.vue'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  /** 从端口扫描结果批量带入的 TCP 目标 { host, port }[]，填入后由父组件清空 */
  initialTargets: {
    type: Array,
    default: () => []
  }
})

defineEmits(['initial-targets-applied'])

const sessionIdRef = toRef(props, 'sessionId')
const {
  tasks,
  isStarting,
  isRefreshing,
  startScan,
  queryResult,
  remove,
  batchRemove,
  refresh,
  pause,
  resume,
  stop
} = useFingerprintScan(sessionIdRef, 'tcp')

defineExpose({ tasks, queryResult, remove, batchRemove, refresh, pause, resume, stop })
</script>

<style scoped>
.fingerprint-workspace {
  --scan-section-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  display: grid;
  grid-template-columns: minmax(400px, 0.82fr) minmax(0, 1.18fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  min-height: 0;
  height: 100%;
  background: var(--app-page-background);
}

.workspace-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px;
  overflow: auto;
  background: var(--app-page-background);
}

.workspace-section + .workspace-section {
  border-top: 0;
  border-left: 1px solid var(--scan-section-border);
}

.workspace-section:first-child {
  align-self: stretch;
  height: 100%;
  max-height: none;
  border-bottom: 1px solid var(--scan-section-border);
  background: var(--app-page-background);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -10px -12px 4px;
  min-height: 48px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--scan-section-border);
  background: color-mix(in srgb, var(--app-control-background-soft) 72%, var(--app-card-background));
}

.section-heading > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-heading strong {
  font-size: 13px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.section-heading span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.section-step {
  font-family: var(--app-font-mono, monospace);
  color: color-mix(in srgb, var(--el-color-primary) 60%, var(--el-text-color-placeholder)) !important;
  font-weight: 700;
}

@media (max-width: 1200px) {
  .fingerprint-workspace {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }

  .workspace-section:first-child {
    height: auto;
  }

  .workspace-section + .workspace-section {
    border-top: 1px solid var(--scan-section-border);
    border-left: 0;
  }
}

</style>
