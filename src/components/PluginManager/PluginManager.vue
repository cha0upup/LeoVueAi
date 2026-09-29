<template>
  <ManagerLayout
    title="插件管理"
    :icon="iconMap.plugin"
    module-class="plugin-manager"
    hide-toolbar
    :initial-list-width="320"
    :list-min="260"
    :list-max="480"
  >
    <template #list>
      <div class="list-header">
        <div class="list-title-group">
          <span class="list-kicker">Plugin Directory</span>
          <h2>插件目录</h2>
        </div>

        <el-button
          v-if="isAdmin"
          type="primary"
          size="small"
          class="action-add"
          @click="dialogs.add.open()"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新增插件
        </el-button>
      </div>

      <div class="scope-tabs">
        <button
          v-for="t in typeTabs"
          :key="t.value"
          type="button"
          class="scope-tab"
          :class="{ 'is-active': activeType === t.value }"
          @click="activeType = t.value"
        >
          {{ t.label }}
          <span>{{ t.count }}</span>
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
          content="导入插件"
          placement="top"
        >
          <button
            class="u-icon-btn"
            type="button"
            aria-label="导入插件"
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
            aria-label="刷新插件列表"
            @click="getPlugins"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          </button>
        </el-tooltip>
      </div>

      <div class="result-row">
        <span>当前 {{ filteredPlugins.length }} / {{ plugins.length }} 个</span>
        <span>{{ typeCounts.java }} Java · {{ typeCounts.javaScript }} JS · {{ typeCounts.shellCode }} Shell</span>
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
          v-if="listLoading && !filteredPlugins.length"
          class="list-loading"
        >
          <el-skeleton
            :rows="8"
            animated
          />
        </div>

        <template v-else-if="filteredPlugins.length">
          <EntityCard
            v-for="item in filteredPlugins"
            :key="item.pluginId"
            :title="item.pluginName || item.pluginId"
            :description="item.pluginId"
            :icon="iconMap.plugin"
            :active="item.pluginId === selectedPluginId"
            selectable
            :selected="selectedIds.has(item.pluginId)"
            :in-selection-mode="selectedIds.size > 0"
            @click="selectedPlugin = item"
            @toggle-selected="(val) => setSelected(item, val)"
          >
            <template #status>
              <el-tag
                size="small"
                :type="typeTagType(item.pluginType)"
                effect="plain"
                class="workbench-type-tag"
              >
                {{ typeLabel(item.pluginType) }}
              </el-tag>
            </template>
            <template #extra>
              <div class="plugin-card-meta">
                <span>v{{ item.version || '-' }}</span>
                <span>{{ item.paramsDemo ? '有参数' : '无参数' }}</span>
              </div>
            </template>
            <template #actions>
              <el-tooltip
                content="导出 .plugin"
                placement="left"
              >
                <button
                  type="button"
                  class="u-icon-btn"
                  :aria-label="`导出插件 ${item.pluginName || item.pluginId}`"
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
                  :aria-label="`删除插件 ${item.pluginName || item.pluginId}`"
                  @click.stop="handleDeletePlugin(item)"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                </button>
              </el-tooltip>
            </template>
          </EntityCard>
        </template>

        <EmptyState
          v-else
          description="没有匹配的插件"
          compact
        />
      </div>
    </template>

    <template #detail>
      <PluginDetail
        :plugin="selectedPlugin"
        :can-manage="isAdmin"
        :loading="listLoading"
        :deleting="deleteLoading"
        :exporting="detailExportLoading"
        @edit="openEditDialog"
        @delete="handleDeletePlugin"
        @export="handleDetailExport(selectedPlugin)"
      />
    </template>

    <AddPluginDialog
      v-model="showAddPluginDialog"
      :plugin-types="pluginTypes"
      @submit="handleAddPlugin"
    />

    <EditPluginDialog
      v-model="showEditPluginDialog"
      :plugin="currentEditPlugin"
      :plugin-types="pluginTypes"
      :loading="updateLoading"
      @submit="handleUpdatePlugin"
    />

    <ImportPluginDialog
      v-model="showImportDialog"
      @imported="handleImported"
    />
  </ManagerLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { executeBatchDelete, executeDeleteWithConfirm } from '@/utils/confirmUtils.js'
import { useDialogs, useEditDialog } from '@/utils/dialogUtils.js'
import { buildUpdateParams, findUpdatedPlugin, PLUGIN_TYPES } from '@/utils/plugin.js'
import {
  deletePluginApi,
  addPluginApi,
  updatePluginApi,
  getPluginsApi,
  exportPluginApi,
  exportPluginsBatchApi
} from '@/services/api.js'
import AddPluginDialog from './AddPluginDialog.vue'
import EditPluginDialog from './EditPluginDialog.vue'
import PluginDetail from './PluginDetail.vue'
import ImportPluginDialog from './ImportPluginDialog.vue'
import ManagerLayout from '@/components/common/ManagerLayout.vue'
import EntityCard from '@/components/common/EntityCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BatchActionBar from '@/components/common/BatchActionBar.vue'
import { executeBlobDownload } from '@/utils/exportUtils.js'
import { useAuth } from '@/composables/useAuth.js'
import { useBatchSelection } from '@/composables/useBatchSelection.js'

const { isAdmin } = useAuth()

const plugins = ref([])
const selectedPlugin = ref(null)
const selectedPluginId = computed(() => selectedPlugin.value?.pluginId || '')
const searchKeyword = ref('')
const activeType = ref('all')

const dialogs = useDialogs(['add'])
const editDialog = useEditDialog()
const showAddPluginDialog = dialogs.add.visible
const showEditPluginDialog = editDialog.visible
const showImportDialog = ref(false)
const currentEditPlugin = editDialog.currentItem

const listLoading = ref(false)
const updateLoading = ref(false)
const deleteLoading = ref(false)
const batchExportLoading = ref(false)
const batchDeleteLoading = ref(false)
const detailExportLoading = ref(false)

const pluginTypes = PLUGIN_TYPES
const iconMap = icons

const typeCounts = computed(() => Object.fromEntries(
  pluginTypes.map(({ value }) => [value, plugins.value.filter(item => item.pluginType === value).length])
))

const typeTabs = computed(() => [
  { label: '全部', value: 'all', count: plugins.value.length },
  ...pluginTypes.map(({ value }) => ({ label: typeLabel(value), value, count: typeCounts.value[value] }))
])

function typeLabel(type) {
  return {
    java: 'Java',
    php: 'PHP',
    javaScript: 'JS',
    shellCode: 'Shell'
  }[type] || type || '未知'
}

function typeTagType(type) {
  return {
    java: 'success',
    php: 'primary',
    javaScript: 'warning',
    shellCode: 'info'
  }[type] || 'info'
}

const filteredPlugins = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return plugins.value.filter((item) => {
    const matchKeyword =
      !keyword ||
      item.pluginName?.toLowerCase().includes(keyword) ||
      item.pluginId?.toLowerCase().includes(keyword)

    const matchType = activeType.value === 'all' || item.pluginType === activeType.value
    return matchKeyword && matchType
  })
})

const {
  selectedIds,
  allFilteredSelected,
  someFilteredSelected,
  setSelected,
  toggleSelectAll,
  clearBatchSelection
} = useBatchSelection(filteredPlugins, item => item?.pluginId)

// 切换类型筛选时清空选中
watch(activeType, clearBatchSelection)

const handleDeletePlugin = async (plugin) => {
  if (!plugin?.pluginId) return
  await executeDeleteWithConfirm(() => deletePluginApi({ pluginId: plugin.pluginId }), {
    loadingRef: deleteLoading,
    successMessage: '删除插件成功',
    errorMessage: '删除插件失败',
    onSuccess: () => {
      setSelected(plugin, false)
      return getPlugins()
    }
  })
}

const handleAddPlugin = async (pluginData) => {
  const payload = pluginData.pluginType === 'java'
    ? pluginData
    : { ...pluginData, scriptContent: pluginData.bytecode, bytecode: undefined }
  await executeRequest(() => addPluginApi(payload), {
    successMessage: '插件添加成功',
    errorMessage: '添加插件失败，请重试',
    onSuccess: () => {
      dialogs.add.close()
      getPlugins()
    }
  })
}

const getPlugins = async () => {
  await executeRequest(
    async () => {
      const response = await getPluginsApi()
      plugins.value = (response.data || [])
        .slice()
        .sort((a, b) => (a.pluginName || a.pluginId).localeCompare(b.pluginName || b.pluginId))

      selectedPlugin.value =
        plugins.value.find((item) => item.pluginId === selectedPluginId.value) ||
        plugins.value[0] ||
        null
      return response
    },
    {
      loadingRef: listLoading,
      successMessage: null,
      errorMessage: '获取插件列表失败，请重试'
    }
  )
}

const openEditDialog = (plugin) => {
  editDialog.open(plugin)
}

const handleUpdatePlugin = async (pluginData) => {
  await executeRequest(
    () => {
      const updateParams = buildUpdateParams(pluginData)
      return updatePluginApi(updateParams)
    },
    {
      loadingRef: updateLoading,
      successMessage: '插件更新成功',
      errorMessages: {
        400: '字节码验证失败',
        404: '插件不存在',
        500: '保存失败',
        default: '更新插件失败，请重试'
      },
      onSuccess: async (response) => {
        editDialog.close()
        await getPlugins()

        const updatedPlugin = findUpdatedPlugin(plugins.value, response, pluginData.pluginId)
        if (updatedPlugin) {
          selectedPlugin.value = updatedPlugin
        }
      }
    }
  )
}

async function handleBatchDelete() {
  if (!selectedIds.value.size) return
  const ids = Array.from(selectedIds.value)
  await executeBatchDelete(ids, async (pluginId) => {
    await deletePluginApi({ pluginId })
    selectedIds.value.delete(pluginId)
  }, {
    itemName: '插件',
    confirmMessage: `确认删除选中的 ${ids.length} 个插件？此操作不可恢复。`,
    loadingRef: batchDeleteLoading,
    onSuccess: getPlugins
  }).catch(() => {}) // 删除和刷新函数已显示错误提示。
}

// ── 导出 ──────────────────────────────────────────────────────────────────

function handleQuickExport(item, loadingRef) {
  if (!item?.pluginId) return
  return executeBlobDownload(() => exportPluginApi(item.pluginId), item.pluginId, {
    loadingRef
  }).catch(() => false)
}

const handleDetailExport = (plugin) => handleQuickExport(plugin, detailExportLoading)

async function handleBatchExport() {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) return
  const date = new Date().toISOString().slice(0, 10)
  await executeBlobDownload(
    () => exportPluginsBatchApi({ pluginIds: ids }),
    `plugins_${date}.zip`,
    {
      loadingRef: batchExportLoading,
      successMessage: `已导出 ${ids.length} 个插件`,
      onSuccess: () => {
        for (const id of ids) selectedIds.value.delete(id)
      }
    }
  ).catch(() => false)
}

// ── 导入回调 ──────────────────────────────────────────────────────────────

async function handleImported() {
  await getPlugins()
}

onMounted(() => {
  getPlugins()
})
</script>

<style scoped>
@import '@/styles/workbench-directory-shared.css';

.plugin-manager {
  --workbench-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
}

.plugin-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.plugin-card-meta span + span {
  position: relative;
}

.plugin-card-meta span + span::before {
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
