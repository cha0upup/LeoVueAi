<template>
  <div class="proxy-panel">
    <section class="workspace-strip">
      <div class="workspace-status">
        <span class="workspace-title">监听配置</span>
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
        <BindAddressInput
          v-model="bindAddr"
          :disabled="isRunning || starting"
          stacked
        />
        <div class="port-control">
          <span class="control-label">监听端口</span>
          <el-input-number
            v-model="port"
            aria-label="监听端口"
            :min="1024"
            :max="65535"
            :precision="0"
            controls-position="right"
            :disabled="isRunning || starting"
          />
        </div>
        <el-button
          v-if="!isRunning"
          type="primary"
          :loading="starting"
          class="primary-action"
          @click="emit('start')"
        >
          <el-icon><Icon :icon="iconMap.play" /></el-icon>
          启动代理
        </el-button>
        <el-button
          v-else
          type="danger"
          :loading="stopping"
          class="primary-action"
          @click="emit('stop')"
        >
          <el-icon><Icon :icon="iconMap.stop" /></el-icon>
          停止代理
        </el-button>
      </div>
    </section>

    <section
      v-if="isRunning && statistics"
      class="stats-grid"
    >
      <article class="stats-card">
        <span class="stats-label">监听端口</span>
        <strong class="stats-value">{{ statistics.port ?? port }}</strong>
        <span class="stats-helper">监听地址：{{ bindAddr }}</span>
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
          <span
            v-if="isRunning"
            class="connections-subtitle"
          >
            上行 {{ formatRate(statistics?.uploadRate) }} · 下行 {{ formatRate(statistics?.downloadRate) }}
          </span>
        </div>
        <div
          v-if="isRunning"
          class="list-actions"
        >
          <span class="list-count">{{ statistics?.connections?.length ?? 0 }} 条连接</span>
          <el-button
            text
            size="small"
            @click="emit('refresh')"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            刷新统计
          </el-button>
        </div>
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
        <div
          v-else
          class="empty-state"
        >
          <el-icon aria-hidden="true">
            <Icon :icon="iconMap.connection" />
          </el-icon>
          <p>暂无活跃连接</p>
          <span>客户端连接后，这里会显示连接详情与流量。</span>
        </div>
      </div>

      <div
        v-else
        class="empty-state"
      >
        <el-icon aria-hidden="true">
          <Icon :icon="iconMap.connection" />
        </el-icon>
        <p>{{ isRunning ? '正在获取连接信息…' : '配置监听地址和端口，然后启动代理。' }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import BindAddressInput from './BindAddressInput.vue'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate, formatFileSize } from '@/utils/format.js'

const props = defineProps({
  isRunning: { type: Boolean, default: false },
  starting: { type: Boolean, default: false },
  stopping: { type: Boolean, default: false },
  statistics: { type: Object, default: null }
})

const bindAddr = defineModel('bindAddr', { type: String, required: true })
const port = defineModel('port', { type: Number, default: undefined })
const emit = defineEmits(['start', 'stop', 'refresh'])

const statusTag = computed(() => props.isRunning
  ? { type: 'success', icon: iconMap.success, label: '运行中' }
  : { type: 'info', icon: iconMap.info, label: '未启动' }
)

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
</script>

<style scoped src="./proxy-panel.css"></style>
