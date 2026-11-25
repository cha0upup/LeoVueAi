<template>
  <div class="audit-manager">
    <PageHeader
      title="审计日志"
      :icon="iconMap.document"
    />
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
        v-for="(label, field) in basicFilterFields"
        :key="field"
        v-model="filterForm[field]"
        :placeholder="label"
        clearable
        class="toolbar-field"
        @keyup.enter="handleFilter"
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
          v-for="status in ['SUCCESS', 'FAILED', 'ERROR']"
          :key="status"
          :label="getStatusLabel(status)"
          :value="status"
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
          @click="showAdvancedFilter = !showAdvancedFilter"
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
        v-for="(label, field) in advancedFilterFields"
        :key="field"
        v-model="filterForm[field]"
        :placeholder="label"
        clearable
        :class="field === 'sessionId' ? 'toolbar-wide' : 'toolbar-field'"
        @keyup.enter="handleFilter"
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
        @keyup.enter="handleFilter"
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
        :disabled="auditModeLoading || !lastAuditMode"
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

    <StatsStrip :columns="4">
      <article
        v-for="card in statsCardConfigs"
        :key="card.key"
        class="metric-card"
        :class="card.className"
      >
        <span class="metric-label">{{ card.label }}</span>
        <strong class="metric-value">
          {{ card.format ? card.format(statistics[card.key]) : (statistics[card.key] ?? '—') }}
        </strong>
      </article>
    </StatsStrip>

    <section
      v-if="activeFilterSummary.length || filtersDirty"
      class="filter-tags"
    >
      <span
        v-if="filtersDirty"
        role="status"
      >筛选已编辑，点击「查询」应用</span>
      <el-tag
        v-for="{ field, label, value } in activeFilterSummary"
        :key="field"
        closable
        effect="light"
        @close="clearFilterItem(field)"
      >
        {{ label }}: {{ value }}
      </el-tag>
      <el-button
        v-if="activeFilterSummary.length"
        text
        @click="resetFilter"
      >
        清空筛选
      </el-button>
    </section>

    <AdminWorkspacePanel title="日志列表">
      <template #tags>
        <el-tag effect="light">
          总量 {{ page?.total ?? '—' }}
        </el-tag>
        <el-tag
          v-if="activeFilterSummary.length"
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
          :disabled="!canDeleteRows || selectedLogIds.length === 0"
          :loading="deleteLoading"
          @click="handleDeleteSelected"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除选中
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="!canDeleteFiltered"
          :loading="deleteLoading"
          @click="handleDeleteFiltered"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除筛选
        </el-button>
        <el-button
          type="danger"
          plain
          :disabled="deleteLoading"
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

      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon
      />
      <el-table
        v-loading="loading"
        :data="page?.logs ?? []"
        class="logs-table"
        height="100%"
        row-key="logId"
        :empty-text="emptyText"
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
          prop="agentName"
          label="主机"
          width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.agentName || row.agentId || '-' }}
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
              @click="loadDetails(row.logId)"
            >
              <el-icon><Icon :icon="iconMap.document" /></el-icon>
              详情
            </el-button>
            <el-button
              type="danger"
              text
              size="small"
              :disabled="!canDeleteRows"
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
        v-if="page?.total > 0"
        class="pagination-wrapper"
      >
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :pager-count="5"
          :total="page.total"
          layout="total, sizes, prev, pager, next, jumper"
          @update:page-size="changePageSize"
          @update:current-page="changePage"
        />
      </div>
    </AdminWorkspacePanel>

    <AuditLogDetailsDialog
      v-model="detailsVisible"
      :log-id="detailLogId"
      :log="selectedLog"
      :loading="detailLoading"
      :error-message="detailError"
      @retry="loadDetails(detailLogId)"
    />

    <AuditCleanupDialog
      v-model="cleanupDialogVisible"
      v-model:days="cleanupDays"
      :loading="cleanupLoading"
      @confirm="confirmCleanup"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { showSuccess } from '@/utils/messageUtils.js'
import { confirmDelete } from '@/utils/confirmUtils.js'
import {
  getAuditLogDetailApi,
  cleanupAuditLogsApi,
  deleteAuditLogsApi,
  deleteFilteredAuditLogsApi,
  getAuditLogOperationTypesApi,
  getAuditModeApi,
  updateAuditModeApi
} from '@/services/api/admin.js'
import AdminToolbar from '@/components/Admin/shared/AdminToolbar.vue'
import StatsStrip from '@/components/common/StatsStrip.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import AuditCleanupDialog from './AuditCleanupDialog.vue'
import AuditLogDetailsDialog from './AuditLogDetailsDialog.vue'
import { useAuditLogPage } from './useAuditLogPage.js'
import {
  AUDIT_OPERATION_TYPE_LABELS,
  buildAuditFilterParams,
  createAuditFilter,
  formatAuditTime,
  getActiveAuditFilterSummary,
  getOperationTagType,
  getOperationTypeLabel,
  getStatusIndicatorStatus,
  getStatusLabel
} from './auditManagerModel.js'

const basicFilterFields = { userId: '用户ID', agentId: '主机ID' }
const advancedFilterFields = { userName: '用户名', agentName: '主机名', sessionId: '会话ID' }
const statsCardConfigs = [
  { key: 'total', label: '总日志数' },
  { key: 'successCount', label: '成功日志', className: 'metric-card--success' },
  { key: 'failedCount', label: '失败日志', className: 'metric-card--danger' },
  { key: 'updatedAt', label: '最近查询', className: 'metric-card--time', format: formatAuditTime }
]

const { appliedFilters, currentPage, pageSize, page, updatedAt, loading, errorMessage,
  applyFilters, loadPage, changePage, changePageSize } = useAuditLogPage()
const filterForm = reactive(createAuditFilter())
const showAdvancedFilter = ref(false)
const draftFilters = computed(() => buildAuditFilterParams(filterForm))
const activeFilterSummary = computed(() => getActiveAuditFilterSummary(appliedFilters.value))
const filtersDirty = computed(() =>
  JSON.stringify(draftFilters.value) !== JSON.stringify(appliedFilters.value)
)
const statistics = computed(() => ({ ...page.value, updatedAt: updatedAt.value }))
const emptyText = computed(() => {
  if (loading.value) return '正在查询…'
  if (errorMessage.value) return '请刷新后重试'
  return activeFilterSummary.value.length ? '没有匹配的日志' : '暂无审计日志'
})

const handleFilter = () => applyFilters(draftFilters.value)

const resetFilter = () => {
  Object.assign(filterForm, createAuditFilter())
  return applyFilters({})
}

const clearFilterItem = (field) => {
  const filters = { ...appliedFilters.value }
  if (field === 'dateRange') {
    filterForm.dateRange = []
    delete filters.startTime
    delete filters.endTime
  } else {
    filterForm[field] = ''
    delete filters[field]
  }
  return applyFilters(filters)
}

const operationTypes = ref(Object.keys(AUDIT_OPERATION_TYPE_LABELS))
const defaultAuditModeOptions = [
  { value: 'on', label: '开启' },
  { value: 'write', label: '关闭低风险读操作' },
  { value: 'off', label: '完全关闭' }
]
const auditMode = ref('')
const lastAuditMode = ref('')
const auditModeOptions = ref(defaultAuditModeOptions)
const auditModeLoading = ref(false)
const auditModeLabel = computed(() =>
  auditModeOptions.value.find((option) => option.value === auditMode.value)?.label ?? '未获取'
)
const auditModeTagType = computed(() =>
  ({ on: 'success', write: 'warning', off: 'danger' })[auditMode.value] ?? 'info'
)
const executeHandled = (request, options) => executeRequest(request, options).catch(() => false)

function applyAuditModeData(data, mode = data?.mode) {
  auditMode.value = lastAuditMode.value = mode || ''
  if (Array.isArray(data?.options) && data.options.length) auditModeOptions.value = data.options
}

const fetchAuditMode = () => {
  if (auditModeLoading.value) return
  return executeHandled(getAuditModeApi, {
    loadingRef: auditModeLoading,
    errorMessage: '获取审计模式失败',
    onSuccess: ({ data }) => applyAuditModeData(data)
  })
}

const handleAuditModeChange = async (mode) => {
  const previousMode = lastAuditMode.value
  if (!previousMode || mode === previousMode || auditModeLoading.value) return
  const result = await executeHandled(() => updateAuditModeApi({ mode }), {
    loadingRef: auditModeLoading,
    successMessage: '审计模式已更新',
    errorMessage: '更新审计模式失败',
    onSuccess: async ({ data }) => {
      applyAuditModeData(data, data?.mode || mode)
      if (!disposed) await loadPage()
    }
  })
  if (!result) auditMode.value = previousMode
}

const loadOperationTypes = async () => {
  try {
    const { data } = await getAuditLogOperationTypesApi()
    if (Array.isArray(data)) operationTypes.value = data
  } catch {
    // 服务不可用时仍可按本地已知类型筛选。
  }
}

const refreshAll = () => Promise.all([fetchAuditMode(), loadOperationTypes(), loadPage()])

const detailLogId = ref('')
const selectedLog = shallowRef(null)
const detailLoading = ref(false)
const detailError = ref('')
let detailRequest
let disposed = false

const detailsVisible = computed({
  get: () => Boolean(detailLogId.value),
  set(visible) {
    if (visible) return
    detailRequest?.abort()
    detailRequest = undefined
    detailLogId.value = ''
    selectedLog.value = null
    detailError.value = ''
    detailLoading.value = false
  }
})

async function loadDetails(logId) {
  if (!logId || disposed || (detailLoading.value && detailLogId.value === logId)) return
  detailRequest?.abort()
  const request = new AbortController()
  const { signal } = request
  detailRequest = request
  detailLogId.value = logId
  selectedLog.value = null
  detailError.value = ''
  detailLoading.value = true
  try {
    const { data } = await getAuditLogDetailApi(logId, { signal })
    if (signal.aborted) return
    if (data?.logId !== logId) throw new Error('日志详情响应不完整，请重试')
    selectedLog.value = data
  } catch (error) {
    if (!signal.aborted) {
      detailError.value = handleError(error, { defaultMessage: '获取日志详情失败', showMessage: false })
    }
  } finally {
    if (detailRequest === request) {
      detailRequest = undefined
      detailLoading.value = false
    }
  }
}

onScopeDispose(() => {
  disposed = true
  detailRequest?.abort()
})

const selectedLogIds = ref([])
const deleteLoading = ref(false)
const cleanupLoading = ref(false)
const cleanupDialogVisible = ref(false)
const cleanupDays = ref(30)
const canDeleteRows = computed(() => Boolean(page.value)
  && !loading.value && !deleteLoading.value && !cleanupLoading.value)
const canDeleteFiltered = computed(() => canDeleteRows.value && !filtersDirty.value
  && Boolean(page.value?.total) && activeFilterSummary.value.length > 0)

const handleSelectionChange = (selection) => {
  selectedLogIds.value = selection.map(({ logId }) => logId).filter(Boolean)
}
watch(page, () => { selectedLogIds.value = [] }, { flush: 'sync' })

const confirmLogDeletion = async (request, title, message) => {
  deleteLoading.value = true
  try {
    const confirmed = await confirmDelete({ title, message, confirmButtonText: '删除' })
    if (!confirmed || disposed) return
    await executeHandled(request, {
      errorMessage: '删除审计日志失败',
      onSuccess: async ({ data }) => {
        showSuccess(`已删除 ${data?.deleted ?? 0} 条日志`)
        if (!disposed) await loadPage()
      }
    })
  } finally {
    deleteLoading.value = false
  }
}

const handleDeleteOne = ({ logId }) => {
  if (!canDeleteRows.value || !logId) return
  return confirmLogDeletion(() => deleteAuditLogsApi({ logIds: [logId] }),
    '删除审计日志', `确定删除日志 ${logId} 吗？此操作不可恢复。`)
}

const handleDeleteSelected = () => {
  if (!canDeleteRows.value || !selectedLogIds.value.length) return
  const logIds = [...selectedLogIds.value]
  return confirmLogDeletion(() => deleteAuditLogsApi({ logIds }),
    '删除选中日志', `确定删除选中的 ${logIds.length} 条审计日志吗？此操作不可恢复。`)
}

const handleDeleteFiltered = () => {
  if (!canDeleteFiltered.value) return
  // 对话框与提交使用同一份已应用筛选，避免误删尚未查询的草稿条件。
  const params = { ...appliedFilters.value, confirm: 'DELETE' }
  return confirmLogDeletion(() => deleteFilteredAuditLogsApi(params), '删除筛选结果',
    `确定删除这些筛选条件匹配的审计日志吗？最近查询为 ${page.value.total} 条，此操作不可恢复。`)
}

const handleCleanup = () => {
  if (!deleteLoading.value) cleanupDialogVisible.value = true
}

const confirmCleanup = () => {
  const days = cleanupDays.value
  if (cleanupLoading.value || deleteLoading.value || !Number.isInteger(days) || days < 1 || days > 365) return
  return executeHandled(() => cleanupAuditLogsApi({ days }), {
    loadingRef: cleanupLoading,
    errorMessage: '清理失败',
    onSuccess: async ({ data }) => {
      showSuccess(`已清理 ${data?.deleted ?? 0} 条旧日志`)
      cleanupDialogVisible.value = false
      if (!disposed) await loadPage()
    }
  })
}

onMounted(refreshAll)
</script>

<style scoped>
.audit-manager {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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

.log-id-text {
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
  .audit-manager {
    overflow-y: auto;
  }

  .audit-manager :deep(.admin-workspace-panel) {
    min-height: 320px;
  }

  .pagination-wrapper {
    justify-content: flex-start;
    overflow-x: auto;
  }

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
