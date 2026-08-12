<template>
  <ManagerLayout
    title="伪装管理"
    :icon="iconMap.mask"
    module-class="disguise-manager"
    hide-toolbar
    :initial-list-width="320"
    :list-min="260"
    :list-max="480"
  >
    <template #list>
      <div class="list-header">
        <div class="list-title-group">
          <span class="list-kicker">Disguise Directory</span>
          <h2>伪装目录</h2>
        </div>

        <el-button
          v-if="isAdmin"
          type="primary"
          size="small"
          class="action-add"
          @click="openCreateDialog"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新增伪装
        </el-button>
      </div>

      <div class="scope-tabs">
        <button
          v-for="f in filterTabs"
          :key="f.value"
          type="button"
          class="scope-tab"
          :class="{ 'is-active': activeFilter === f.value }"
          @click="activeFilter = f.value"
        >
          {{ f.label }}
          <span>{{ f.count }}</span>
        </button>
      </div>

      <div class="toolbar-row">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索名称或 ID"
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
          content="导入伪装"
          placement="top"
        >
          <button
            class="u-icon-btn"
            type="button"
            aria-label="导入伪装"
            @click="importVisible = true"
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
            aria-label="刷新伪装列表"
            @click="refreshList"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <div class="result-row">
        <span>当前 {{ filteredDisguises.length }} / {{ disguises.length }} 条</span>
        <span>{{ builtinCount }} 内置 · {{ customCount }} 自定义</span>
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
          v-if="listLoading && !filteredDisguises.length"
          class="list-loading"
        >
          <el-skeleton
            :rows="8"
            animated
          />
        </div>

        <template v-else-if="filteredDisguises.length">
          <EntityCard
            v-for="item in filteredDisguises"
            :key="item.disguiseId"
            :title="item.disguiseName || item.disguiseId"
            :description="item.disguiseId"
            :icon="iconMap.codeFile"
            :active="item.disguiseId === selectedDisguiseId"
            selectable
            :selected="selectedIds.has(item.disguiseId)"
            :in-selection-mode="selectedIds.size > 0"
            @click="selectDisguise(item.disguiseId)"
            @toggle-selected="(val) => setSelected(item, val)"
          >
            <template #status>
              <el-tag
                size="small"
                :type="isBuiltIn(item.disguiseId) ? 'success' : 'primary'"
                effect="plain"
                class="workbench-type-tag"
              >
                {{ isBuiltIn(item.disguiseId) ? '内置' : '自定义' }}
              </el-tag>
            </template>
            <template #actions>
              <el-tooltip
                content="导出 .disguise"
                placement="left"
              >
                <button
                  type="button"
                  class="u-icon-btn"
                  :aria-label="`导出伪装 ${item.disguiseName || item.disguiseId}`"
                  @click.stop="handleQuickExport(item)"
                >
                  <el-icon><Icon :icon="iconMap.download" /></el-icon>
                </button>
              </el-tooltip>
              <el-tooltip
                v-if="isAdmin && !isBuiltIn(item.disguiseId)"
                content="删除"
                placement="left"
              >
                <button
                  type="button"
                  class="u-icon-btn u-icon-btn--danger"
                  :aria-label="`删除伪装 ${item.disguiseName || item.disguiseId}`"
                  @click.stop="handleDeleteDisguise(item)"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                </button>
              </el-tooltip>
            </template>
          </EntityCard>
        </template>

        <EmptyState
          v-else
          description="没有匹配的伪装"
          compact
        />
      </div>
    </template>

    <template #detail>
      <DisguiseDetail
        :disguise="selectedDisguise"
        :can-manage="isAdmin"
        :loading="detailLoading"
        :testing="testLoading"
        :deleting="deleteLoading"
        :exporting="detailExportLoading"
        @edit="openEditDialog"
        @test="handleTestFromDetail"
        @delete="handleDeleteDisguise"
        @export="handleDetailExport(selectedDisguise)"
      />
    </template>

    <DisguiseEditorDialog
      v-model="editorVisible"
      :mode="editorMode"
      :disguise="editorDisguise"
      :loading="saveLoading"
      @submit="handleSaveDisguise"
    />

    <ImportDisguiseDialog
      v-model="importVisible"
      @imported="handleImported"
    />
  </ManagerLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { handleError } from '@/utils/errorHandler.js'
import {
  addDisguiseApi,
  deleteDisguiseApi,
  getDisguiseDetailApi,
  getDisguisesApi,
  testDisguiseApi,
  updateDisguiseApi,
  exportDisguiseApi,
  exportDisguisesBatchApi
} from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import DisguiseDetail from './DisguiseDetail.vue'
import DisguiseEditorDialog from './DisguiseEditorDialog.vue'
import ImportDisguiseDialog from './ImportDisguiseDialog.vue'
import ManagerLayout from '@/components/common/ManagerLayout.vue'
import EntityCard from '@/components/common/EntityCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BatchActionBar from '@/components/common/BatchActionBar.vue'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { useAuth } from '@/composables/useAuth.js'

const iconMap = icons
const { isAdmin } = useAuth()

const disguises = ref([])
const searchKeyword = ref('')
const activeFilter = ref('all')
const selectedDisguiseId = ref('')
const selectedDisguise = ref(null)

const listLoading = ref(false)
const detailLoading = ref(false)
const saveLoading = ref(false)
const testLoading = ref(false)
const deleteLoading = ref(false)
const batchExportLoading = ref(false)
const batchDeleteLoading = ref(false)
const detailExportLoading = ref(false)

const editorVisible = ref(false)
const editorMode = ref('add')
const editorDisguise = ref(null)
const importVisible = ref(false)

// 批量选择
const selectedIds = ref(new Set())

const builtinCount = computed(
  () => disguises.value.filter((item) => isBuiltIn(item.disguiseId)).length
)
const customCount = computed(() => disguises.value.length - builtinCount.value)

const filterTabs = computed(() => [
  { label: '全部', value: 'all', count: disguises.value.length },
  { label: '自定义', value: 'custom', count: customCount.value },
  { label: '内置', value: 'builtin', count: builtinCount.value }
])

const filteredDisguises = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return disguises.value.filter((item) => {
    const matchKeyword =
      !keyword ||
      item.disguiseName?.toLowerCase().includes(keyword) ||
      item.disguiseId?.toLowerCase().includes(keyword)
    const matchType =
      activeFilter.value === 'all' ||
      (activeFilter.value === 'builtin' && isBuiltIn(item.disguiseId)) ||
      (activeFilter.value === 'custom' && !isBuiltIn(item.disguiseId))
    return matchKeyword && matchType
  })
})

const allFilteredSelected = computed(() => {
  if (!filteredDisguises.value.length) return false
  return filteredDisguises.value.every((d) => selectedIds.value.has(d.disguiseId))
})

const someFilteredSelected = computed(() => {
  if (!filteredDisguises.value.length) return false
  const hits = filteredDisguises.value.filter((d) => selectedIds.value.has(d.disguiseId)).length
  return hits > 0 && hits < filteredDisguises.value.length
})

function isBuiltIn(disguiseId) {
  return disguiseId?.startsWith('inner_')
}

function setSelected(item, val) {
  if (!item?.disguiseId) return
  const next = new Set(selectedIds.value)
  if (val) next.add(item.disguiseId)
  else next.delete(item.disguiseId)
  selectedIds.value = next
}

function toggleSelectAll(val) {
  const next = new Set(selectedIds.value)
  for (const d of filteredDisguises.value) {
    if (!d.disguiseId) continue
    if (val) next.add(d.disguiseId)
    else next.delete(d.disguiseId)
  }
  selectedIds.value = next
}

function clearBatchSelection() {
  selectedIds.value = new Set()
}

// 切换筛选时清空选中
watch(activeFilter, clearBatchSelection)

function openCreateDialog() {
  editorMode.value = 'add'
  editorDisguise.value = null
  editorVisible.value = true
}

async function refreshList(preferredId = selectedDisguiseId.value) {
  listLoading.value = true
  try {
    const response = await getDisguisesApi()
    disguises.value = (response.data || []).slice().sort((a, b) => {
      const aBuiltin = isBuiltIn(a.disguiseId)
      const bBuiltin = isBuiltIn(b.disguiseId)
      if (aBuiltin !== bBuiltin) return aBuiltin ? 1 : -1
      return (a.disguiseName || a.disguiseId).localeCompare(b.disguiseName || b.disguiseId)
    })
    const nextId = resolveSelectedId(preferredId)
    if (nextId) {
      await selectDisguise(nextId)
    } else {
      selectedDisguiseId.value = ''
      selectedDisguise.value = null
    }
  } catch (error) {
    handleError(error, { defaultMessage: '获取伪装列表失败' })
  } finally {
    listLoading.value = false
  }
}

function resolveSelectedId(preferredId) {
  if (preferredId && disguises.value.some((item) => item.disguiseId === preferredId)) {
    return preferredId
  }
  const firstVisible = filteredDisguises.value[0]?.disguiseId
  if (firstVisible) return firstVisible
  return disguises.value[0]?.disguiseId || ''
}

async function selectDisguise(disguiseId) {
  if (!disguiseId) {
    selectedDisguiseId.value = ''
    selectedDisguise.value = null
    return
  }
  selectedDisguiseId.value = disguiseId
  detailLoading.value = true
  try {
    const response = await getDisguiseDetailApi({ disguiseId })
    selectedDisguise.value = response.data
  } catch (error) {
    handleError(error, { defaultMessage: '获取伪装详情失败' })
    if (selectedDisguiseId.value === disguiseId) selectedDisguise.value = null
  } finally {
    detailLoading.value = false
  }
}

function openEditDialog(disguise) {
  editorMode.value = 'edit'
  editorDisguise.value = disguise || selectedDisguise.value
  editorVisible.value = true
}

async function handleSaveDisguise(payload) {
  saveLoading.value = true
  try {
    if (editorMode.value === 'add') {
      await addDisguiseApi(removeUndefinedFields(payload))
      showSuccess('伪装创建成功')
    } else {
      await updateDisguiseApi(removeUndefinedFields(payload))
      showSuccess('伪装更新成功')
    }
    editorVisible.value = false
    const preferredId =
      editorMode.value === 'edit' ? payload.disguiseId : inferCreatedDisguiseId(payload)
    await refreshList(preferredId)
  } catch (error) {
    handleError(error, {
      defaultMessage: editorMode.value === 'add' ? '创建伪装失败' : '更新伪装失败'
    })
  } finally {
    saveLoading.value = false
  }
}

function inferCreatedDisguiseId(payload) {
  if (payload.disguiseId) return payload.disguiseId
  const safeName =
    (payload.disguiseName || 'disguise')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'disguise'
  return `${safeName}_${payload.version || '1.0.0'}`
}

function removeUndefinedFields(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

async function handleTestDisguise(payload) {
  testLoading.value = true
  try {
    await testDisguiseApi(payload)
    showSuccess('测试通过：encode 和 decode 可以正确互逆')
  } catch (error) {
    handleError(error, { defaultMessage: '伪装逻辑测试失败' })
  } finally {
    testLoading.value = false
  }
}

async function handleTestFromDetail(disguise) {
  if (!disguise?.encodeBody || !disguise?.decodeBody) {
    showWarning('当前伪装缺少完整的 encodeBody 或 decodeBody')
    return
  }
  await handleTestDisguise({ encodeBody: disguise.encodeBody, decodeBody: disguise.decodeBody })
}

async function handleDeleteDisguise(disguise) {
  if (!disguise?.disguiseId) return
  if (isBuiltIn(disguise.disguiseId)) {
    showWarning('内置伪装不建议删除，接口在文件不存在时会直接返回 404')
    return
  }
  const confirmed = await confirmDelete({
    title: '删除确认',
    message: `确认删除伪装 ${disguise.disguiseName || disguise.disguiseId}？`
  })
  if (!confirmed) return
  deleteLoading.value = true
  try {
    await deleteDisguiseApi({ disguiseId: disguise.disguiseId })
    showSuccess('伪装删除成功')
    const nextCandidate =
      disguises.value.find((item) => item.disguiseId !== disguise.disguiseId)?.disguiseId || ''
    selectedDisguiseId.value = ''
    selectedDisguise.value = null
    await refreshList(nextCandidate)
  } catch (error) {
    handleError(error, { defaultMessage: '删除伪装失败' })
  } finally {
    deleteLoading.value = false
  }
}

async function handleBatchDelete() {
  if (!selectedIds.value.size) return
  const ids = Array.from(selectedIds.value)
  const customIds = ids.filter((id) => !isBuiltIn(id))
  const builtinCount = ids.length - customIds.length
  if (!customIds.length) {
    showWarning('选中的均为内置伪装，无法删除')
    return
  }
  const hint = builtinCount > 0 ? `（${builtinCount} 条内置伪装将被跳过）` : ''
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${customIds.length} 条自定义伪装？${hint}此操作不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  batchDeleteLoading.value = true
  try {
    await Promise.all(customIds.map((disguiseId) => deleteDisguiseApi({ disguiseId })))
    showSuccess(`已删除 ${customIds.length} 条伪装`)
    clearBatchSelection()
    await refreshList()
  } catch (e) {
    handleError(e, { defaultMessage: '批量删除失败' })
  } finally {
    batchDeleteLoading.value = false
  }
}

// ── 导出 ──────────────────────────────────────────────────────────────────

async function handleQuickExport(item) {
  if (!item?.disguiseId) return
  try {
    const res = await exportDisguiseApi(item.disguiseId)
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/octet-stream' })
    downloadBlob(blob, `${item.disguiseId}.disguise`)
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '导出失败')
  }
}

async function handleExportList(list) {
  const ids = (list || []).map((d) => d.disguiseId).filter(Boolean)
  if (!ids.length) return
  batchExportLoading.value = true
  try {
    const res = await exportDisguisesBatchApi({ disguiseIds: ids })
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/zip' })
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(blob, `disguises_${date}.zip`)
    showSuccess(`已导出 ${ids.length} 条伪装`)
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '导出失败')
  } finally {
    batchExportLoading.value = false
  }
}

async function handleDetailExport(disguise) {
  if (!disguise?.disguiseId) return
  detailExportLoading.value = true
  try {
    const res = await exportDisguiseApi(disguise.disguiseId)
    const blob = res?.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/octet-stream' })
    downloadBlob(blob, `${disguise.disguiseId}.disguise`)
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '导出失败')
  } finally {
    detailExportLoading.value = false
  }
}

async function handleBatchExport() {
  if (!selectedIds.value.size) return
  const ids = Array.from(selectedIds.value)
  await handleExportList(ids.map((disguiseId) => ({ disguiseId })))
  clearBatchSelection()
}

// ── 导入回调 ──────────────────────────────────────────────────────────────

async function handleImported() {
  await refreshList()
}

onMounted(() => {
  refreshList()
})
</script>

<style scoped>
@import '@/styles/workbench-directory-shared.css';

.disguise-manager {
  --workbench-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
}

.list-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-1) var(--space-3) var(--space-3);
}

.list-scroll :deep(.entity-card) {
  border-radius: var(--radius-control);
}

.list-scroll :deep(.workbench-type-tag) {
  border-radius: var(--radius-tag);
}

.list-loading {
  padding: 8px 4px 20px;
}
</style>
