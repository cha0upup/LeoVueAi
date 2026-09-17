<template>
  <section class="info-section overview-section">
    <div class="metric-grid">
      <article
        v-for="metric in headlineMetrics"
        :key="metric.label"
        class="metric-card"
        :class="metric.tone"
      >
        <span class="metric-label">{{ metric.label }}</span>
        <strong class="metric-value">{{ metric.value }}</strong>
        <span class="metric-helper">{{ metric.helper }}</span>
      </article>
    </div>

    <div class="overview-details">
      <div class="overview-sidebar">
        <article class="content-card">
          <header class="overview-heading">
            <h3>进程信息</h3>
            <el-button
              text
              type="primary"
              size="small"
              @click="emit('navigate', 'runtime')"
            >
              运行详情
            </el-button>
          </header>
          <div class="process-name">
            <span class="fact-label">进程名称</span>
            <div class="process-value">
              <code>{{ basicInfo.ProcessInfo?.ProcessName || '—' }}</code>
              <el-button
                v-if="basicInfo.ProcessInfo?.ProcessName"
                text
                size="small"
                aria-label="复制进程名称"
                @click="copyProcessName"
              >
                复制
              </el-button>
            </div>
          </div>
          <dl class="process-facts">
            <div
              v-for="item in runtimeFacts"
              :key="item.label"
              :class="{ 'fact-wide': item.wide }"
            >
              <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
            </div>
          </dl>
        </article>

        <article class="content-card">
          <header class="overview-heading">
            <h3>主要网络接口</h3>
            <el-button
              text
              type="primary"
              size="small"
              @click="emit('navigate', 'resources')"
            >
              全部接口{{ Array.isArray(basicInfo.NetworkInfo) ? `（${basicInfo.NetworkInfo.length}）` : '' }}
            </el-button>
          </header>
          <div class="network-list">
            <div
              v-for="net in primaryNetworks"
              :key="net.Name || net.DisplayName"
              class="network-row"
            >
              <div class="network-name">
                <strong>{{ net.Name || net.DisplayName || '—' }}</strong>
                <span v-if="net.DisplayName && net.DisplayName !== net.Name">{{ net.DisplayName }}</span>
              </div>
              <div class="network-addresses">
                <code
                  v-for="ip in net.IPAddresses"
                  :key="ip"
                >{{ ip }}</code>
              </div>
              <span class="network-status">已启用</span>
            </div>
            <p
              v-if="!primaryNetworks.length"
              class="empty-note"
            >
              暂无主要接口地址，可在资源页查看隧道、回环及其他接口。
            </p>
          </div>
          <p class="section-note">
            最多展示 3 个已启用的主要接口；隧道、回环及链路本地地址见全部接口。启用状态不代表可达性。
          </p>
        </article>
      </div>

      <article class="content-card storage-card">
        <header class="overview-heading">
          <h3>磁盘使用</h3>
          <el-button
            text
            type="primary"
            size="small"
            @click="emit('navigate', 'resources')"
          >
            全部挂载点
          </el-button>
        </header>
        <p class="section-note">
          按容量使用率排序，特殊文件系统不参与排名。
        </p>
        <div class="storage-list">
          <div
            v-for="disk in capacityDisks"
            :key="disk.Root || disk.Name"
            class="storage-item"
          >
            <div class="storage-top">
              <code>{{ disk.Root || '—' }}</code>
              <span class="storage-type">{{ disk.Type || '未知类型' }}</span>
              <strong :style="{ color: getUsageColor(disk.UsagePercent) }">{{ formatPercent(disk.UsagePercent) }}</strong>
            </div>
            <el-progress
              v-if="disk.UsagePercent != null"
              :percentage="Math.min(100, Math.max(0, Number(disk.UsagePercent) || 0))"
              :color="getUsageColor(disk.UsagePercent)"
              :stroke-width="5"
              :show-text="false"
            />
            <div class="storage-meta">
              <span>可用 {{ formatMBValue(disk.UsableSpaceMB) }}</span><span>总计 {{ formatMBValue(disk.TotalSpaceMB) }}</span>
            </div>
          </div>
          <p
            v-if="!capacityDisks.length"
            class="empty-note"
          >
            暂无可用于容量统计的挂载点。
          </p>
        </div>
      </article>
    </div>
    <p class="measurement-note">
      内存占用率按（总量 − 空闲）/ 总量计算，不等同于系统内存压力。数据为最近一次采集快照。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { formatMBValue, formatPercent, getUsageColor, getUsageType, getResourceUsage, getNetworkOverview } from './infoModel.js'
import { formatDate as formatDateTime } from '@/utils/format.js'

const props = defineProps({ basicInfo: { type: Object, required: true } })
const emit = defineEmits(['navigate'])
const resources = computed(() => getResourceUsage(props.basicInfo))
const capacityDisks = computed(() => resources.value.capacityDisks)
const primaryNetworks = computed(() => getNetworkOverview(props.basicInfo.NetworkInfo).slice(0, 3))
const headlineMetrics = computed(() => {
  const hardware = props.basicInfo.HardwareInfo || {}
  const noSwap = hardware.TotalSwapSpaceMB != null && Number(hardware.TotalSwapSpaceMB) === 0
  return [
    {
      label: '物理内存占用', value: formatPercent(resources.value.memory),
      helper: `空闲 ${formatMBValue(hardware.FreePhysicalMemoryMB)} / ${formatMBValue(hardware.TotalPhysicalMemoryMB)}`,
      tone: getUsageType(resources.value.memory)
    },
    {
      label: '交换空间占用', value: noSwap ? '未启用' : formatPercent(resources.value.swap),
      helper: `空闲 ${formatMBValue(hardware.FreeSwapSpaceMB)} / ${formatMBValue(hardware.TotalSwapSpaceMB)}`,
      tone: getUsageType(resources.value.swap)
    },
    {
      label: '容量挂载点', value: Array.isArray(props.basicInfo.FileSystemInfo) ? resources.value.capacityDisks.length : '—',
      helper: capacityDisks.value[0] ? `最高 ${formatPercent(capacityDisks.value[0].UsagePercent)}` : '暂无容量信息'
    },
    {
      label: '已启用接口', value: Array.isArray(props.basicInfo.NetworkInfo) ? props.basicInfo.NetworkInfo.filter(net => net.IsUp).length : '—',
      helper: Array.isArray(props.basicInfo.NetworkInfo) ? `共 ${props.basicInfo.NetworkInfo.length} 个接口` : '暂无接口信息'
    }
  ]
})
const runtimeFacts = computed(() => [
  { label: 'PID', value: props.basicInfo.ProcessInfo?.ProcessId ?? '—' },
  { label: '运行时间', value: props.basicInfo.ProcessInfo?.Uptime || '—' },
  { label: '启动时间', value: formatDateTime(props.basicInfo.ProcessInfo?.StartTime), wide: true },
  {
    label: props.basicInfo.PhpRuntimeInfo?.PHPVersion ? 'PHP / SAPI' : 'JVM / 线程数', wide: true,
    value: props.basicInfo.PhpRuntimeInfo?.PHPVersion
      ? `${props.basicInfo.PhpRuntimeInfo.PHPVersion} / ${props.basicInfo.PhpRuntimeInfo.SAPI || '—'}`
      : `${props.basicInfo.JavaRuntimeInfo?.JVMName || '—'} / ${props.basicInfo.JavaRuntimeInfo?.ThreadCount ?? '—'}`
  }
])
async function copyProcessName() {
  try {
    await navigator.clipboard.writeText(props.basicInfo.ProcessInfo.ProcessName)
    ElMessage.success('已复制进程名称')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}
</script>

<style scoped>
.info-section.overview-section { display: flex; flex-direction: column; align-items: stretch; flex: 1; }
.overview-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; flex: 1; }
.overview-sidebar { display: grid; align-content: start; gap: 12px; min-width: 0; }
.storage-card { display: flex; flex-direction: column; min-height: 0; }
.storage-list { flex: 1; min-height: 180px; contain: size; overflow: auto; scrollbar-gutter: stable; }
.storage-card > .overview-heading, .storage-card > .section-note { flex-shrink: 0; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.metric-card { display: grid; gap: 6px; min-width: 0; padding: 12px 14px; border: 1px solid var(--info-border); border-radius: var(--radius-container); background: var(--info-surface); }
.metric-label, .fact-label, .process-facts dt { color: var(--el-text-color-secondary); font-size: 12px; }
.metric-value { color: var(--el-text-color-primary); font-size: 20px; line-height: 1.25; font-variant-numeric: tabular-nums; }
.metric-card.danger .metric-value { color: var(--el-color-danger); }
.metric-card.warning .metric-value { color: var(--el-color-warning); }
.metric-card.danger { border-color: color-mix(in srgb, var(--el-color-danger) 40%, var(--info-border)); }
.metric-helper { color: var(--el-text-color-secondary); font-size: 11px; overflow-wrap: anywhere; }
.overview-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.overview-heading h3 { margin: 0; font-size: 14px; font-weight: 600; }
.overview-heading :deep(.el-button) { min-height: 24px; height: 24px; padding: 0; }
.process-name { padding-bottom: 12px; border-bottom: 1px solid var(--info-border); }
.process-value { display: flex; align-items: flex-start; gap: 8px; margin-top: 6px; }
.process-value code { flex: 1; min-width: 0; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.process-value :deep(.el-button) { flex-shrink: 0; min-height: 24px; height: 24px; padding: 0 4px; }
.process-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 14px 0 0; }
.process-facts .fact-wide { grid-column: 1 / -1; }
.process-facts dd { margin: 5px 0 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.section-note, .measurement-note { margin: 0; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.6; }
.storage-item { padding: 12px 0; border-bottom: 1px solid var(--info-border); }
.storage-item:last-child { padding-bottom: 0; border-bottom: 0; }
.storage-top { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 10px; margin-bottom: 8px; font-size: 12px; }
.storage-top code { overflow-wrap: anywhere; min-width: 0; }
.storage-type { color: var(--el-text-color-secondary); font-size: 11px; }
.storage-top strong { margin-left: auto; }
.storage-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 7px; color: var(--el-text-color-secondary); font-size: 11px; }
.network-row { display: grid; grid-template-columns: minmax(64px, 90px) minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--info-border); }
.network-row:first-child { padding-top: 0; }
.network-row:last-child { border-bottom: 0; }
.network-name { display: grid; gap: 4px; min-width: 0; font-size: 12px; overflow-wrap: anywhere; }
.network-name span { color: var(--el-text-color-secondary); font-size: 11px; }
.network-addresses { display: flex; flex-wrap: wrap; gap: 6px 16px; min-width: 0; font-size: 12px; }
.network-addresses code { overflow-wrap: anywhere; }
.network-status { color: var(--el-text-color-secondary); font-size: 11px; }
.empty-note { margin: 12px 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
@container basic-info (max-width: 720px) {
  .overview-details { grid-template-columns: 1fr; flex: none; }
  .storage-list { contain: none; min-height: 0; overflow: visible; }
}
@container basic-info (max-width: 650px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .network-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .network-addresses { grid-row: 2; grid-column: 1 / -1; }
  .network-status { grid-column: 2; grid-row: 1; }
}
</style>
