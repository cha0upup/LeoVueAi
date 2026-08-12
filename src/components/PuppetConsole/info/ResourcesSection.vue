<template>
  <section class="content-grid">
    <article class="content-card">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            硬件资源
          </div>
          <h3>CPU、内存与负载</h3>
        </div>
      </div>
      <div class="usage-stack">
        <div class="usage-panel">
          <div class="usage-title">
            物理内存
          </div>
          <el-progress
            :percentage="memoryUsagePercentage"
            :color="memoryColor"
            :stroke-width="10"
          />
          <div class="usage-meta">
            <span>可用 {{ formatMBValue(basicInfo.HardwareInfo?.FreePhysicalMemoryMB) }}</span>
            <span>总计 {{ formatMBValue(basicInfo.HardwareInfo?.TotalPhysicalMemoryMB) }}</span>
          </div>
        </div>
        <div class="usage-panel">
          <div class="usage-title">
            交换空间
          </div>
          <el-progress
            :percentage="swapUsagePercentage"
            :color="swapColor"
            :stroke-width="10"
          />
          <div class="usage-meta">
            <span>可用 {{ formatMBValue(basicInfo.HardwareInfo?.FreeSwapSpaceMB) }}</span>
            <span>总计 {{ formatMBValue(basicInfo.HardwareInfo?.TotalSwapSpaceMB) }}</span>
          </div>
        </div>
      </div>
      <div class="kv-grid">
        <div
          v-for="item in hardwareFacts"
          :key="item.label"
          class="kv-item"
        >
          <span class="kv-label">{{ item.label }}</span>
          <span class="kv-value">{{ item.value }}</span>
        </div>
      </div>
    </article>

    <article class="content-card content-card-wide">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            文件系统
          </div>
          <h3>所有挂载点与容量使用</h3>
        </div>
      </div>
      <div class="table-shell">
        <el-table
          :data="sortedFileSystems"
          stripe
        >
          <el-table-column
            prop="Root"
            label="挂载点"
            min-width="180"
          >
            <template #default="{ row }">
              <span class="mono-text">{{ row.Root || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="Type"
            label="类型"
            width="120"
          />
          <el-table-column
            label="总空间"
            width="120"
          >
            <template #default="{ row }">
              {{ formatMBValue(row.TotalSpaceMB) }}
            </template>
          </el-table-column>
          <el-table-column
            label="已用空间"
            width="120"
          >
            <template #default="{ row }">
              {{ formatMBValue(row.UsedSpaceMB) }}
            </template>
          </el-table-column>
          <el-table-column
            label="可用空间"
            width="120"
          >
            <template #default="{ row }">
              {{ formatMBValue(row.UsableSpaceMB) }}
            </template>
          </el-table-column>
          <el-table-column
            label="使用率"
            width="140"
          >
            <template #default="{ row }">
              <div class="usage-inline">
                <el-progress
                  :percentage="Math.round(row.UsagePercent || 0)"
                  :color="getDiskUsageColor(row.UsagePercent)"
                  :stroke-width="6"
                  :show-text="false"
                />
                <span>{{ formatPercent(row.UsagePercent) }}</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </article>

    <article class="content-card content-card-wide">
      <div class="card-header">
        <div>
          <div class="section-eyebrow">
            网络接口
          </div>
          <h3>网卡状态与地址</h3>
        </div>
      </div>
      <div class="table-shell">
        <el-table
          :data="basicInfo.NetworkInfo"
          stripe
        >
          <el-table-column
            prop="DisplayName"
            label="网卡名称"
            min-width="120"
          />
          <el-table-column
            prop="Name"
            label="标识"
            min-width="100"
          >
            <template #default="{ row }">
              <span class="mono-text">{{ row.Name || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="MACAddress"
            label="MAC"
            min-width="135"
          >
            <template #default="{ row }">
              <span class="mono-text">{{ row.MACAddress || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="MTU"
            label="MTU"
            width="72"
          />
          <el-table-column
            label="状态"
            width="76"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.IsUp ? 'success' : 'info'"
                round
                size="small"
              >
                {{ row.IsUp ? '在线' : '离线' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="IP 地址"
            min-width="180"
          >
            <template #default="{ row }">
              <div class="ip-list">
                <el-tag
                  v-for="ip in row.IPAddresses || []"
                  :key="ip"
                  :type="getIPType(ip)"
                  size="small"
                >
                  {{ ip }}
                </el-tag>
                <span
                  v-if="!row.IPAddresses?.length"
                  class="text-muted"
                >-</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  basicInfo: {
    type: Object,
    required: true
  }
})

const formatMemory = (bytes) => {
  if (!bytes || bytes === 0) return '0 MB'
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`
  }
  return `${Math.round(mb)} MB`
}

const formatMBValue = (value) => formatMemory((value || 0) * 1024 * 1024)

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

const getUsageColor = (usage) => {
  if (usage > 90) return '#cf4e57'
  if (usage > 75) return '#c27a1f'
  return '#3f9a57'
}

const getDiskUsageColor = (usage) => getUsageColor(usage || 0)

const getIPType = (ip) => {
  if (ip.startsWith('127.') || ip === '::1') return 'info'
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.'))
    return 'primary'
  return 'success'
}

const memoryUsagePercentage = computed(() => {
  const total = props.basicInfo.HardwareInfo?.TotalPhysicalMemoryMB
  const free = props.basicInfo.HardwareInfo?.FreePhysicalMemoryMB
  if (!total || free === undefined) return 0
  return Math.round(((total - free) / total) * 100)
})

const swapUsagePercentage = computed(() => {
  const total = props.basicInfo.HardwareInfo?.TotalSwapSpaceMB
  const free = props.basicInfo.HardwareInfo?.FreeSwapSpaceMB
  if (!total || free === undefined) return 0
  return Math.round(((total - free) / total) * 100)
})

const memoryColor = computed(() => getUsageColor(memoryUsagePercentage.value))
const swapColor = computed(() => getUsageColor(swapUsagePercentage.value))

const sortedFileSystems = computed(() =>
  [...(props.basicInfo.FileSystemInfo || [])].sort(
    (a, b) => (b.UsagePercent || 0) - (a.UsagePercent || 0)
  )
)

const hardwareFacts = computed(() => [
  { label: 'CPU 核心数', value: props.basicInfo.HardwareInfo?.AvailableProcessors || '-' },
  { label: '系统负载', value: props.basicInfo.HardwareInfo?.SystemLoadAverage || '-' },
  { label: '内存使用率', value: formatPercent(memoryUsagePercentage.value) },
  { label: '交换空间使用率', value: formatPercent(swapUsagePercentage.value) }
])
</script>

<style scoped>
.content-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.content-card {
  padding: 16px;
  min-width: 0;
  border: 1px solid var(--info-border);
  border-radius: var(--radius-container);
  background: var(--info-surface);
  box-shadow: none;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-header h3 {
  margin: 2px 0 0;
  font-size: 16px;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.section-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.content-card-wide {
  grid-column: 1 / -1;
}

.usage-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.usage-panel {
  padding: 12px 13px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

.usage-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.usage-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.usage-meta > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.kv-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
}

.kv-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.kv-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.table-shell {
  border: 1px solid var(--info-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--info-surface-soft);
}

.usage-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}

.usage-inline :deep(.el-progress) {
  flex: 1;
}

.mono-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.ip-list :deep(.el-tag) {
  max-width: 100%;
  height: auto;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.ip-list :deep(.el-tag__content) {
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.table-shell :deep(.el-table) {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: var(--info-surface);
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 5%, var(--info-surface-soft));
}

.table-shell :deep(.el-table),
.table-shell :deep(.el-table__inner-wrapper),
.table-shell :deep(.el-table tr),
.table-shell :deep(.el-table td),
.table-shell :deep(.el-table th) {
  background: transparent;
}

.table-shell :deep(.el-table__inner-wrapper::before) {
  background: transparent;
}

.table-shell :deep(.el-table td),
.table-shell :deep(.el-table th) {
  padding-top: 7px;
  padding-bottom: 7px;
}

.table-shell :deep(.cell) {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 980px) {
  .content-grid,
  .kv-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .usage-meta {
    flex-direction: column;
  }
}
</style>
