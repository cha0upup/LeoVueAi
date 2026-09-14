<template>
  <section class="asset-result-table">
    <div class="result-toolbar">
      <div class="result-heading">
        <div>
          <h3>发现结果</h3>
        </div>
        <span class="result-count">{{ displayedTotal.toLocaleString('zh-CN') }} 条</span>
      </div>
      <div class="result-actions">
        <el-input v-model="filters.keyword" class="search-input" placeholder="搜索主机或服务" clearable @input="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button :type="hasActiveFilters ? 'primary' : 'default'" plain :icon="Filter" @click="showFilterDrawer = true">筛选</el-button>
        <el-button :icon="Refresh" :loading="loading" @click="refreshResults">刷新</el-button>
        <el-button :icon="Download" @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="result-nav">
      <button v-for="tab in resultTabs" :key="tab.value" type="button" class="result-tab" :class="{ active: resultView === tab.value }" :aria-selected="resultView === tab.value" @click="changeResultView(tab.value)">
        {{ tab.label }}<span v-if="tab.value === 'all'">{{ total.toLocaleString('zh-CN') }}</span>
      </button>
    </div>

    <div v-if="hasActiveFilters" class="active-filters">
      <el-tag v-for="(value, key) in activeFilterTags" :key="key" closable effect="plain" @close="clearFilter(key)">{{ value }}</el-tag>
      <el-button size="small" text type="primary" @click="clearAllFilters">清空条件</el-button>
    </div>

    <div class="table-wrap">
      <el-table v-loading="showTableLoading" :data="displayedTableData" stripe @sort-change="handleSortChange" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="42" />
        <el-table-column label="目标" prop="target" min-width="160" sortable="custom">
          <template #default="{ row }">
            <div class="target-cell"><span class="target-host">{{ row.host }}</span><span v-if="row.port" class="target-port">:{{ row.port }}</span></div>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="state" width="90" sortable="custom">
          <template #default="{ row }"><el-tag :type="getStateTagType(row.state)" size="small">{{ getStateLabel(row.state) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="服务" prop="service" min-width="130" sortable="custom">
          <template #default="{ row }">
            <span v-if="row.service" class="service-name">{{ row.service }}</span><span v-else class="empty-text">未识别</span>
          </template>
        </el-table-column>
        <el-table-column label="Banner" prop="banner" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.banner" class="banner-text">{{ row.banner }}</span><span v-else class="empty-text">-</span>
          </template>
        </el-table-column>
        <el-table-column label="HTTP 状态" prop="statusCode" width="100" sortable="custom">
          <template #default="{ row }">
            <el-tag v-if="row.statusCode != null" :type="getStatusCodeType(row.statusCode)" size="small">{{ row.statusCode }}</el-tag>
            <span v-else class="empty-text">-</span>
          </template>
        </el-table-column>
        <el-table-column label="响应大小" prop="responseSize" width="105" sortable="custom">
          <template #default="{ row }"><span v-if="row.responseSize != null" class="response-size">{{ formatBytes(row.responseSize) }}</span><span v-else class="empty-text">-</span></template>
        </el-table-column>
        <el-table-column label="页面标题" prop="title" min-width="160" show-overflow-tooltip>
          <template #default="{ row }"><span v-if="row.title">{{ row.title }}</span><span v-else class="empty-text">-</span></template>
        </el-table-column>
        <el-table-column label="响应" prop="responseTime" width="90" sortable="custom">
          <template #default="{ row }"><span v-if="row.responseTime != null" class="response-time">{{ row.responseTime }}ms</span><span v-else class="empty-text">-</span></template>
        </el-table-column>
        <el-table-column label="操作" width="84" fixed="right">
          <template #default="{ row }">
            <el-dropdown @command="command => handleAction(command, row)">
              <el-button size="small" text>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="copy">复制地址</el-dropdown-item>
                  <el-dropdown-item command="browser" :disabled="!row.service?.startsWith('http')">浏览器打开</el-dropdown-item>
                  <el-dropdown-item command="export">导出证据</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="table-pagination">
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="displayedTotal" :page-sizes="[20, 50, 100, 200]" layout="total, sizes, prev, pager, next, jumper" @current-change="loadData" @size-change="loadData" />
    </div>

    <el-drawer v-model="showFilterDrawer" title="筛选结果" size="400px">
      <div class="filter-form">
        <el-form label-position="top">
          <el-form-item label="服务类型">
            <el-select v-model="filters.services" multiple placeholder="选择服务类型" clearable>
              <el-option label="HTTP" value="http" /><el-option label="HTTPS" value="https" /><el-option label="SSH" value="ssh" /><el-option label="FTP" value="ftp" /><el-option label="MySQL" value="mysql" /><el-option label="Redis" value="redis" /><el-option label="MongoDB" value="mongodb" /><el-option label="PostgreSQL" value="postgresql" />
            </el-select>
          </el-form-item>
          <el-form-item label="端口范围">
            <el-row :gutter="12"><el-col :span="11"><el-input-number v-model="filters.portMin" :min="1" :max="65535" placeholder="最小" controls-position="right" /></el-col><el-col :span="2" class="range-separator">-</el-col><el-col :span="11"><el-input-number v-model="filters.portMax" :min="1" :max="65535" placeholder="最大" controls-position="right" /></el-col></el-row>
          </el-form-item>
          <el-form-item label="响应时间">
            <el-slider v-model="filters.responseTimeRange" range :min="0" :max="300000" :step="1000" :marks="{ 0: '0ms', 5000: '5s', 300000: '不限' }" />
          </el-form-item>
          <el-form-item label="结果条件">
            <el-checkbox v-model="filters.hasService">仅显示已识别服务</el-checkbox>
            <el-checkbox v-model="filters.hasTitle">仅显示有页面标题</el-checkbox>
          </el-form-item>
        </el-form>
        <div class="filter-actions"><el-button @click="resetFilters">重置</el-button><el-button type="primary" @click="applyFilters">应用筛选</el-button></div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { Search, Filter, Download, ArrowDown, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { queryNetworkProbeWorkflowResultsApi } from '@/services/api.js'
import { exportTsv } from '@/utils/exportUtils.js'

const props = defineProps({
  taskId: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  refreshToken: {
    type: Number,
    default: 0
  },
})

// 状态
const loading = ref(false)
const hasLoadedOnce = ref(false)
const tableData = ref([])
const total = ref(0)
const selectedRows = ref([])
const showFilterDrawer = ref(false)
const resultView = ref('all')
const resultTabs = [
  { value: 'all', label: '全部' },
  { value: 'services', label: '服务识别' }
]

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const filters = reactive({
  keyword: '',
  services: [],
  portMin: null,
  portMax: null,
  responseTimeRange: [0, 300000],
  hasService: false,
  hasTitle: false
})

const sortBy = ref({
  field: 'discoveredAt',
  order: 'desc'
})

// 计算属性
const hasActiveFilters = computed(() => {
  return filters.keyword ||
    filters.services.length > 0 ||
    filters.portMin ||
    filters.portMax ||
    filters.hasService ||
    filters.hasTitle
})

const activeFilterTags = computed(() => {
  const tags = {}
  if (filters.keyword) tags.keyword = `关键词: ${filters.keyword}`
  if (filters.services.length) tags.services = `服务: ${filters.services.join(', ')}`
  if (filters.portMin) tags.portMin = `端口≥${filters.portMin}`
  if (filters.portMax) tags.portMax = `端口≤${filters.portMax}`
  return tags
})

const displayedTableData = computed(() => tableData.value)
const displayedTotal = computed(() => total.value)
const showTableLoading = computed(() => loading.value && !hasLoadedOnce.value)

// 方法
async function loadData() {
  if (!props.taskId) return

  const sequence = ++requestSequence
  loading.value = true
  try {
    const { field, order } = sortBy.value
    const response = await queryNetworkProbeWorkflowResultsApi({
      sessionId: props.sessionId,
      taskId: props.taskId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: { field: field === 'target' ? 'host' : field, order },
      filter: {
        searchText: filters.keyword.trim(),
        services: filters.services.map(service => service.toLowerCase()),
        portMin: filters.portMin,
        portMax: filters.portMax,
        hasService: filters.hasService || resultView.value === 'services',
        hasTitle: filters.hasTitle,
        responseTimeMin: filters.responseTimeRange[0],
        responseTimeMax: filters.responseTimeRange[1] >= 300000 ? null : filters.responseTimeRange[1]
      }
    })
    const payload = response?.data || {}
    if (sequence !== requestSequence) return
    total.value = Number(payload.total || 0)
    tableData.value = Array.isArray(payload.endpoints) ? payload.endpoints : []
  } catch (error) {
    if (sequence === requestSequence) ElMessage.error('加载数据失败: ' + (error.message || '未知错误'))
  } finally {
    if (sequence === requestSequence) {
      loading.value = false
      hasLoadedOnce.value = true
    }
  }
}

function changeResultView(view) {
  resultView.value = view
  pagination.page = 1
  loadData()
}

function refreshResults() {
  if (loading.value) return
  loadData()
}

function handleSearch() {
  pagination.page = 1
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(loadData, 250)
}

function handleSortChange({ prop, order }) {
  if (!order) {
    sortBy.value = { field: 'discoveredAt', order: 'desc' }
  } else {
    sortBy.value = {
      field: prop,
      order: order === 'ascending' ? 'asc' : 'desc'
    }
  }
  loadData()
}

function handleSelectionChange(selection) {
  selectedRows.value = selection
}

function applyFilters() {
  pagination.page = 1
  showFilterDrawer.value = false
  loadData()
}

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    services: [],
    portMin: null,
    portMax: null,
    responseTimeRange: [0, 300000],
    hasService: false,
    hasTitle: false
  })
}

function clearFilter(key) {
  if (key === 'keyword') filters.keyword = ''
  else if (key === 'services') filters.services = []
  else if (key === 'portMin') filters.portMin = null
  else if (key === 'portMax') filters.portMax = null
  loadData()
}

function clearAllFilters() {
  resetFilters()
  loadData()
}

function handleAction(command, row) {
  switch (command) {
    case 'copy':
      copyToClipboard(`${row.host}:${row.port}`)
      break
    case 'browser':
      openInBrowser(row)
      break
    case 'export':
      exportEvidence(row)
      break
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败，请手动复制'))
}

function openInBrowser(row) {
  const protocol = row.service === 'https' ? 'https' : 'http'
  const host = String(row.host || '').includes(':') && !String(row.host).startsWith('[')
    ? `[${row.host}]`
    : row.host
  const url = `${protocol}://${host}:${row.port}`
  window.open(url, '_blank')
}

function exportEvidence(row) {
  if (!row) return
  exportTsv([row], `network-evidence-${row.host}-${row.port}`, endpointColumns)
}

function handleExport() {
  const rows = selectedRows.value.length > 0 ? selectedRows.value : tableData.value
  if (rows.length === 0) {
    ElMessage.warning('当前没有可导出的记录')
    return
  }
  exportTsv(rows, `network-results-page-${pagination.page}`, endpointColumns)
  ElMessage.success(`已导出 ${rows.length} 条记录`)
}

const endpointColumns = [
  { label: '主机', key: row => row.host || '' },
  { label: '端口', key: row => row.port || '' },
  { label: '协议', key: row => row.protocol || '' },
  { label: '状态', key: row => row.state || '' },
  { label: '服务', key: row => row.service || '' },
  { label: 'Banner', key: row => row.banner || '' },
  { label: 'HTTP 状态码', key: row => row.statusCode ?? '' },
  { label: '响应大小(bytes)', key: row => row.responseSize ?? '' },
  { label: '标题', key: row => row.title || '' },
  { label: '响应时间(ms)', key: row => row.responseTime ?? '' },
  { label: '发现时间', key: row => row.discoveredAt || '' }
]

function getStateLabel(state) {
  const normalized = String(state || '').toUpperCase()
  return normalized === 'OPEN' ? '开放' : state || '未知'
}

function getStateTagType(state) {
  const normalized = String(state || '').toUpperCase()
  return normalized === 'OPEN' ? 'success' : 'info'
}

function getStatusCodeType(statusCode) {
  const code = Number(statusCode)
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'warning'
  if (code >= 400) return 'danger'
  return 'info'
}

function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


// 生命周期
onMounted(() => {
  loadData()
})

onUnmounted(() => {
  requestSequence += 1
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = null
})

let searchTimer = null
let requestSequence = 0

watch(() => props.taskId, () => {
  requestSequence += 1
  pagination.page = 1
  tableData.value = []
  total.value = 0
  selectedRows.value = []
  hasLoadedOnce.value = false
  loadData()
})

watch(() => props.refreshToken, () => {
  loadData()
})
</script>

<style scoped lang="scss">
.asset-result-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
}

.result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 15px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.result-heading,
.result-heading > div,
.result-actions {
  display: flex;
  align-items: center;
}

.result-heading {
  min-width: 0;
  gap: 10px;
}

.result-heading > div {
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
}

.result-heading h3 {
  margin: 0;
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.result-caption,
.result-nav-hint {
  color: #9ca3af;
  font-size: 11px;
}

.result-count {
  padding: 3px 7px;
  border-radius: 4px;
  color: #2563eb;
  background: #eff6ff;
  font-size: 11px;
}

.result-actions {
  flex: 0 0 auto;
  gap: 7px;
}

.search-input {
  width: 210px;
}

.result-nav {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 42px;
  padding: 0 18px;
  border-bottom: 1px solid #e5e7eb;
}

.result-tab {
  position: relative;
  height: 42px;
  padding: 0 1px;
  border: 0;
  color: #6b7280;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}

.result-tab::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: transparent;
  content: '';
}

.result-tab.active {
  color: #2563eb;
  font-weight: 650;
}

.result-tab.active::after {
  background: #2563eb;
}

.result-tab span {
  margin-left: 5px;
  color: #9ca3af;
  font-size: 10px;
}

.result-nav-hint {
  margin-left: auto;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-bottom: 1px solid #eef0f2;
  background: #fafbfc;
}

.table-wrap {
  flex: 1;
  min-height: 260px;
  overflow: auto;
  padding: 0 18px;
}

.target-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.target-cell {
  color: #1f2937;
  font-family: monospace;
}

.target-host {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-port {
  color: #2563eb;
}

.service-name {
  color: #374151;
  font-weight: 550;
}

.banner-text {
  display: block;
  overflow: hidden;
  color: #4b5563;
  font-family: monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.response-time {
  color: #059669;
  font-family: monospace;
  font-size: 12px;
}

.empty-text {
  color: #c4c9d0;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
}

:deep(.el-table) {
  width: 100%;
}

:deep(.el-table .cell) {
  padding: 0 8px;
  font-size: 12px;
}

:deep(.el-table th.el-table__cell) {
  padding: 9px 0;
  color: #6b7280;
  background: #fafbfc;
}

:deep(.el-table td.el-table__cell) {
  padding: 9px 0;
}

:deep(.el-pagination) {
  --el-pagination-button-width: 26px;
  --el-pagination-button-height: 26px;
}

.filter-form {
  padding: 0 4px;
}

.range-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

@media (max-width: 760px) {
  .result-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .result-actions {
    flex-wrap: wrap;
  }

  .search-input {
    flex: 1 1 180px;
    width: auto;
  }

  .result-nav-hint {
    display: none;
  }

  .table-wrap {
    padding: 0 10px;
  }

  .table-pagination {
    padding: 10px;
  }
}
</style>
