<template>
  <ManagerLayout
    title="指纹管理"
    :icon="iconMap.fingerprint"
    module-class="fingerprint-manager"
    hide-toolbar
    :initial-list-width="320"
    :list-min="260"
    :list-max="480"
  >
    <template #list>
      <div class="list-header">
        <div class="list-title-group">
          <span class="list-kicker">Fingerprint Directory</span>
          <h2>指纹目录</h2>
        </div>

        <el-button
          v-if="isAdmin"
          type="primary"
          size="small"
          class="action-add"
          @click="openAddDialog"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新增指纹
        </el-button>
      </div>

      <div class="scope-tabs">
        <button
          v-for="p in protocolTabs"
          :key="p.value"
          type="button"
          class="scope-tab"
          :class="{ 'is-active': activeProtocol === p.value }"
          @click="activeProtocol = p.value"
        >
          {{ p.label }}
          <span>{{ p.count }}</span>
        </button>
      </div>

      <div class="toolbar-row">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索 ID、名称或标签"
          clearable
          size="small"
          class="search-input"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>

        <el-tooltip
          v-if="isAdmin"
          content="导入指纹"
          placement="top"
        >
          <button
            class="u-icon-btn"
            type="button"
            aria-label="导入指纹"
            @click="showImportDialog = true"
          >
            <el-icon><Icon :icon="iconMap.upload" /></el-icon>
          </button>
        </el-tooltip>

        <el-tooltip
          content="刷新列表"
          placement="top"
        >
          <button
            class="u-icon-btn"
            type="button"
            aria-label="刷新指纹列表"
            @click="getFingerprints"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <div class="result-row">
        <span>当前 {{ filteredFingerprints.length }} / {{ fingerprints.length }} 条</span>
        <span>{{ httpCount }} HTTP · {{ tcpCount }} TCP</span>
      </div>

      <BatchActionBar
        :count="selectedIds.size"
        :all-selected="allFilteredSelected"
        :some-selected="someFilteredSelected"
        @toggle-all="toggleSelectAll"
        @clear="clearBatchSelection"
      >
        <el-button
          size="small"
          type="primary"
          :loading="batchExportLoading"
          @click="handleBatchExport"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          导出 zip
        </el-button>
        <el-button
          v-if="isAdmin"
          size="small"
          type="danger"
          :loading="batchDeleteLoading"
          @click="handleBatchDelete"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除
        </el-button>
      </BatchActionBar>

      <div class="list-scroll">
        <div
          v-if="listLoading && !filteredFingerprints.length"
          class="list-loading"
        >
          <el-skeleton
            :rows="8"
            animated
          />
        </div>

        <template v-else-if="filteredFingerprints.length">
          <EntityCard
            v-for="item in filteredFingerprints"
            :key="item.fingerprintId"
            :title="item.name || item.fingerprintId"
            :description="item.fingerprintId"
            :icon="iconMap.fingerprint"
            :active="getRowId(item) === getRowId(selectedFingerprint)"
            selectable
            :selected="selectedIds.has(item.fingerprintId)"
            :in-selection-mode="selectedIds.size > 0"
            @click="selectFingerprint(item)"
            @toggle-selected="(val) => setSelected(item, val)"
          >
            <template #status>
              <el-tag
                size="small"
                :type="item.protocol === 'http' ? 'primary' : 'success'"
                effect="plain"
                class="workbench-type-tag"
              >
                {{ (item.protocol || '-').toUpperCase() }}
              </el-tag>
            </template>
            <template #extra>
              <div class="fingerprint-card-meta">
                <span>{{ item.tags?.length || 0 }} 标签</span>
                <span>{{ vulnerabilityCount(item) }} 漏洞</span>
                <span>{{ requestCount(item) ?? '—' }} 请求</span>
              </div>
            </template>
            <template #actions>
              <el-tooltip
                content="导出 JSON"
                placement="left"
              >
                <button
                  type="button"
                  class="u-icon-btn"
                  :aria-label="`导出指纹 ${item.name || item.fingerprintId}`"
                  @click.stop="handleQuickExport(item)"
                >
                  <el-icon><Icon :icon="iconMap.download" /></el-icon>
                </button>
              </el-tooltip>
              <el-tooltip
                v-if="isAdmin"
                content="删除"
                placement="left"
              >
                <button
                  type="button"
                  class="u-icon-btn u-icon-btn--danger"
                  :aria-label="`删除指纹 ${item.name || item.fingerprintId}`"
                  @click.stop="handleDelete(item)"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                </button>
              </el-tooltip>
            </template>
          </EntityCard>
        </template>

        <EmptyState
          v-else
          description="没有匹配的指纹"
          compact
        />
      </div>
    </template>

    <template #detail>
      <FingerprintDetail
        :detail="detailData"
        :can-manage="isAdmin"
        :detail-loading="detailLoading"
        :export-loading="detailExportLoading"
        @edit="selectedFingerprint && openEditDialog(selectedFingerprint)"
        @export="selectedFingerprint && handleDetailExport(selectedFingerprint)"
        @delete="selectedFingerprint && handleDelete(selectedFingerprint)"
      />
    </template>

    <SaveFingerprintDialog
      v-model="showSaveDialog"
      :fingerprint="currentEditDetail"
      :loading="saveLoading"
      @submit="handleSave"
    />

    <ImportFingerprintDialog
      v-model="showImportDialog"
      @imported="handleImported"
    />
  </ManagerLayout>
</template>

<script setup>
import { ElMessageBox } from 'element-plus'
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { executeRequest, executeRequestWithStatus } from '@/utils/apiUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import {
  getFingerprintsApi,
  getFingerprintDetailApi,
  saveFingerprintApi,
  deleteFingerprintApi,
  exportFingerprintApi,
  exportFingerprintsBatchApi
} from '@/services/api.js'
import FingerprintDetail from './FingerprintDetail.vue'
import SaveFingerprintDialog from './SaveFingerprintDialog.vue'
import ImportFingerprintDialog from './ImportFingerprintDialog.vue'
import ManagerLayout from '@/components/common/ManagerLayout.vue'
import EntityCard from '@/components/common/EntityCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BatchActionBar from '@/components/common/BatchActionBar.vue'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { useAuth } from '@/composables/useAuth.js'

const { isAdmin } = useAuth()

const fingerprints = ref([])
const selectedFingerprint = ref(null)
const detailData = ref(null)
const searchKeyword = ref('')
const activeProtocol = ref('all')
const listLoading = ref(false)
const detailLoading = ref(false)
const saveLoading = ref(false)

const showSaveDialog = ref(false)
const showImportDialog = ref(false)
const currentEditDetail = ref(null)

// 批量选择 / 导出
const selectedIds = ref(new Set())
const batchExportLoading = ref(false)
const batchDeleteLoading = ref(false)
const detailExportLoading = ref(false)

const iconMap = icons

const httpCount = computed(
  () => fingerprints.value.filter((item) => item.protocol === 'http').length
)
const tcpCount = computed(() => fingerprints.value.filter((item) => item.protocol === 'tcp').length)
const protocolTabs = computed(() => [
  { label: '全部', value: 'all', count: fingerprints.value.length },
  { label: 'HTTP', value: 'http', count: httpCount.value },
  { label: 'TCP', value: 'tcp', count: tcpCount.value }
])

function vulnerabilityCount(item) {
  return Array.isArray(item?.info?.vulnerabilities) ? item.info.vulnerabilities.length : 0
}

function requestCount(item) {
  return Array.isArray(item?.rule?.requests) ? item.rule.requests.length : null
}

const filteredFingerprints = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return fingerprints.value.filter((item) => {
    const fid = (item.fingerprintId || '').toLowerCase()
    const name = (item.name || '').toLowerCase()
    const tagsStr = (item.tags || []).join(' ').toLowerCase()
    const matchKeyword =
      !keyword || fid.includes(keyword) || name.includes(keyword) || tagsStr.includes(keyword)
    const matchProtocol = activeProtocol.value === 'all' || item.protocol === activeProtocol.value
    return matchKeyword && matchProtocol
  })
})

function selectFingerprint(row) {
  selectedFingerprint.value = row
}

function getRowId(row) {
  return row?.fingerprintId
}

let detailRequestId = 0
async function fetchDetail(idOrFingerprintId) {
  if (!idOrFingerprintId) {
    detailData.value = null
    return
  }
  const requestId = ++detailRequestId
  detailLoading.value = true
  detailData.value = null
  try {
    const res = await getFingerprintDetailApi({ fingerprintId: idOrFingerprintId })
    if (requestId !== detailRequestId) return
    detailData.value = res.data ?? null
  } catch {
    if (requestId !== detailRequestId) return
    detailData.value = null
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }
}

watch(
  selectedFingerprint,
  (row) => {
    fetchDetail(getRowId(row))
  },
  { immediate: true }
)

async function getFingerprints() {
  const prevId = getRowId(selectedFingerprint.value)
  await executeRequest(
    async () => {
      const response = await getFingerprintsApi()
      const list = response.data ?? []
      fingerprints.value = (Array.isArray(list) ? list : [])
        .slice()
        .sort((a, b) => (a.name || a.fingerprintId).localeCompare(b.name || b.fingerprintId))
      if (fingerprints.value.length === 0) {
        selectedFingerprint.value = null
        detailData.value = null
      } else {
        const kept = prevId ? fingerprints.value.find((f) => f.fingerprintId === prevId) : null
        selectedFingerprint.value = kept ?? fingerprints.value[0]
      }
      return response
    },
    {
      loadingRef: listLoading,
      successMessage: null,
      errorMessage: '获取指纹列表失败，请重试'
    }
  )
}

function openAddDialog() {
  currentEditDetail.value = null
  showSaveDialog.value = true
}

function openEditDialog(row) {
  const id = getRowId(row)
  if (!id) return
  detailLoading.value = true
  getFingerprintDetailApi({ fingerprintId: id })
    .then((res) => {
      const d = res.data ?? null
      currentEditDetail.value = d
      showSaveDialog.value = true
    })
    .catch(() => {
      currentEditDetail.value = {
        fingerprintId: row.fingerprintId,
        name: row.name,
        protocol: row.protocol,
        tags: row.tags,
        info: row.info
      }
      showSaveDialog.value = true
    })
    .finally(() => {
      detailLoading.value = false
    })
}

async function handleSave(payload) {
  await executeRequestWithStatus(() => saveFingerprintApi(payload), {
    loadingRef: saveLoading,
    successMessages: { 200: '保存成功' },
    errorMessages: {
      400: '参数错误（如缺少 name、rule、version）',
      401: '用户未登录，请先登录',
      default: '保存失败，请重试'
    },
    onSuccess: (response) => {
      showSaveDialog.value = false
      currentEditDetail.value = null
      const savedId = response?.data?.fingerprintId
      getFingerprints().then(() => {
        if (savedId) {
          const found = fingerprints.value.find((f) => f.fingerprintId === savedId)
          if (found) selectedFingerprint.value = found
          fetchDetail(savedId)
        }
      })
    }
  })
}

// ── 删除 ──────────────────────────────────────────────────────────────────
async function handleDelete(item) {
  const id = item?.fingerprintId
  if (!id) return
  try {
    await ElMessageBox.confirm(
      `确认删除指纹「${item.name || id}」？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  await executeRequest(
    async () => {
      const res = await deleteFingerprintApi({ fingerprintId: id })
      await getFingerprints()
      return res
    },
    { successMessage: '删除成功', errorMessage: '删除失败，请重试' }
  )
}

async function handleBatchDelete() {
  if (!selectedIds.value.size) return
  const ids = Array.from(selectedIds.value)
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${ids.length} 条指纹？此操作不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  batchDeleteLoading.value = true
  try {
    await Promise.all(ids.map((fingerprintId) => deleteFingerprintApi({ fingerprintId })))
    showSuccess(`已删除 ${ids.length} 条指纹`)
    clearBatchSelection()
    await getFingerprints()
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '批量删除失败')
  } finally {
    batchDeleteLoading.value = false
  }
}

// ── 导出 ──────────────────────────────────────────────────────────────────
async function handleQuickExport(item) {
  if (!item?.fingerprintId) return
  try {
    const res = await exportFingerprintApi(item.fingerprintId)
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/json' })
    downloadBlob(blob, `${item.fingerprintId}.json`)
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '导出失败')
  }
}

async function handleDetailExport(item) {
  if (!item?.fingerprintId) return
  detailExportLoading.value = true
  try {
    const res = await exportFingerprintApi(item.fingerprintId)
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/json' })
    downloadBlob(blob, `${item.fingerprintId}.json`)
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '导出失败')
  } finally {
    detailExportLoading.value = false
  }
}

async function handleExportList(list) {
  const ids = (list || []).map((f) => f.fingerprintId).filter(Boolean)
  if (!ids.length) return
  batchExportLoading.value = true
  try {
    const res = await exportFingerprintsBatchApi({ fingerprintIds: ids })
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/zip' })
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `fingerprints_${date}.zip`)
    showSuccess(`已导出 ${ids.length} 条指纹`)
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '导出失败')
  } finally {
    batchExportLoading.value = false
  }
}

// ── 批量选择 ──────────────────────────────────────────────────────────────
const allFilteredSelected = computed(() => {
  if (!filteredFingerprints.value.length) return false
  return filteredFingerprints.value.every((f) => selectedIds.value.has(f.fingerprintId))
})

const someFilteredSelected = computed(() => {
  if (!filteredFingerprints.value.length) return false
  const hits = filteredFingerprints.value.filter((f) => selectedIds.value.has(f.fingerprintId)).length
  return hits > 0 && hits < filteredFingerprints.value.length
})

function setSelected(item, val) {
  if (!item?.fingerprintId) return
  const next = new Set(selectedIds.value)
  if (val) next.add(item.fingerprintId)
  else next.delete(item.fingerprintId)
  selectedIds.value = next
}

function toggleSelectAll(val) {
  const next = new Set(selectedIds.value)
  for (const f of filteredFingerprints.value) {
    if (!f.fingerprintId) continue
    if (val) next.add(f.fingerprintId)
    else next.delete(f.fingerprintId)
  }
  selectedIds.value = next
}

function clearBatchSelection() {
  selectedIds.value = new Set()
}

async function handleBatchExport() {
  if (!selectedIds.value.size) return
  const ids = Array.from(selectedIds.value)
  await handleExportList(ids.map((fingerprintId) => ({ fingerprintId })))
  clearBatchSelection()
}

// 切换协议筛选时清空选中（避免选了不可见项后无法清理）
watch(activeProtocol, clearBatchSelection)

// ── 导入回调 ──────────────────────────────────────────────────────────────
async function handleImported() {
  await getFingerprints()
}

onMounted(() => {
  getFingerprints()
})
</script>

<style scoped>
@import '@/styles/workbench-directory-shared.css';

.fingerprint-manager {
  --workbench-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
}

.fingerprint-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.fingerprint-card-meta span + span {
  position: relative;
}

.fingerprint-card-meta span + span::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-text-color-secondary) 42%, transparent);
}

.list-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 2px 12px 12px;
}

.list-loading {
  padding: 8px 4px 20px;
}
</style>
