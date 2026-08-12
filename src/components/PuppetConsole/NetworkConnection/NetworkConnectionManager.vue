<template>
  <div class="netconn-workbench">
    <div class="netconn-shell">
      <!-- 工具栏 -->
      <section class="netconn-toolbar">
        <div class="toolbar-left">
          <el-radio-group
            v-model="activeTab"
            size="small"
            @change="handleTabChange"
          >
            <el-radio-button value="list">
              连接列表
            </el-radio-button>
            <el-radio-button value="summary">
              聚合统计
            </el-radio-button>
          </el-radio-group>
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleRefresh"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            {{ loaded ? '刷新' : '采集' }}
          </el-button>
        </div>
        <div
          v-if="activeTab === 'list'"
          class="toolbar-right"
        >
          <el-input
            v-model="searchText"
            placeholder="过滤 IP / 端口 / 进程"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          <el-select
            v-model="stateFilter"
            placeholder="状态"
            size="small"
            clearable
            style="width:130px"
          >
            <el-option
              label="LISTEN"
              value="LISTEN"
            />
            <el-option
              label="ESTABLISHED"
              value="ESTABLISHED"
            />
            <el-option
              label="TIME_WAIT"
              value="TIME_WAIT"
            />
            <el-option
              label="CLOSE_WAIT"
              value="CLOSE_WAIT"
            />
          </el-select>
          <el-select
            v-model="protoFilter"
            placeholder="协议"
            size="small"
            clearable
            style="width:90px"
          >
            <el-option
              label="TCP"
              value="TCP"
            />
            <el-option
              label="UDP"
              value="UDP"
            />
          </el-select>
          <span
            v-if="filteredConnections.length > 0"
            class="result-count"
          >
            {{ filteredConnections.length }} / {{ connections.length }}
          </span>
          <el-button
            size="small"
            text
            :disabled="!filteredConnections.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 列表视图 -->
      <section
        v-if="activeTab === 'list'"
        class="netconn-content"
      >
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:lan-connect" />
          </el-icon>
          <p>点击「采集」获取远程主机的实时网络连接</p>
          <p class="hint-text">
            Windows: netstat + tasklist | macOS: lsof | Linux: ss / netstat
          </p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="filteredConnections"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'state', order: 'ascending' }"
          highlight-current-row
          class="netconn-table"
        >
          <el-table-column
            prop="protocol"
            label="协议"
            width="70"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.protocol === 'UDP' ? 'warning' : ''"
                effect="plain"
              >
                {{ row.protocol || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="localAddr"
            label="本地地址"
            min-width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.localAddr || '*' }}:{{ row.localPort || '*' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="remoteAddr"
            label="远端地址"
            min-width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.remoteAddr || '*' }}:{{ row.remotePort || '*' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="state"
            label="状态"
            width="120"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="stateColor(row.state)"
                effect="plain"
              >
                {{ row.state || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="process"
            label="进程"
            min-width="140"
            sortable
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="process-text">{{ row.process || '' }}</span>
              <span
                v-if="row.pid"
                class="pid-text"
              > ({{ row.pid }})</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="user"
            label="用户"
            width="80"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.user || '-' }}
            </template>
          </el-table-column>
        </el-table>
      </section>

      <!-- 统计视图 -->
      <section
        v-if="activeTab === 'summary'"
        class="netconn-content"
      >
        <div
          v-if="!summaryData && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:chart-bar" />
          </el-icon>
          <p>点击「采集」获取网络连接统计</p>
        </div>

        <div
          v-else-if="summaryData"
          class="summary-content"
        >
          <div class="summary-header">
            总连接数: <strong>{{ summaryData.totalConnections }}</strong>
          </div>

          <div class="summary-grid">
            <!-- 按状态 -->
            <div class="summary-card">
              <h4>按状态</h4>
              <div
                v-for="(count, state) in summaryData.byState"
                :key="state"
                class="stat-row"
              >
                <el-tag
                  size="small"
                  :type="stateColor(state)"
                  effect="plain"
                >
                  {{ state }}
                </el-tag>
                <span class="stat-count">{{ count }}</span>
              </div>
            </div>

            <!-- 按协议 -->
            <div class="summary-card">
              <h4>按协议</h4>
              <div
                v-for="(count, proto) in summaryData.byProtocol"
                :key="proto"
                class="stat-row"
              >
                <span class="stat-key">{{ proto }}</span>
                <span class="stat-count">{{ count }}</span>
              </div>
            </div>

            <!-- 按进程 Top -->
            <div class="summary-card wide">
              <h4>按进程 Top 30</h4>
              <div
                v-for="item in summaryData.byProcess"
                :key="item.key"
                class="stat-row"
              >
                <span class="stat-key process-text">{{ item.key }}</span>
                <span class="stat-count">{{ item.count }}</span>
              </div>
            </div>

            <!-- 按远端 IP Top -->
            <div class="summary-card wide">
              <h4>按远端 IP Top 30</h4>
              <div
                v-for="item in summaryData.byRemoteIp"
                :key="item.key"
                class="stat-row"
              >
                <span class="stat-key">{{ item.key }}</span>
                <span class="stat-count">{{ item.count }}</span>
              </div>
              <div
                v-if="!summaryData.byRemoteIp || summaryData.byRemoteIp.length === 0"
                class="no-data"
              >
                无外部连接
              </div>
            </div>

            <!-- 监听端口 -->
            <div class="summary-card wide">
              <h4>监听端口 ({{ (summaryData.listeningPorts || []).length }})</h4>
              <div
                v-for="(lp, idx) in summaryData.listeningPorts"
                :key="idx"
                class="stat-row"
              >
                <span class="stat-key">{{ lp.localAddr }}:{{ lp.port }} ({{ lp.protocol }})</span>
                <span class="stat-count process-text">{{ lp.process }}</span>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          v-loading="true"
          class="loading-placeholder"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { listNetworkConnectionsApi, networkConnectionSummaryApi } from '@/services/api.js'
import { showWarning, handleApiError } from '@/utils/messageUtils.js'
import { useSessionParams } from '@/composables/useSessionParams.js'
import { exportTsv } from '@/utils/exportUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const isLoading = ref(false)
const loaded = ref(false)
const activeTab = ref('list')
const connections = ref([])
const summaryData = ref(null)
const searchText = ref('')
const stateFilter = ref('')
const protoFilter = ref('')

const { withSession } = useSessionParams(() => props.sessionId)

const filteredConnections = computed(() => {
  let list = connections.value
  if (stateFilter.value) {
    list = list.filter(c => c.state === stateFilter.value)
  }
  if (protoFilter.value) {
    list = list.filter(c => c.protocol && c.protocol.toUpperCase().includes(protoFilter.value))
  }
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(c => {
      return (c.localAddr && c.localAddr.toLowerCase().includes(kw)) ||
             (c.localPort && c.localPort.toString().includes(kw)) ||
             (c.remoteAddr && c.remoteAddr.toLowerCase().includes(kw)) ||
             (c.remotePort && c.remotePort.toString().includes(kw)) ||
             (c.process && c.process.toLowerCase().includes(kw)) ||
             (c.pid && c.pid.toString().includes(kw))
    })
  }
  return list
})

async function handleRefresh() {
  if (activeTab.value === 'list') {
    await handleList()
  } else {
    await handleSummary()
  }
}

async function handleList() {
  isLoading.value = true
  loaded.value = true
  try {
    const res = await listNetworkConnectionsApi(withSession())
    const data = res.data
    connections.value = data.connections || []
    if (connections.value.length === 0) {
      showWarning('未获取到网络连接')
    }
  } catch (err) {
    handleApiError(err, '获取网络连接失败')
  } finally {
    isLoading.value = false
  }
}

async function handleSummary() {
  isLoading.value = true
  try {
    const res = await networkConnectionSummaryApi(withSession())
    summaryData.value = res.data
  } catch (err) {
    handleApiError(err, '获取统计信息失败')
  } finally {
    isLoading.value = false
  }
}

function handleTabChange(tab) {
  if (tab === 'list' && !loaded.value) {
    handleList()
  } else if (tab === 'summary' && !summaryData.value) {
    handleSummary()
  }
}

function handleExport() {
  exportTsv(filteredConnections.value, `network-connections-${Date.now()}`)
}

function stateColor(state) {
  if (!state) return 'info'
  if (state === 'LISTEN') return 'success'
  if (state === 'ESTABLISHED') return ''
  if (state === 'TIME_WAIT') return 'info'
  if (state === 'CLOSE_WAIT' || state === 'FIN_WAIT1' || state === 'FIN_WAIT2') return 'warning'
  if (state === 'SYN_SENT' || state === 'SYN_RECV') return 'danger'
  return 'info'
}
</script>

<style scoped>
.netconn-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.netconn-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.netconn-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.search-input {
  width: 220px;
}
.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.netconn-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.netconn-table {
  font-size: 12px;
}
.process-text {
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 11px;
}
.pid-text {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-placeholder);
  gap: 8px;
  padding: 40px;
}
.empty-state p {
  margin: 0;
  font-size: 13px;
}
.hint-text {
  font-size: 11px !important;
  color: var(--el-text-color-disabled);
}

/* 统计视图 */
.summary-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.summary-header {
  font-size: 14px;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.summary-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 12px;
}
.summary-card.wide {
  grid-column: span 2;
}
.summary-card h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
}
.stat-key {
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.stat-count {
  font-weight: 500;
  min-width: 40px;
  text-align: right;
  color: var(--el-text-color-primary);
}
.no-data {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  padding: 8px 0;
}
.loading-placeholder {
  height: 200px;
}
</style>
