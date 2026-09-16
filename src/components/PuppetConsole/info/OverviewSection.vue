<template>
  <section class="info-section">
    <div class="metric-grid content-card-wide">
      <article
        v-for="metric in headlineMetrics"
        :key="metric.label"
        class="metric-card"
      >
        <div class="metric-icon-shell">
          <el-icon class="metric-icon">
            <Icon :icon="metric.icon" />
          </el-icon>
        </div>
        <div class="metric-copy">
          <span class="metric-label">{{ metric.label }}</span>
          <strong class="metric-value">{{ metric.value }}</strong>
          <span class="metric-helper">{{ metric.helper }}</span>
        </div>
      </article>
    </div>

    <article class="content-card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            运行画像
          </div>
          <h3>当前进程与运行时</h3>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in runtimeFacts"
          :key="item.label"
          class="kv-item"
        >
          <span class="kv-label">{{ item.label }}</span>
          <span
            class="kv-value"
            :class="{ mono: item.mono }"
          >{{ item.value }}</span>
        </div>
      </div>
    </article>

    <article class="content-card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            存储快照
          </div>
          <h3>优先看最接近瓶颈的挂载点</h3>
        </div>
      </div>
      <div class="storage-list">
        <div
          v-for="disk in topFileSystems"
          :key="disk.Root || disk.Type"
          class="storage-item"
        >
          <div class="storage-top">
            <div>
              <strong>{{ disk.Root || '-' }}</strong>
              <span>{{ disk.Type || '未知类型' }}</span>
            </div>
            <el-tag
              :type="getUsageType(disk.UsagePercent || 0)"
              round
            >
              {{ formatPercent(disk.UsagePercent) }}
            </el-tag>
          </div>
          <el-progress
            :percentage="Math.round(disk.UsagePercent || 0)"
            :color="getUsageColor(disk.UsagePercent)"
            :stroke-width="8"
            :show-text="false"
          />
          <div class="storage-meta">
            <span>已用 {{ formatMBValue(disk.UsedSpaceMB) }}</span>
            <span>可用 {{ formatMBValue(disk.UsableSpaceMB) }}</span>
          </div>
        </div>
      </div>
    </article>

    <article class="content-card content-card-wide">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            网络快照
          </div>
          <h3>优先看在线接口与可达地址</h3>
        </div>
      </div>
      <div class="network-card-list">
        <div
          v-for="net in activeNetworkInterfaces"
          :key="net.Name || net.DisplayName"
          class="network-card"
        >
          <div class="network-card-top">
            <strong>{{ net.DisplayName || net.Name || '-' }}</strong>
            <el-tag
              type="success"
              round
            >
              在线
            </el-tag>
          </div>
          <div class="network-card-meta mono-text">
            {{ net.Name || '-' }}
          </div>
          <div class="ip-list">
            <el-tag
              v-for="ip in net.IPAddresses || []"
              :key="ip"
              :type="getIPType(ip)"
              size="small"
            >
              {{ ip }}
            </el-tag>
            <span
              v-if="!net.IPAddresses?.length"
              class="text-muted"
            >无地址</span>
          </div>
        </div>
        <div
          v-if="!activeNetworkInterfaces.length"
          class="empty-note"
        >
          当前没有检测到已启用网卡。
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  formatMBValue,
  formatPercent,
  getUsageColor,
  getIPType,
  getResourceUsage,
  getUsageType
} from './infoModel.js'
import { icons } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'

const iconMap = icons

const props = defineProps({
  basicInfo: {
    type: Object,
    required: true
  }
})

const resources = computed(() => getResourceUsage(props.basicInfo))
const topFileSystems = computed(() => resources.value.disks.slice(0, 3))
const activeNetworkInterfaces = computed(() =>
  (props.basicInfo.NetworkInfo || []).filter((item) => item.IsUp)
)

const headlineMetrics = computed(() => [
  {
    label: '物理内存',
    value: formatPercent(resources.value.memory),
    helper: `${formatMBValue(props.basicInfo.HardwareInfo?.FreePhysicalMemoryMB)} 可用`,
    icon: iconMap.cpu
  },
  {
    label: '交换空间',
    value: formatPercent(resources.value.swap),
    helper: `${formatMBValue(props.basicInfo.HardwareInfo?.FreeSwapSpaceMB)} 可用`,
    icon: iconMap.hardDrive
  },
  {
    label: '磁盘挂载',
    value: `${props.basicInfo.FileSystemInfo?.length || 0}`,
    helper: topFileSystems.value[0]
      ? `${topFileSystems.value[0].Root || '-'} ${formatPercent(topFileSystems.value[0].UsagePercent)}`
      : '无挂载信息',
    icon: iconMap.folder
  },
  {
    label: '在线网卡',
    value: `${activeNetworkInterfaces.value.length}`,
    helper: `${props.basicInfo.NetworkInfo?.length || 0} 个接口`,
    icon: iconMap.connection
  }
])

const runtimeFacts = computed(() => [
  { label: '进程名称', value: props.basicInfo.ProcessInfo?.ProcessName || '-' },
  { label: 'PID', value: props.basicInfo.ProcessInfo?.ProcessId || '-', mono: true },
  { label: '启动时间', value: formatDateTime(props.basicInfo.ProcessInfo?.StartTime) },
  { label: '运行时间', value: props.basicInfo.ProcessInfo?.Uptime || '-' },
  {
    label: props.basicInfo.PhpRuntimeInfo?.PHPVersion ? 'PHP' : 'JVM',
    value:
      props.basicInfo.PhpRuntimeInfo?.PHPVersion ||
      props.basicInfo.JavaRuntimeInfo?.JVMName ||
      '未发现'
  },
  {
    label: props.basicInfo.PhpRuntimeInfo?.PHPVersion ? 'SAPI' : '线程数',
    value:
      props.basicInfo.PhpRuntimeInfo?.SAPI || props.basicInfo.JavaRuntimeInfo?.ThreadCount || '-'
  }
])
</script>

<style scoped>
.metric-card {
  border: 1px solid var(--info-border);
  border-radius: var(--radius-container);
  background: var(--info-surface);
  box-shadow: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}

.kv-item {
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-icon-shell {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, white);
  color: var(--el-color-primary);
}

.metric-icon {
  font-size: 20px;
}

.metric-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.metric-value {
  font-size: 18px;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.metric-helper {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
}

.storage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.storage-item {
  min-width: 0;
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
}

.storage-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.storage-top strong {
  display: block;
  color: var(--el-text-color-primary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.storage-top > div {
  flex: 1;
  min-width: 0;
}

.storage-top > :deep(.el-tag) {
  flex-shrink: 0;
}

.storage-top span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.storage-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.storage-meta > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.network-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  min-width: 0;
}

.network-card {
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
  min-width: 0;
  overflow: hidden;
}

.network-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.network-card-top strong {
  display: block;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-card-top > :first-child {
  min-width: 0;
}

.network-card-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ip-list {
  margin-top: 10px;
}

.network-card .ip-list :deep(.el-tag) {
  max-width: 100%;
  height: auto;
  line-height: 1.35;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.network-card .ip-list :deep(.el-tag__content) {
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.empty-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

@media (max-width: 1200px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
  .network-card-list {
    grid-template-columns: 1fr;
  }

  .storage-meta {
    flex-direction: column;
  }
}
</style>
