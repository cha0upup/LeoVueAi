<template>
  <section class="info-section">
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
            :percentage="resources.memory"
            :color="getUsageColor(resources.memory)"
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
            :percentage="resources.swap"
            :color="getUsageColor(resources.swap)"
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
          :data="resources.disks"
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
                  :color="getUsageColor(row.UsagePercent)"
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
import {
  formatMBValue,
  formatPercent,
  getUsageColor,
  getIPType,
  getResourceUsage
} from './infoModel.js'

const props = defineProps({
  basicInfo: {
    type: Object,
    required: true
  }
})

const resources = computed(() => getResourceUsage(props.basicInfo))

const hardwareFacts = computed(() => [
  { label: 'CPU 核心数', value: props.basicInfo.HardwareInfo?.AvailableProcessors || '-' },
  { label: '系统负载', value: props.basicInfo.HardwareInfo?.SystemLoadAverage ?? '-' },
  { label: '内存使用率', value: formatPercent(resources.value.memory) },
  { label: '交换空间使用率', value: formatPercent(resources.value.swap) }
])
</script>

<style scoped>
.usage-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.usage-panel {
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

.kv-item {
  border-radius: 14px;
  border: 1px solid var(--info-border);
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
  word-break: break-word;
  overflow-wrap: anywhere;
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
</style>
