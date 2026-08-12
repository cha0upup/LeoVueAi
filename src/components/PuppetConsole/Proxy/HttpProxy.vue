<template>
  <div class="http-proxy">
    <section class="workspace-strip">
      <div class="workspace-status">
        <span class="workspace-title">HTTP</span>
        <el-tag
          :type="statusTag.type"
          effect="plain"
          round
          size="small"
        >
          <el-icon><Icon :icon="statusTag.icon" /></el-icon>
          {{ statusTag.label }}
        </el-tag>
      </div>

      <div class="workspace-actions">
        <div class="port-control">
          <span class="control-label">监听端口</span>
          <el-input-number
            v-model="controlForm.port"
            :min="1024"
            :max="65535"
            :precision="0"
            controls-position="right"
            :disabled="isRunning"
          />
        </div>
        <el-button
          v-if="!isRunning"
          type="primary"
          :loading="starting"
          class="primary-action"
          @click="handleStart"
        >
          <el-icon><Icon :icon="iconMap.play" /></el-icon>
          启动代理
        </el-button>
        <el-button
          v-else
          type="danger"
          :loading="stopping"
          class="primary-action"
          @click="handleStop"
        >
          <el-icon><Icon :icon="iconMap.stop" /></el-icon>
          停止代理
        </el-button>
        <el-button
          text
          size="small"
          :disabled="!isRunning"
          @click="fetchStatistics"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          刷新统计
        </el-button>
      </div>
    </section>

    <section
      v-if="isRunning && statistics"
      class="stats-grid"
    >
      <article class="stats-card">
        <span class="stats-label">监听端口</span>
        <strong class="stats-value">{{ statistics.port ?? controlForm.port }}</strong>
        <span class="stats-helper">当前开放的 HTTP 代理入口</span>
      </article>
      <article class="stats-card">
        <span class="stats-label">活跃连接</span>
        <strong class="stats-value">{{ statistics.activeConnections ?? 0 }}</strong>
        <span class="stats-helper">当前仍保持中的连接</span>
      </article>
      <article class="stats-card">
        <span class="stats-label">累计连接</span>
        <strong class="stats-value">{{ statistics.totalConnections ?? 0 }}</strong>
        <span class="stats-helper">启动后累计建立的连接数</span>
      </article>
      <article class="stats-card">
        <span class="stats-label">运行时长</span>
        <strong class="stats-value">{{ formatUptime(statistics.uptime) }}</strong>
        <span class="stats-helper">代理服务连续运行时间</span>
      </article>
    </section>

    <section class="connections-panel">
      <div class="connections-head">
        <div class="connections-copy">
          <span class="connections-title">活跃连接</span>
          <span class="connections-subtitle">
            {{
              isRunning
                ? `上行 ${formatRate(statistics?.uploadRate)} · 下行 ${formatRate(statistics?.downloadRate)}`
                : '代理未启动，连接列表暂不可用'
            }}
          </span>
        </div>
        <el-tag
          size="small"
          effect="plain"
          type="info"
        >
          {{ statistics?.connections?.length ?? 0 }} 条
        </el-tag>
      </div>

      <div
        v-if="isRunning && statistics"
        class="table-shell"
      >
        <el-table
          v-if="statistics.connections?.length"
          :data="statistics.connections"
          :default-sort="{ prop: 'connectTime', order: 'descending' }"
          style="width: 100%"
        >
          <el-table-column
            prop="connId"
            label="连接 ID"
            width="120"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                type="info"
                effect="plain"
              >
                {{ row.connId.substring(0, 8) }}...
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="targetHost"
            label="目标主机"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="targetPort"
            label="目标端口"
            width="100"
            align="center"
          />
          <el-table-column
            prop="clientIp"
            label="客户端 IP"
            width="140"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="getIpTagType(row.clientIp)"
                effect="plain"
              >
                {{ row.clientIp }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="connectTime"
            label="连接时间"
            width="180"
            sortable
          >
            <template #default="{ row }">
              {{ formatDate(row.connectTime) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="uptime"
            label="连接时长"
            width="120"
            sortable
          >
            <template #default="{ row }">
              {{ formatUptime(row.uptime) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="uploadBytes"
            label="上传"
            width="120"
            sortable
          >
            <template #default="{ row }">
              {{ formatBytes(row.uploadBytes) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="downloadBytes"
            label="下载"
            width="120"
            sortable
          >
            <template #default="{ row }">
              {{ formatBytes(row.downloadBytes) }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-else
          description="暂无活跃连接"
          :image-size="88"
        />
      </div>

      <div
        v-else
        class="idle-shell"
      >
        <el-empty
          description="代理未启动"
          :image-size="88"
        >
          <template #description>
            <span>启动 HTTP 代理后，这里会展示连接列表和流量变化。</span>
          </template>
        </el-empty>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { icons } from '@/utils/icons.js'
import { formatDate, formatFileSize } from '@/utils/format.js'
import {
  getHttpProxyStatisticsApi,
  getHttpProxyStatusApi,
  startHttpProxyApi,
  stopHttpProxyApi
} from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { Icon } from '@iconify/vue'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['status-change', 'metrics-change'])

const starting = ref(false)
const stopping = ref(false)
const isRunning = ref(false)
const statistics = ref(null)
const refreshTimer = ref(null)

const controlForm = ref({
  port: 8080
})

const statusTag = computed(() => {
  if (isRunning.value) {
    return { type: 'success', icon: iconMap.success, label: '运行中' }
  }
  return { type: 'info', icon: iconMap.info, label: '未启动' }
})

const emitMetrics = () => {
  emit('metrics-change', {
    status: isRunning.value ? 'running' : 'stopped',
    activeConnections: statistics.value?.activeConnections ?? 0,
    totalConnections: statistics.value?.totalConnections ?? 0,
    port: statistics.value?.port ?? controlForm.value.port ?? null
  })
}

const formatBytes = (bytes) => ((bytes ?? 0) ? formatFileSize(bytes) : '0 B')
const formatRate = (rate) => ((rate ?? 0) ? `${formatFileSize(rate)}/s` : '0 B/s')

const formatUptime = (uptime) => {
  if (!uptime && uptime !== 0) return '-'
  const seconds = Math.floor(uptime / 1000)
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}天${hours}小时${minutes}分钟`
}

const getIpTagType = (ip) => {
  if (!ip) return 'info'
  if (ip.startsWith('127.') || ip === '::1') return 'info'
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return 'success'
  return 'warning'
}

const handleStart = async () => {
  if (!controlForm.value.port || controlForm.value.port < 1024 || controlForm.value.port > 65535) {
    showWarning('请输入有效的端口号（1024-65535）')
    return
  }
  starting.value = true
  try {
    await executeRequest(
      async () =>
        startHttpProxyApi({
          sessionId: props.sessionId,
          port: controlForm.value.port
        }),
      {
        loadingRef: starting,
        successMessage: 'HTTP 代理已启动',
        errorMessage: '代理启动失败'
      }
    )
    isRunning.value = true
    emit('status-change', 'running')
    await fetchStatistics()
    startAutoRefresh()
  } catch {
    emit('status-change', 'error')
  } finally {
    starting.value = false
    emitMetrics()
  }
}

const handleStop = async () => {
  stopping.value = true
  try {
    await executeRequest(
      async () =>
        stopHttpProxyApi({
          sessionId: props.sessionId
        }),
      {
        loadingRef: stopping,
        successMessage: 'HTTP 代理已停止',
        errorMessage: '停止代理失败'
      }
    )
    isRunning.value = false
    statistics.value = null
    emit('status-change', 'stopped')
    stopAutoRefresh()
  } catch {
    emit('status-change', 'error')
  } finally {
    stopping.value = false
    emitMetrics()
  }
}

const fetchStatistics = async () => {
  if (!isRunning.value) {
    emitMetrics()
    return
  }
  try {
    await executeRequest(
      async () => {
        const res = await getHttpProxyStatisticsApi({ sessionId: props.sessionId })
        statistics.value = res.data
        return res
      },
      { successMessage: null, errorMessage: '获取统计信息失败' }
    )
    emitMetrics()
  } catch (error) {
    if (error.message && error.message.includes('未启动')) {
      isRunning.value = false
      statistics.value = null
      emit('status-change', 'stopped')
      stopAutoRefresh()
      emitMetrics()
    }
  }
}

const startAutoRefresh = () => {
  stopAutoRefresh()
  refreshTimer.value = setInterval(fetchStatistics, 3000)
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

const checkProxyStatus = async () => {
  try {
    const res = await getHttpProxyStatusApi({ sessionId: props.sessionId })
    if (res.data?.running) {
      isRunning.value = true
      if (res.data.port) controlForm.value.port = res.data.port
      emit('status-change', 'running')
      await fetchStatistics()
      startAutoRefresh()
    } else {
      isRunning.value = false
      statistics.value = null
      emit('status-change', 'stopped')
      emitMetrics()
    }
  } catch {
    isRunning.value = false
    statistics.value = null
    emit('status-change', 'stopped')
    emitMetrics()
  }
}

onMounted(async () => {
  await checkProxyStatus()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.http-proxy {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-strip,
.stats-card,
.connections-panel {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  background: color-mix(in srgb, var(--app-card-background) 94%, var(--el-bg-color-overlay));
  box-shadow: var(--app-card-shadow-soft);
}

.workspace-strip {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  background: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--app-card-background)
  );
}

.workspace-status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.stats-label,
.control-label,
.connections-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.workspace-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.connections-subtitle,
.stats-helper {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.workspace-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-start;
  min-width: 0;
}

.port-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.port-control :deep(.el-input-number) {
  width: 180px;
}

.primary-action {
  min-width: 110px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stats-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 13px;
}

.stats-value {
  font-size: 22px;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.connections-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.connections-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 36%, transparent);
}

.connections-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-shell,
.idle-shell {
  flex: 1;
  min-height: 0;
  margin: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--app-control-background-soft) 90%, transparent);
  overflow: hidden;
}

.table-shell {
  padding: 8px;
}

.idle-shell {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.el-table) {
  font-size: 13px;
  --el-table-border-color: color-mix(in srgb, var(--el-border-color) 44%, transparent);
  --el-table-header-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--app-control-background) 72%, transparent);
  background: transparent;
}

:deep(.el-table th),
:deep(.el-table tr),
:deep(.el-table td),
:deep(.el-table__inner-wrapper::before) {
  background: transparent;
}

:deep(.el-table th) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

:deep(.el-table .el-tag) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

:deep(.el-empty) {
  padding: 28px 16px;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .workspace-strip {
    align-items: flex-start;
  }

  .workspace-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .workspace-actions {
    align-items: stretch;
  }

  .port-control {
    align-items: flex-start;
  }

  .table-shell,
  .idle-shell {
    margin: 10px;
  }
}
</style>
