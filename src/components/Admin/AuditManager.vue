<template>
  <div class="audit-manager">
    <AdminToolbar>
      <el-input
        v-model="filterForm.keyword"
        placeholder="搜索路径、请求参数、响应信息"
        clearable
        class="toolbar-search"
        @keyup.enter="handleFilter"
      >
        <template #prefix>
          <el-icon><Icon :icon="iconMap.search" /></el-icon>
        </template>
      </el-input>

      <el-input
        v-model="filterForm.userId"
        placeholder="用户ID"
        clearable
        class="toolbar-field"
      />

      <el-input
        v-model="filterForm.puppetId"
        placeholder="主机ID"
        clearable
        class="toolbar-field"
      />

      <el-select
        v-model="filterForm.operationType"
        placeholder="操作类型"
        clearable
        class="toolbar-field"
      >
        <el-option
          v-for="type in operationTypes"
          :key="type"
          :label="getOperationTypeLabel(type)"
          :value="type"
        />
      </el-select>

      <el-select
        v-model="filterForm.status"
        placeholder="状态"
        clearable
        class="toolbar-small"
      >
        <el-option
          label="成功"
          value="SUCCESS"
        />
        <el-option
          label="失败"
          value="FAILED"
        />
        <el-option
          label="错误"
          value="ERROR"
        />
      </el-select>

      <el-button
        type="primary"
        :loading="loading"
        @click="handleFilter"
      >
        <el-icon><Icon :icon="iconMap.search" /></el-icon>
        查询
      </el-button>
      <el-button @click="resetFilter">
        <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
        重置
      </el-button>

      <template #actions>
        <el-button
          text
          @click="toggleAdvancedFilter"
        >
          {{ showAdvancedFilter ? '收起高级筛选' : '展开高级筛选' }}
          <el-icon>
            <Icon :icon="showAdvancedFilter ? iconMap.arrowUp : iconMap.arrowDown" />
          </el-icon>
        </el-button>
      </template>
    </AdminToolbar>

    <section
      v-if="showAdvancedFilter"
      class="audit-advanced surface"
    >
      <el-input
        v-model="filterForm.userName"
        placeholder="用户名"
        clearable
        class="toolbar-field"
      />
      <el-input
        v-model="filterForm.puppetName"
        placeholder="主机名"
        clearable
        class="toolbar-field"
      />
      <el-input
        v-model="filterForm.sessionId"
        placeholder="会话ID"
        clearable
        class="toolbar-wide"
      />
      <el-date-picker
        v-model="filterForm.dateRange"
        type="datetimerange"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        value-format="YYYY-MM-DD HH:mm:ss"
        class="toolbar-date"
        clearable
      />
      <el-input
        v-model="filterForm.clientIp"
        placeholder="客户端IP"
        clearable
        class="toolbar-field"
      />
    </section>

    <section class="audit-mode surface">
      <div class="audit-mode__main">
        <el-icon>
          <Icon :icon="iconMap.shield" />
        </el-icon>
        <span class="audit-mode__title">审计记录</span>
        <el-tag
          :type="auditModeTagType"
          effect="light"
        >
          {{ auditModeLabel }}
        </el-tag>
      </div>
      <el-radio-group
        v-model="auditMode"
        class="audit-mode__switch"
        size="small"
        :disabled="auditModeLoading"
        @change="handleAuditModeChange"
      >
        <el-radio-button
          v-for="option in auditModeOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </el-radio-button>
      </el-radio-group>
    </section>

    <AdminStatsGrid :columns="4">
      <article
        v-for="card in statsCardConfigs"
        :key="card.key"
        class="metric-card"
        :class="card.className"
      >
        <span class="metric-icon">
          <el-icon><Icon :icon="card.icon" /></el-icon>
        </span>
        <div>
          <strong class="metric-value">
            {{ card.format ? card.format(statistics[card.key]) : statistics[card.key] }}
          </strong>
          <span class="metric-label">{{ card.label }}</span>
        </div>
      </article>
    </AdminStatsGrid>

    <section
      v-if="hasActiveFilter"
      class="filter-tags"
    >
      <el-tag
        v-for="(value, key) in activeFilterSummary"
        :key="key"
        closable
        effect="light"
        @close="clearFilterItem(key)"
      >
        {{ key }}: {{ value }}
      </el-tag>
      <el-button
        text
        @click="clearAllFilters"
      >
        清空筛选
      </el-button>
    </section>

    <AdminWorkspacePanel title="审计日志">
      <template #tags>
        <el-tag effect="light">
          总量 {{ totalCount }}
        </el-tag>
        <el-tag
          v-if="hasActiveFilter"
          type="warning"
          effect="light"
        >
          已筛选
        </el-tag>
      </template>

      <template #actions>
        <el-button
          type="danger"
          plain
          :disabled="selectedLogIds.length === 0"
          :loading="deleteLoading"
          @click="handleDeleteSelected"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除选中
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="!hasActiveFilter || totalCount === 0"
          :loading="deleteLoading"
          @click="handleDeleteFiltered"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除筛选
        </el-button>
        <el-button
          type="danger"
          plain
          :loading="cleanupLoading"
          @click="handleCleanup"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          清理旧日志
        </el-button>
        <el-button
          type="primary"
          plain
          :loading="loading"
          @click="refreshAll"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          刷新
        </el-button>
      </template>

      <el-table
        v-loading="loading"
        :data="logs"
        class="logs-table"
        height="100%"
        row-key="logId"
        empty-text="暂无审计日志"
        @selection-change="handleSelectionChange"
      >
        <el-table-column
          type="selection"
          width="44"
          fixed="left"
        />
        <el-table-column
          prop="logId"
          label="日志ID"
          width="280"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="log-id-text">{{ row.logId }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="userName"
          label="用户"
          width="120"
        >
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar
                :size="24"
                class="user-avatar"
              >
                {{ row.userName?.charAt(0)?.toUpperCase() || 'U' }}
              </el-avatar>
              <span class="username">{{ row.userName || row.userId || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="puppetName"
          label="主机"
          width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.puppetName || row.puppetId || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          prop="operationName"
          label="操作"
          width="140"
        >
          <template #default="{ row }">
            <el-tag
              :type="getOperationTagType(row.operationType)"
              size="small"
            >
              {{ row.operationName || row.operationType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="operationPath"
          label="操作路径"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="path-text">{{ row.operationPath || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          width="100"
        >
          <template #default="{ row }">
            <StatusIndicator
              :status="getStatusIndicatorStatus(row.status)"
              :label="getStatusLabel(row.status)"
              compact
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="clientIp"
          label="客户端IP"
          width="140"
        >
          <template #default="{ row }">
            <span class="ip-text">{{ row.clientIp || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="createTime"
          label="操作时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="150"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              type="primary"
              text
              size="small"
              @click="viewDetails(row)"
            >
              <el-icon><Icon :icon="iconMap.document" /></el-icon>
              详情
            </el-button>
            <el-button
              type="danger"
              text
              size="small"
              :loading="deleteLoading"
              @click="handleDeleteOne(row)"
            >
              <el-icon><Icon :icon="iconMap.delete" /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div
        v-if="totalCount > 0"
        class="pagination-wrapper"
      >
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalCount"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </AdminWorkspacePanel>

    <AuditLogDetailsDialog
      v-model="detailsVisible"
      :log="selectedLog"
      :loading="detailLoading"
    />

    <AuditCleanupDialog
      v-model="cleanupDialogVisible"
      v-model:days="cleanupForm.days"
      :loading="cleanupLoading"
      @confirm="confirmCleanup"
    />
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { confirmDelete } from '@/utils/confirmUtils.js'
import {
  getAuditLogsApi,
  getAuditLogDetailApi,
  getAuditLogCountApi,
  cleanupAuditLogsApi,
  deleteAuditLogsApi,
  deleteFilteredAuditLogsApi,
  getAuditLogOperationTypesApi,
  getAuditModeApi,
  updateAuditModeApi
} from '@/services/api.js'
import AdminToolbar from '@/components/Admin/shared/AdminToolbar.vue'
import AdminStatsGrid from '@/components/Admin/shared/AdminStatsGrid.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import AuditCleanupDialog from './AuditCleanupDialog.vue'
import AuditLogDetailsDialog from './AuditLogDetailsDialog.vue'
import {
  AUDIT_OPERATION_TYPE_LABELS,
  buildAuditFilterParams,
  clearAuditFilterField,
  createAuditFilter,
  formatAuditTime,
  getActiveAuditFilterSummary,
  getOperationTagType,
  getOperationTypeLabel,
  getStatusIndicatorStatus,
  getStatusLabel,
  hasActiveAuditFilter
} from './auditManagerModel.js'

const iconMap = icons

// 响应式数据
const loading = ref(false)
const detailLoading = ref(false)
const cleanupLoading = ref(false)
const deleteLoading = ref(false)
const auditModeLoading = ref(false)
const detailsVisible = ref(false)
const cleanupDialogVisible = ref(false)
const selectedLog = ref(null)
let detailRequestSequence = 0
let logsRequestSequence = 0
let statisticsRequestSequence = 0
const selectedLogIds = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const showAdvancedFilter = ref(false)

// 操作类型列表
const operationTypes = ref([])

const defaultAuditModeOptions = [
  { value: 'on', label: '开启' },
  { value: 'write', label: '关闭低风险读操作' },
  { value: 'off', label: '完全关闭' }
]

const auditMode = ref('on')
const lastAuditMode = ref('on')
const auditModeOptions = ref([...defaultAuditModeOptions])

// 统计数据
const statistics = reactive({
  totalLogs: 0,
  successLogs: 0,
  failedLogs: 0,
  lastUpdate: ''
})

// 筛选表单
const filterForm = reactive(createAuditFilter())

// 清理表单
const cleanupForm = reactive({
  days: 30
})

// 日志列表
const logs = ref([])

const auditModeLabel = computed(() => {
  return auditModeOptions.value.find((option) => option.value === auditMode.value)?.label || '开启'
})

const auditModeTagType = computed(() => {
  const tagTypes = {
    on: 'success',
    write: 'warning',
    off: 'danger'
  }
  return tagTypes[auditMode.value] || 'info'
})
const activeFilterSummary = computed(() => getActiveAuditFilterSummary(filterForm))
const hasActiveFilter = computed(() => hasActiveAuditFilter(filterForm))
const buildFilterParams = (overrides = {}) => buildAuditFilterParams(filterForm, overrides)
const executeHandled = (request, options) => executeRequest(request, options).catch(() => false)

// 方法
const refreshAll = async () => {
  await executeHandled(
    async () => {
      await Promise.all([fetchAuditMode(), fetchStatistics(), loadOperationTypes(), fetchLogs()])
      return true
    },
    {
      loadingRef: loading,
      errorMessage: '数据刷新失败'
    }
  )
}

const applyAuditModeData = (data, fallbackMode = 'on') => {
  const resolvedMode = data?.mode || fallbackMode || 'on'
  auditMode.value = resolvedMode
  lastAuditMode.value = resolvedMode
  if (Array.isArray(data?.options) && data.options.length > 0) {
    auditModeOptions.value = data.options
  }
}

const fetchAuditMode = async () => {
  try {
    const res = await getAuditModeApi()
    applyAuditModeData(res.data)
  } catch {
    auditModeOptions.value = [...defaultAuditModeOptions]
  }
}

const handleAuditModeChange = async (mode) => {
  const previousMode = lastAuditMode.value || 'on'
  if (mode === previousMode) return
  try {
    await executeRequest(
      async () => updateAuditModeApi({ mode }),
      {
        loadingRef: auditModeLoading,
        successMessage: null,
        errorMessage: '更新审计模式失败',
        onSuccess: async (res) => {
          applyAuditModeData(res.data, mode)
          showSuccess(res.msg || '审计模式已更新')
          await Promise.all([fetchLogs(), fetchStatistics()])
        }
      }
    )
  } catch {
    auditMode.value = previousMode
  }
}

const fetchStatistics = async () => {
  const requestSequence = ++statisticsRequestSequence
  const baseParams = buildFilterParams()
  const filterStatus = baseParams.status || ''
  try {
    const totalRes = await getAuditLogCountApi(baseParams)
    if (requestSequence !== statisticsRequestSequence) return
    const totalLogs = Number(totalRes.data?.count || 0)

    if (filterStatus === 'SUCCESS') {
      statistics.totalLogs = totalLogs
      statistics.successLogs = totalLogs
      statistics.failedLogs = 0
      statistics.lastUpdate = new Date().toLocaleString('zh-CN')
      return
    }
    if (filterStatus === 'FAILED' || filterStatus === 'ERROR') {
      statistics.totalLogs = totalLogs
      statistics.successLogs = 0
      statistics.failedLogs = totalLogs
      statistics.lastUpdate = new Date().toLocaleString('zh-CN')
      return
    }

    const [successRes, failedRes, errorRes] = await Promise.all([
      getAuditLogCountApi({ ...baseParams, status: 'SUCCESS' }),
      getAuditLogCountApi({ ...baseParams, status: 'FAILED' }),
      getAuditLogCountApi({ ...baseParams, status: 'ERROR' })
    ])
    if (requestSequence !== statisticsRequestSequence) return
    statistics.totalLogs = totalLogs
    statistics.successLogs = successRes.data?.count || 0
    statistics.failedLogs = (failedRes.data?.count || 0) + (errorRes.data?.count || 0)
    statistics.lastUpdate = new Date().toLocaleString('zh-CN')
  } catch { /* ignore */ }
}

const loadOperationTypes = async () => {
  try {
    const res = await getAuditLogOperationTypesApi()
    operationTypes.value = Array.isArray(res.data) ? res.data : []
  } catch {
    operationTypes.value = Object.keys(AUDIT_OPERATION_TYPE_LABELS)
  }
}

const fetchLogs = async () => {
  const requestSequence = ++logsRequestSequence
  const params = buildFilterParams({
    limit: pageSize.value,
    offset: (currentPage.value - 1) * pageSize.value
  })
  await executeHandled(
    async () => {
      const res = await getAuditLogsApi(params)
      if (requestSequence === logsRequestSequence) {
        logs.value = Array.isArray(res.data?.logs) ? res.data.logs : []
        totalCount.value = Number(res.data?.total || 0)
      }

      return res
    },
    {
      loadingRef: loading,
      successMessage: null,
      errorMessage: '获取日志列表失败'
    }
  )
}

const handleFilter = async () => {
  currentPage.value = 1
  await Promise.all([fetchLogs(), fetchStatistics()])
}

const resetFilter = async () => {
  Object.assign(filterForm, createAuditFilter())
  currentPage.value = 1
  await Promise.all([fetchLogs(), fetchStatistics()])
}

const clearAllFilters = () => resetFilter()

const toggleAdvancedFilter = () => {
  showAdvancedFilter.value = !showAdvancedFilter.value
}

const clearFilterItem = (key) => {
  if (clearAuditFilterField(filterForm, key)) handleFilter()
}

const viewDetails = async (log) => {
  const requestSequence = ++detailRequestSequence
  selectedLog.value = log
  detailsVisible.value = true

  if (log.logId) {
    detailLoading.value = true
    try {
      const res = await getAuditLogDetailApi({ logId: log.logId })
      if (requestSequence === detailRequestSequence && res.data) {
        selectedLog.value = res.data
      }
    } catch (error) {
      if (requestSequence === detailRequestSequence) {
        showError(error?.message || '获取日志详情失败')
      }
    } finally {
      if (requestSequence === detailRequestSequence) detailLoading.value = false
    }
  }
}

watch(detailsVisible, (visible) => {
  if (visible) return
  detailRequestSequence += 1
  detailLoading.value = false
})

const handleSelectionChange = (selection) => {
  selectedLogIds.value = selection
    .map((item) => item.logId)
    .filter(Boolean)
}

const refreshAfterDelete = async (deleted = 1) => {
  selectedLogIds.value = []
  const maxPage = Math.max(1, Math.ceil(Math.max(0, totalCount.value - deleted) / pageSize.value))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
  }
  await Promise.all([fetchLogs(), fetchStatistics()])
}

const handleDeleteOne = async (row) => {
  if (!row?.logId) return
  const confirmed = await confirmDelete({
    title: '删除审计日志',
    message: `确定删除日志 ${row.logId} 吗？此操作不可恢复。`,
    confirmButtonText: '删除'
  })
  if (!confirmed) return
  await executeHandled(
    async () => deleteAuditLogsApi({ logIds: [row.logId] }),
    {
      loadingRef: deleteLoading,
      successMessage: null,
      errorMessage: '删除失败',
      onSuccess: async (res) => {
        showSuccess(res.msg || '删除成功')
        await refreshAfterDelete(res.data?.deleted || 1)
      }
    }
  )
}

const handleDeleteSelected = async () => {
  if (selectedLogIds.value.length === 0) return
  const confirmed = await confirmDelete({
    title: '删除选中日志',
    message: `确定删除选中的 ${selectedLogIds.value.length} 条审计日志吗？此操作不可恢复。`,
    confirmButtonText: '删除'
  })
  if (!confirmed) return
  await executeHandled(
    async () => deleteAuditLogsApi({ logIds: selectedLogIds.value }),
    {
      loadingRef: deleteLoading,
      successMessage: null,
      errorMessage: '删除失败',
      onSuccess: async (res) => {
        showSuccess(res.msg || '删除成功')
        await refreshAfterDelete(res.data?.deleted || selectedLogIds.value.length)
      }
    }
  )
}

const handleDeleteFiltered = async () => {
  if (!hasActiveFilter.value) return
  const confirmed = await confirmDelete({
    title: '删除筛选结果',
    message: `确定删除当前筛选条件命中的 ${totalCount.value} 条审计日志吗？此操作不可恢复。`,
    confirmButtonText: '删除'
  })
  if (!confirmed) return
  await executeHandled(
    async () => deleteFilteredAuditLogsApi({
      ...buildFilterParams(),
      confirm: 'DELETE'
    }),
    {
      loadingRef: deleteLoading,
      successMessage: null,
      errorMessage: '删除筛选结果失败',
      onSuccess: async (res) => {
        showSuccess(res.msg || '删除成功')
        currentPage.value = 1
        await refreshAfterDelete(res.data?.deleted || totalCount.value)
      }
    }
  )
}

const handleCleanup = () => {
  cleanupDialogVisible.value = true
}

const confirmCleanup = async () => {
  await executeHandled(
    async () => {
      return cleanupAuditLogsApi({ days: cleanupForm.days })
    },
    {
      loadingRef: cleanupLoading,
      successMessage: null,
      errorMessage: '清理失败',
      onSuccess: async (res) => {
        showSuccess(res.msg || '清理成功')
        cleanupDialogVisible.value = false
        await Promise.all([fetchLogs(), fetchStatistics()])
      }
    }
  )
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  fetchLogs()
}

const handleCurrentChange = (page) => {
  currentPage.value = page
  fetchLogs()
}

// 统计卡片配置
const statsCardConfigs = [
  { key: 'totalLogs', label: '总日志数', icon: iconMap.document, className: 'total-logs' },
  { key: 'successLogs', label: '成功日志', icon: iconMap.success, className: 'success-logs' },
  { key: 'failedLogs', label: '失败日志', icon: iconMap.warning, className: 'failed-logs' },
  {
    key: 'lastUpdate',
    label: '最后更新',
    icon: iconMap.timer,
    className: 'last-update',
    format: formatAuditTime
  }
]

// 生命周期
onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.audit-manager {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.audit-advanced {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.audit-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.audit-mode__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--el-text-color-primary);
}

.audit-mode__title {
  font-weight: 650;
  white-space: nowrap;
}

.audit-mode__switch {
  flex: 0 1 auto;
  min-width: 0;
}

.audit-mode__switch :deep(.el-radio-button__inner) {
  min-width: 86px;
}

.toolbar-search {
  width: min(340px, 100%);
}

.toolbar-field {
  width: 140px;
}

.toolbar-wide {
  width: 220px;
}

.toolbar-date {
  width: 360px;
}

.toolbar-small {
  width: 112px;
}

.total-logs .metric-icon {
  background: color-mix(in srgb, var(--el-color-primary) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-primary);
}

.success-logs .metric-icon {
  background: color-mix(in srgb, var(--el-color-success) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-success);
}

.failed-logs .metric-icon {
  background: color-mix(in srgb, var(--el-color-danger) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-danger);
}

.last-update .metric-icon {
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-warning);
}

.filter-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 2px;
}

.audit-manager :deep(.admin-workspace-panel__body) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logs-table {
  flex: 1;
  min-height: 0;
}

.logs-table :deep(.el-table__header th) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 650;
  background: var(--el-fill-color-light) !important;
}

.logs-table :deep(.el-table__row td) {
  padding: 10px 0;
}

.log-id-text,
.session-id-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-regular);
}

.path-text,
.ip-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  background: var(--el-color-primary);
  color: white;
  font-weight: 600;
}

.username {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.pagination-wrapper {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
}

@media (max-width: 768px) {
  :deep(.admin-toolbar__actions) {
    width: 100%;
  }

  :deep(.admin-toolbar__actions .el-button) {
    flex: 1;
  }

  .audit-advanced,
  .audit-mode,
  .pagination-wrapper {
    padding-left: 14px;
    padding-right: 14px;
  }

  .audit-mode {
    align-items: flex-start;
    flex-direction: column;
  }

  .audit-mode__switch {
    width: 100%;
  }

  .audit-mode__switch :deep(.el-radio-button__inner) {
    min-width: 0;
  }

  .toolbar-search,
  .toolbar-field,
  .toolbar-wide,
  .toolbar-date,
  .toolbar-small {
    width: 100%;
  }
}
</style>
