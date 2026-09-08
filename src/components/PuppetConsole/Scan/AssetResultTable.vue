<template>
  <div class="asset-result-table">
    <div class="table-header">
      <div class="table-header-content">
        <div class="left">
          <span class="header-title">存活结果</span>
          <el-tag v-if="total > 0" type="info">{{ total }} 条记录</el-tag>
        </div>
        <div class="right">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索目标或服务"
            clearable
            class="search-input"
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button @click="showFilterDrawer = true" :icon="Filter">
            筛选
          </el-button>
          <el-button @click="handleExport" :icon="Download">
            导出
          </el-button>
        </div>
      </div>
    </div>

    <!-- 过滤条件显示 -->
    <div v-if="hasActiveFilters" class="active-filters">
      <el-tag
        v-for="(value, key) in activeFilterTags"
        :key="key"
        closable
        @close="clearFilter(key)"
      >
        {{ value }}
      </el-tag>
      <el-button size="small" text type="primary" @click="clearAllFilters">
        清空筛选
      </el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
      stripe
      @sort-change="handleSortChange"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="42" />

      <el-table-column label="目标" prop="target" min-width="150" sortable="custom">
        <template #default="{ row }">
          <div class="target-cell">
            <span class="target-host">{{ row.host }}</span>
            <span v-if="row.port" class="target-port">:{{ row.port }}</span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="状态" prop="state" width="100" sortable="custom">
        <template #default="{ row }">
          <el-tag :type="getStateTagType(row.state)" size="small">
            {{ getStateLabel(row.state) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="服务" prop="service" min-width="120" sortable="custom">
        <template #default="{ row }">
          <div v-if="row.service" class="service-cell">
            <span class="service-name">{{ row.service }}</span>
          </div>
          <span v-else class="empty-text">-</span>
        </template>
      </el-table-column>

      <el-table-column v-if="showFingerprintColumn" label="指纹" prop="fingerprint" min-width="160">
        <template #default="{ row }">
          <div v-if="row.fingerprint" class="fingerprint-cell">
            <el-tooltip :content="row.fingerprint?.raw || row.fingerprint?.name || ''" placement="top">
              <div class="fingerprint-content">
                <span v-if="row.fingerprint?.product || row.fingerprint?.name" class="fp-product">
                  {{ row.fingerprint?.product || row.fingerprint?.name }}
                </span>
                <span v-if="row.fingerprint?.version" class="fp-version">
                  v{{ row.fingerprint.version }}
                </span>
                <span v-if="!row.fingerprint?.product && !row.fingerprint?.name && !row.fingerprint?.version" class="fp-product">
                  {{ row.fingerprint?.raw }}
                </span>
              </div>
            </el-tooltip>
            <el-tag
              v-if="row.fingerprint?.confidence != null || row.confidence != null"
              size="small"
              :type="getConfidenceType(row.fingerprint?.confidence ?? row.confidence)"
            >
              {{ confidencePercent(row.fingerprint?.confidence ?? row.confidence).toFixed(0) }}%
            </el-tag>
          </div>
          <span v-else class="empty-text">-</span>
        </template>
      </el-table-column>

      <el-table-column v-if="showTitleColumn" label="标题" prop="title" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.title">{{ row.title }}</span>
          <span v-else class="empty-text">-</span>
        </template>
      </el-table-column>

      <el-table-column v-if="showResponseTimeColumn" label="响应时间" prop="responseTime" width="96" sortable="custom">
        <template #default="{ row }">
          <span v-if="row.responseTime != null" class="response-time">
            {{ row.responseTime }}ms
          </span>
          <span v-else class="empty-text">-</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="104" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click="handleViewDetail(row)">
            详情
          </el-button>
          <el-dropdown @command="(cmd) => handleAction(cmd, row)">
            <el-button size="small" text>
              更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="copy">复制地址</el-dropdown-item>
                <el-dropdown-item command="browser" :disabled="!row.service?.startsWith('http')">
                  浏览器打开
                </el-dropdown-item>
                <el-dropdown-item command="export">导出证据</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="table-pagination">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadData"
        @size-change="loadData"
      />
    </div>

    <!-- 筛选抽屉 -->
    <el-drawer v-model="showFilterDrawer" title="高级筛选" size="400px">
      <div class="filter-form">
        <el-form label-position="top">
          <el-form-item label="服务类型">
            <el-select
              v-model="filters.services"
              multiple
              placeholder="选择服务类型"
              clearable
            >
              <el-option label="HTTP" value="http" />
              <el-option label="HTTPS" value="https" />
              <el-option label="SSH" value="ssh" />
              <el-option label="FTP" value="ftp" />
              <el-option label="MySQL" value="mysql" />
              <el-option label="Redis" value="redis" />
              <el-option label="MongoDB" value="mongodb" />
              <el-option label="PostgreSQL" value="postgresql" />
            </el-select>
          </el-form-item>

          <el-form-item label="端口范围">
            <el-row :gutter="12">
              <el-col :span="11">
                <el-input-number
                  v-model="filters.portMin"
                  :min="1"
                  :max="65535"
                  placeholder="最小"
                  controls-position="right"
                />
              </el-col>
              <el-col :span="2" class="range-separator">-</el-col>
              <el-col :span="11">
                <el-input-number
                  v-model="filters.portMax"
                  :min="1"
                  :max="65535"
                  placeholder="最大"
                  controls-position="right"
                />
              </el-col>
            </el-row>
          </el-form-item>

          <el-form-item label="响应时间">
            <el-slider
              v-model="filters.responseTimeRange"
              range
              :min="0"
              :max="300000"
              :step="1000"
              :marks="{ 0: '0ms', 5000: '5s', 300000: '不限' }"
            />
          </el-form-item>

          <el-form-item label="置信度">
            <el-slider
              v-model="filters.confidenceMin"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '0%', 50: '50%', 100: '100%' }"
            />
          </el-form-item>

          <el-form-item label="其他条件">
            <el-checkbox v-model="filters.hasService">仅显示已识别服务</el-checkbox>
            <el-checkbox v-model="filters.hasTitle">仅显示有标题</el-checkbox>
          </el-form-item>
        </el-form>

        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="applyFilters">应用筛选</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { Search, Filter, Download, ArrowDown } from '@element-plus/icons-vue'
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

const emit = defineEmits(['view-evidence'])

// 状态
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const selectedRows = ref([])
const showFilterDrawer = ref(false)

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
  confidenceMin: 0,
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
    filters.confidenceMin > 0 ||
    filters.hasService ||
    filters.hasTitle
})

const activeFilterTags = computed(() => {
  const tags = {}
  if (filters.keyword) tags.keyword = `关键词: ${filters.keyword}`
  if (filters.services.length) tags.services = `服务: ${filters.services.join(', ')}`
  if (filters.portMin) tags.portMin = `端口≥${filters.portMin}`
  if (filters.portMax) tags.portMax = `端口≤${filters.portMax}`
  if (filters.confidenceMin > 0) tags.confidence = `置信度≥${filters.confidenceMin}%`
  return tags
})

const showFingerprintColumn = computed(() => tableData.value.some(row =>
  row?.fingerprint?.raw || row?.fingerprint?.product || row?.fingerprint?.name || row?.fingerprint?.version
))
const showTitleColumn = computed(() => tableData.value.some(row => row?.title))
const showResponseTimeColumn = computed(() => tableData.value.some(row => row?.responseTime != null))

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
        confidenceMin: filters.confidenceMin > 0 ? filters.confidenceMin / 100 : null,
        hasService: filters.hasService,
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
    if (sequence === requestSequence) loading.value = false
  }
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
    confidenceMin: 0,
    hasService: false,
    hasTitle: false
  })
}

function clearFilter(key) {
  if (key === 'keyword') filters.keyword = ''
  else if (key === 'services') filters.services = []
  else if (key === 'portMin') filters.portMin = null
  else if (key === 'portMax') filters.portMax = null
  else if (key === 'confidence') filters.confidenceMin = 0

  loadData()
}

function clearAllFilters() {
  resetFilters()
  loadData()
}

function handleViewDetail(row) {
  emit('view-evidence', row)
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
  { label: '标题', key: row => row.title || '' },
  { label: '指纹', key: row => row.fingerprint?.raw || '' },
  { label: '响应时间(ms)', key: row => row.responseTime ?? '' },
  { label: '发现时间', key: row => row.discoveredAt || '' }
]

function getStateLabel(state) {
  const normalized = String(state || '').toUpperCase()
  const labels = {
    'OPEN': '开放',
    'CLOSED': '关闭',
    'FILTERED': '过滤',
    'UNKNOWN': '未知'
  }
  return labels[normalized] || state || '未知'
}

function getStateTagType(state) {
  const normalized = String(state || '').toUpperCase()
  const types = {
    'OPEN': 'success',
    'CLOSED': 'info',
    'FILTERED': 'warning',
    'UNKNOWN': 'info'
  }
  return types[normalized] || 'info'
}

function getConfidenceType(confidence) {
  const percent = confidencePercent(confidence)
  if (percent >= 90) return 'success'
  if (percent >= 70) return 'warning'
  return 'info'
}

function confidencePercent(confidence) {
  const value = Number(confidence)
  if (!Number.isFinite(value)) return 0
  return value >= 0 && value <= 1 ? value * 100 : value
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

watch([() => props.taskId, () => props.refreshToken], () => {
  pagination.page = 1
  loadData()
})
</script>

<style scoped lang="scss">
.asset-result-table {
  height: 100%;
  display: flex;
  flex-direction: column;

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 0 0 auto;
    padding: 10px 14px;
    border-bottom: 1px solid #ebeef5;

    .left {
      display: flex;
      align-items: center;
      gap: 8px;

      .header-title {
        font-weight: 600;
        font-size: 14px;
      }
    }

    .right {
      display: flex;
      gap: 6px;

      .search-input {
        width: 190px;
      }
    }
  }

  .active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 8px 14px;
    padding: 6px 8px;
    background: #f5f7fa;
    border-radius: 4px;
  }

  .target-cell {
    font-family: monospace;

    .target-host {
      font-weight: 600;
    }

    .target-port {
      color: #409eff;
    }
  }

  .service-cell {
    display: flex;
    align-items: center;
    gap: 6px;

    .service-name {
      font-weight: 500;
    }
  }

  .fingerprint-cell {
    display: flex;
    align-items: center;
    gap: 8px;

    .fingerprint-content {
      flex: 1;
      min-width: 0;

      .fp-product {
        font-weight: 500;
      }

      .fp-version {
        color: #909399;
        font-size: 12px;
        margin-left: 4px;
      }
    }
  }

  .response-time {
    font-family: monospace;
    color: #67c23a;
  }

  .empty-text {
    color: #c0c4cc;
  }

  .table-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    padding: 0 14px;
  }

  :deep(.el-table) {
    flex: 1;
    min-height: 0;
    width: calc(100% - 28px);
    margin: 0 14px;
  }
  :deep(.el-table .cell) { padding: 0 8px; font-size: 12px; }
  :deep(.el-table th.el-table__cell) { padding: 7px 0; }
  :deep(.el-table td.el-table__cell) { padding: 7px 0; }
  :deep(.el-pagination) { --el-pagination-button-width: 26px; --el-pagination-button-height: 26px; }
}

.filter-form {
  .range-separator {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .filter-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e4e7ed;
  }
}
</style>
