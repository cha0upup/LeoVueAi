<template>
  <section class="asset-result-table">
    <div class="result-toolbar">
      <div class="result-heading">
        <h3>发现结果</h3><span>{{ hasActiveFilters ? '符合条件 ' : '' }}{{ total.toLocaleString('zh-CN') }} 条</span>
      </div>
      <div class="result-actions">
        <el-input
          v-model="searchText"
          class="search-input"
          placeholder="搜索主机或服务"
          clearable
          aria-label="搜索主机或服务"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button
          :type="hasActiveFilters ? 'primary' : 'default'"
          plain
          :icon="Filter"
          @click="openFilters"
        >
          筛选
        </el-button>
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="refreshResults"
        >
          刷新
        </el-button>
        <el-button
          :disabled="!selectedRows.length || selectedRows.length > 256 || selectedRows.some(row => !['http', 'https'].includes(row.service))"
          @click="emit('fingerprint-scan', { sourceTaskId: taskId, endpoints: [...selectedRows] })"
        >
          补扫组件{{ selectedRows.length ? ` (${selectedRows.length})` : '' }}
        </el-button>
        <el-button
          :icon="Download"
          :disabled="!tableData.length || loading || Boolean(loadError)"
          @click="handleExport"
        >
          {{ selectedRows.length ? `导出已选 ${selectedRows.length} 项` : '导出本页' }}
        </el-button>
      </div>
    </div>
    <div
      v-if="hasActiveFilters"
      class="active-filters"
    >
      <el-tag
        v-for="(value, key) in activeFilterTags"
        :key="key"
        closable
        effect="plain"
        @close="clearFilter(key)"
      >
        {{ value }}
      </el-tag>
      <el-button
        size="small"
        text
        type="primary"
        @click="clearAllFilters"
      >
        清空条件
      </el-button>
    </div>
    <div
      v-if="loadError"
      class="result-error"
      role="alert"
    >
      <span>{{ tableData.length ? '更新失败，保留上次结果：' : '结果加载失败：' }}{{ loadError }}</span>
      <el-button
        text
        type="primary"
        :loading="loading"
        @click="loadData"
      >
        重试
      </el-button>
    </div>
    <div class="table-wrap">
      <el-table
        ref="resultTable"
        v-loading="showTableLoading"
        :data="tableData"
        :row-key="endpointKey"
        stripe
        @sort-change="handleSortChange"
        @selection-change="selectedRows = $event"
      >
        <template #empty>
          <div
            class="result-empty"
            role="status"
          >
            <template v-if="loading">
              正在加载结果…
            </template>
            <template v-else-if="loadError">
              请重试加载结果
            </template>
            <template v-else-if="hasActiveFilters">
              没有符合条件的结果 <el-button
                text
                type="primary"
                @click="clearAllFilters"
              >
                清空条件
              </el-button>
            </template>
            <template v-else>
              暂无端口结果，扫描发现的开放端口将在这里显示。
            </template>
          </div>
        </template>
        <el-table-column
          type="selection"
          width="40"
        />
        <el-table-column
          label="目标"
          prop="target"
          min-width="180"
          sortable="custom"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="target-cell">{{ endpointAddress(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          prop="state"
          width="82"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag
              :type="getStateTagType(row.state)"
              size="small"
            >
              {{ getStateLabel(row.state) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="服务"
          prop="service"
          min-width="110"
          sortable="custom"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span :class="{ 'muted': !row.service }">{{ row.service || '未识别' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="组件"
          min-width="170"
        >
          <template #default="{ row }">
            <div
              v-if="row.fingerprint?.components?.length"
              class="component-tags"
            >
              <el-tag
                v-for="name in componentNames(row)"
                :key="name"
                size="small"
                @click="detailRow = row"
              >
                {{ name }}
              </el-tag>
            </div>
            <span
              v-else
              class="muted"
            >{{ fingerprintLabel(row.fingerprint) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="摘要"
          min-width="200"
        >
          <template #default="{ row }">
            <div
              class="summary-title"
              :title="row.title || row.banner"
            >
              {{ row.title || row.banner || '—' }}
            </div>
            <div class="summary-meta">
              <span v-if="row.statusCode != null">HTTP {{ row.statusCode }}</span>
              <span v-if="row.responseSize != null">{{ formatBytes(row.responseSize) }}</span>
              <span v-if="row.responseTime != null">{{ row.responseTime }} ms</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="64"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              text
              type="primary"
              size="small"
              :aria-label="`查看 ${endpointAddress(row)} 详情`"
              @click="detailRow = row"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div
      v-if="total"
      class="table-pagination"
    >
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        :pager-count="5"
        layout="sizes, prev, pager, next"
        @current-change="loadData"
        @size-change="reloadFirstPage"
      />
    </div>
    <el-drawer
      v-model="showFilterDrawer"
      title="筛选结果"
      size="min(400px, 100vw)"
      append-to-body
    >
      <el-form
        class="filter-form"
        label-position="top"
      >
        <el-form-item label="服务类型">
          <el-select
            v-model="filterDraft.services"
            multiple
            placeholder="选择服务类型"
            clearable
          >
            <el-option
              v-for="service in serviceOptions"
              :key="service"
              :label="service.toUpperCase()"
              :value="service"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="端口范围">
          <div class="range-fields">
            <el-input-number
              v-model="filterDraft.portMin"
              aria-label="最小端口"
              :min="1"
              :max="65535"
              :precision="0"
              placeholder="最小"
              controls-position="right"
            />
            <span>至</span>
            <el-input-number
              v-model="filterDraft.portMax"
              aria-label="最大端口"
              :min="1"
              :max="65535"
              :precision="0"
              placeholder="最大"
              controls-position="right"
            />
          </div>
        </el-form-item>
        <el-form-item label="响应时间（毫秒）">
          <div class="range-fields">
            <el-input-number
              v-model="filterDraft.responseTimeRange[0]"
              aria-label="最短响应时间"
              :min="0"
              :max="300000"
              :precision="0"
              controls-position="right"
            />
            <span>至</span>
            <el-input-number
              v-model="filterDraft.responseTimeRange[1]"
              aria-label="最长响应时间"
              :min="0"
              :max="300000"
              :precision="0"
              controls-position="right"
            />
          </div>
          <span class="filter-hint">最大值 300000 表示不限</span>
        </el-form-item>
        <el-form-item label="组件名称">
          <el-input
            v-model="filterDraft.component"
            placeholder="例如 spring-boot-actuator"
            clearable
          />
        </el-form-item>
        <el-form-item label="结果条件">
          <el-checkbox v-model="filterDraft.hasFingerprint">
            仅显示已识别组件
          </el-checkbox>
          <el-checkbox v-model="filterDraft.hasService">
            仅显示已识别服务
          </el-checkbox>
          <el-checkbox v-model="filterDraft.hasTitle">
            仅显示有页面标题
          </el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="filterDraft = defaultFilters()">
          重置
        </el-button>
        <el-button @click="showFilterDrawer = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="applyFilters"
        >
          应用筛选
        </el-button>
      </template>
    </el-drawer>
    <el-drawer
      :model-value="Boolean(detailRow)"
      title="资产详情"
      size="min(760px, 100vw)"
      append-to-body
      @close="detailRow = null"
    >
      <template v-if="detailRow">
        <div class="detail-actions">
          <el-button @click="copyToClipboard(endpointAddress(detailRow))">
            复制地址
          </el-button>
          <el-button
            v-if="detailRow.service?.startsWith('http')"
            @click="openInBrowser(detailRow)"
          >
            浏览器打开
          </el-button>
          <el-button @click="exportEvidence(detailRow)">
            导出证据
          </el-button>
        </div>
        <dl class="endpoint-detail">
          <template
            v-for="column in endpointColumns"
            :key="column.label"
          >
            <dt>{{ column.label }}</dt><dd>{{ column.key(detailRow) === '' ? '—' : column.key(detailRow) }}</dd>
          </template>
        </dl>
        <FingerprintResults
          :session-id="sessionId"
          :task-id="taskId"
          :endpoint-id="detailRow.endpointId"
          :refresh-token="refreshToken"
        />
      </template>
    </el-drawer>
  </section>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onUnmounted, watch } from 'vue'
import { Search, Filter, Download, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { queryNetworkProbeWorkflowResultsApi } from '@/services/api.js'
import FingerprintResults from './FingerprintResults.vue'
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
  }
})

const emit = defineEmits(['fingerprint-scan'])

// 状态
const loading = ref(false)
const showTableLoading = ref(false)
const loadError = ref('')
const resultTable = ref(null)
const detailRow = ref(null)
const searchText = ref('')
const tableData = ref([])
const total = ref(0)
const selectedRows = ref([])
const showFilterDrawer = ref(false)
const serviceOptions = ['http', 'https', 'ssh', 'ftp', 'mysql', 'redis', 'mongodb', 'postgresql']

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const defaultFilters = () => ({
  keyword: '',
  services: [],
  portMin: null,
  portMax: null,
  responseTimeRange: [0, 300000],
  hasService: false,
  hasTitle: false,
  hasFingerprint: false,
  component: ''
})

const filters = reactive(defaultFilters())
const filterDraft = ref(defaultFilters())

const sortBy = ref({
  field: 'discoveredAt',
  order: 'desc'
})

const activeFilterTags = computed(() => {
  const tags = {}
  if (filters.keyword) tags.keyword = `关键词: ${filters.keyword}`
  if (filters.services.length) tags.services = `服务: ${filters.services.join(', ')}`
  if (filters.portMin) tags.portMin = `端口≥${filters.portMin}`
  if (filters.portMax) tags.portMax = `端口≤${filters.portMax}`
  if (filters.hasService) tags.hasService = '已识别服务'
  if (filters.hasTitle) tags.hasTitle = '有页面标题'
  if (filters.hasFingerprint) tags.hasFingerprint = '已识别组件'
  if (filters.component) tags.component = `组件: ${filters.component}`
  const [min, max] = filters.responseTimeRange
  if (min > 0 || max < 300000) tags.responseTimeRange = `响应: ${min}–${max >= 300000 ? '不限' : max + ' ms'}`
  return tags
})

const hasActiveFilters = computed(() => Object.keys(activeFilterTags.value).length > 0)

// 方法
async function loadData({ silent = false } = {}) {
  if (!props.taskId || !props.sessionId) return
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = null
  refreshPending = false
  filters.keyword = searchText.value

  const sequence = ++requestSequence
  loading.value = true
  showTableLoading.value = !silent
  if (!silent) resultTable.value?.clearSelection()
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
        services: filters.services.map((service) => service.toLowerCase()),
        portMin: filters.portMin,
        portMax: filters.portMax,
        hasService: filters.hasService,
        hasTitle: filters.hasTitle,
        hasFingerprint: filters.hasFingerprint,
        component: filters.component.trim(),
        responseTimeMin: filters.responseTimeRange[0],
        responseTimeMax:
          filters.responseTimeRange[1] >= 300000 ? null : filters.responseTimeRange[1]
      }
    })
    const payload = response?.data || {}
    if (sequence !== requestSequence) return
    const selectedKeys = new Set(selectedRows.value.map(endpointKey))
    loadError.value = ''
    total.value = Number(payload.total || 0)
    tableData.value = Array.isArray(payload.endpoints) ? payload.endpoints : []
    await nextTick()
    if (sequence !== requestSequence) return
    resultTable.value?.clearSelection()
    for (const row of tableData.value) {
      if (selectedKeys.has(endpointKey(row))) resultTable.value?.toggleRowSelection(row, true)
    }
  } catch (error) {
    if (sequence === requestSequence)
      loadError.value = error?.message || '未知错误'
  } finally {
    if (sequence === requestSequence) {
      loading.value = false
      showTableLoading.value = false
      if (refreshPending) void loadData({ silent: true })
    }
  }
}

function reloadFirstPage() {
  pagination.page = 1
  loadData()
}

function refreshResults() {
  if (loading.value) {
    refreshPending = true
    return
  }
  loadData({ silent: true })
}

function handleSearch() {
  requestSequence += 1
  pagination.page = 1
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    filters.keyword = searchText.value
    loadData()
  }, 250)
}

function handleSortChange({ prop, order }) {
  sortBy.value = order ? { field: prop, order: order === 'ascending' ? 'asc' : 'desc' } : { field: 'discoveredAt', order: 'desc' }
  reloadFirstPage()
}

function openFilters() {
  filterDraft.value = { ...filters, services: [...filters.services], responseTimeRange: [...filters.responseTimeRange] }
  showFilterDrawer.value = true
}

function applyFilters() {
  const draft = filterDraft.value
  const min = draft.responseTimeRange[0] ?? 0
  const max = draft.responseTimeRange[1] ?? 300000
  if ((draft.portMin && draft.portMax && draft.portMin > draft.portMax) || min > max) {
    ElMessage.warning('范围起始值不能大于结束值')
    return
  }
  Object.assign(filters, draft, { keyword: searchText.value, responseTimeRange: [min, max] })
  showFilterDrawer.value = false
  reloadFirstPage()
}

function clearFilter(key) {
  filters[key] = defaultFilters()[key]
  if (key === 'keyword') searchText.value = ''
  reloadFirstPage()
}

function clearAllFilters() {
  Object.assign(filters, defaultFilters())
  searchText.value = ''
  reloadFirstPage()
}

function endpointAddress(row) {
  const host = String(row.host || '')
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return row.port != null ? `${formattedHost}:${row.port}` : formattedHost
}
const endpointKey = (row) => `${row.protocol || 'tcp'}://${endpointAddress(row)}`

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败，请手动复制'))
}

function openInBrowser(row) {
  const protocol = row.service === 'https' ? 'https' : 'http'
  window.open(`${protocol}://${endpointAddress(row)}`, '_blank', 'noopener,noreferrer')
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
  { label: '主机', key: (row) => row.host || '' },
  { label: '端口', key: (row) => row.port || '' },
  { label: '协议', key: (row) => row.protocol || '' },
  { label: '状态', key: (row) => row.state || '' },
  { label: '服务', key: (row) => row.service || '' },
  { label: '组件', key: (row) => componentNames(row).join(', ') },
  { label: 'Banner', key: (row) => row.banner || '' },
  { label: 'HTTP 状态码', key: (row) => row.statusCode ?? '' },
  { label: '响应大小(bytes)', key: (row) => row.responseSize ?? '' },
  { label: '标题', key: (row) => row.title || '' },
  { label: '响应时间(ms)', key: (row) => row.responseTime ?? '' },
  { label: '发现时间', key: (row) => row.discoveredAt || '' }
]

function componentNames(row) {
  return [...new Set((row.fingerprint?.components || []).map(component => [component.ruleName || component.ruleId, component.detectedVersion].filter(Boolean).join(' ')))]
}
function fingerprintLabel(fingerprint) {
  if (!fingerprint?.status) return '—'
  if (fingerprint.status === 'RUNNING') return '识别中'
  if (fingerprint.status === 'CANCELLED') return '已停止（部分结果）'
  if (fingerprint.status === 'INTERRUPTED') return '识别中断'
  if (fingerprint.errorCount) return '存在失败，请查看详情'
  if (fingerprint.inconclusiveCount) return '证据不足'
  return '未命中'
}

function getStateLabel(state) {
  const normalized = String(state || '').toUpperCase()
  return normalized === 'OPEN' ? '开放' : state || '未知'
}

function getStateTagType(state) {
  const normalized = String(state || '').toUpperCase()
  return normalized === 'OPEN' ? 'success' : 'info'
}

function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 生命周期
onUnmounted(() => {
  requestSequence += 1
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = null
})

let searchTimer = null
let requestSequence = 0
let refreshPending = false

watch(
  () => [props.sessionId, props.taskId],
  () => {
    requestSequence += 1
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = null
    loading.value = false
    refreshPending = false
    pagination.page = 1
    tableData.value = []
    total.value = 0
    selectedRows.value = []
    loadError.value = ''
    detailRow.value = null
    showFilterDrawer.value = false
    loadData()
  },
  { immediate: true, flush: 'sync' }
)

watch(() => props.refreshToken, refreshResults)
</script>

<style scoped lang="scss">
.component-tags { display: flex; flex-wrap: wrap; gap: 4px; cursor: pointer; }
.asset-result-table { container: results / inline-size; min-width: 0; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: var(--el-bg-color); color: var(--el-text-color-primary); }
.result-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; }
.result-heading, .result-actions, .active-filters, .detail-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.result-heading h3 { margin: 0; font-size: 14px; font-weight: 600; }
.result-heading > span, .muted, .summary-meta, .filter-hint { color: var(--el-text-color-secondary); font-size: 12px; }
.result-actions :deep(.el-button + .el-button), .detail-actions :deep(.el-button + .el-button) { margin-left: 0; }
.search-input { width: 190px; }
.active-filters { padding: 0 14px 10px; }
.active-filters :deep(.el-tag) { max-width: 100%; }
.active-filters :deep(.el-tag__content) { overflow: hidden; text-overflow: ellipsis; }
.table-wrap { min-width: 0; padding: 0 14px; }
.target-cell { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.summary-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; }
.table-pagination { display: flex; justify-content: flex-end; padding: 12px 14px; }
:deep(.el-table .cell) { padding: 0 8px; font-size: 12px; }
:deep(.el-table th.el-table__cell) { background: var(--el-fill-color-light); }
:deep(.el-table td.el-table__cell) { padding: 6px 0; }
.result-empty { padding: 28px 16px; line-height: 1.6; white-space: normal; }
.result-error { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 14px 10px; padding: 8px 12px; color: var(--el-color-danger); background: var(--el-color-danger-light-9); border-radius: 4px; font-size: 12px; overflow-wrap: anywhere; }
.range-fields { display: flex; align-items: center; gap: 8px; width: 100%; }
.range-fields :deep(.el-input-number) { flex: 1; width: 0; min-width: 0; }
.filter-hint { margin-top: 6px; }
.endpoint-detail { display: grid; grid-template-columns: 110px minmax(0, 1fr); margin: 20px 0 0; font-size: 13px; }
.endpoint-detail dt, .endpoint-detail dd { margin: 0; padding: 12px 0; border-bottom: 1px solid var(--el-border-color-lighter); overflow-wrap: anywhere; white-space: pre-wrap; }
.endpoint-detail dt { padding-right: 12px; color: var(--el-text-color-secondary); }
.endpoint-detail dd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
@container results (max-width: 760px) {
  .result-actions { width: 100%; }
  .search-input { flex: 1 1 160px; width: auto; }
}
@container results (max-width: 480px) {
  .search-input { flex-basis: 100%; }
  .table-wrap { padding: 0 8px; }
  .table-pagination { justify-content: center; padding: 10px 4px; }
  :deep(.el-pagination) { gap: 4px; --el-pagination-button-width: 24px; }
  :deep(.el-pagination__sizes .el-select) { width: 94px; }
}
</style>
