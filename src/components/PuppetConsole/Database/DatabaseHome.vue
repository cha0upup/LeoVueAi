<template>
  <div class="database-home">
    <section class="configs-workbench">
      <div class="workbench-toolbar">
        <div class="toolbar-search">
          <el-input
            v-model="searchText"
            clearable
            placeholder="搜索连接名称、URL、用户名"
            size="default"
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.search" /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-filters">
          <el-button
            type="primary"
            size="small"
            @click="openAddDialog"
          >
            <el-icon><Icon :icon="iconMap.plus" /></el-icon>
            新增配置
          </el-button>
          <el-button
            size="small"
            :loading="savedLoading"
            @click="loadSavedConfigs"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            刷新列表
          </el-button>
          <el-radio-group
            v-model="statusFilter"
            size="small"
          >
            <el-radio-button value="all">
              全部
            </el-radio-button>
            <el-radio-button value="enabled">
              启用
            </el-radio-button>
            <el-radio-button value="disabled">
              禁用
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div
        v-if="filteredConfigs.length === 0 && !savedLoading"
        class="empty-state"
      >
        <div class="empty-copy">
          <div class="empty-icon-shell">
            <el-icon>
              <Icon :icon="savedConfigs.length === 0 ? iconMap.database : iconMap.search" />
            </el-icon>
          </div>
          <strong>{{
            savedConfigs.length === 0 ? '还没有数据库配置' : '没有匹配的连接配置'
          }}</strong>
          <span>{{
            savedConfigs.length === 0
              ? '先添加一个连接，直接进入工作台开始操作。'
              : '调整关键词或筛选条件后重试。'
          }}</span>
          <el-button
            type="primary"
            @click="openAddDialog"
          >
            {{ savedConfigs.length === 0 ? '立即添加' : '新增配置' }}
          </el-button>
        </div>
      </div>

      <div
        v-else
        v-loading="savedLoading"
        class="configs-list"
      >
        <article
          v-for="row in filteredConfigs"
          :key="row.connectionId || getDatabaseConnectionName(row)"
          class="config-card"
        >
          <button
            type="button"
            class="config-main"
            :class="{ 'is-disabled': !isStatusEnabled(row.status) }"
            :disabled="!isStatusEnabled(row.status)"
            @click="connectToDatabase(row)"
          >
            <span class="config-icon-shell">
              <el-icon class="conn-icon">
                <Icon :icon="iconMap.database" />
              </el-icon>
            </span>
            <div class="conn-main">
              <div class="config-title-row">
                <span class="conn-title">{{ getDatabaseConnectionName(row) }}</span>
                <div class="config-tags">
                  <el-tag
                    :type="getDialectTagType(getDatabaseDialect(row))"
                    size="small"
                  >
                    {{ sqlEngine.getDialectName(getDatabaseDialect(row)) }}
                  </el-tag>
                  <el-tag
                    :type="isStatusEnabled(row.status) ? 'success' : 'info'"
                    size="small"
                  >
                    {{ isStatusEnabled(row.status) ? '启用' : '禁用' }}
                  </el-tag>
                  <el-tooltip
                    :content="getTestStatusTooltip(row)"
                    placement="top"
                  >
                    <el-tag
                      :type="getDatabaseTestStatus(row.testStatus).type"
                      size="small"
                    >
                      {{ getDatabaseTestStatus(row.testStatus).label }}
                    </el-tag>
                  </el-tooltip>
                </div>
              </div>
              <span class="url-text">{{ getDatabaseConnectionTarget(row) }}</span>
              <div class="config-meta">
                <span class="config-meta-item">
                  <el-icon><Icon :icon="iconMap.user" /></el-icon>
                  {{ getUsername(row) || '-' }}
                </span>
                <span class="config-meta-item">
                  <el-icon><Icon :icon="iconMap.connection" /></el-icon>
                  {{ getDriverClass(row) || '默认驱动' }}
                </span>
                <span
                  v-if="row.lastTestTime"
                  class="config-meta-item"
                >
                  <el-icon><Icon icon="mdi:clock-check-outline" /></el-icon>
                  {{ formatDate(row.lastTestTime) }}
                </span>
              </div>
            </div>
          </button>

          <div class="config-actions">
            <el-button
              type="primary"
              size="small"
              class="enter-workbench-btn"
              :disabled="!isStatusEnabled(row.status)"
              @click="connectToDatabase(row)"
            >
              <el-icon><Icon :icon="iconMap.connection" /></el-icon>
              进入工作台
            </el-button>
            <div class="config-action-cluster">
              <el-tooltip
                :content="isStatusEnabled(row.status) ? '停用连接' : '启用连接'"
                placement="top"
              >
                <el-button
                  circle
                  size="small"
                  :type="isStatusEnabled(row.status) ? 'warning' : 'success'"
                  plain
                  :loading="updatingStatusId === row.connectionId"
                  :aria-label="`${isStatusEnabled(row.status) ? '停用' : '启用'}连接 ${row.connectionName || row.connectionId}`"
                  @click="toggleConnectionStatus(row)"
                >
                  <el-icon>
                    <Icon
                      :icon="
                        isStatusEnabled(row.status)
                          ? 'mdi:pause-circle-outline'
                          : 'mdi:play-circle-outline'
                      "
                    />
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                content="测试连接"
                placement="top"
              >
                <el-button
                  circle
                  size="small"
                  type="success"
                  plain
                  :disabled="!isStatusEnabled(row.status)"
                  :loading="testingConnectionId === row.connectionId"
                  :aria-label="`测试连接 ${row.connectionName || row.connectionId}`"
                  @click="testSavedConnection(row)"
                >
                  <el-icon><Icon icon="mdi:database-check-outline" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                content="编辑配置"
                placement="top"
              >
                <el-button
                  circle
                  size="small"
                  type="primary"
                  plain
                  :aria-label="`编辑连接 ${row.connectionName || row.connectionId}`"
                  @click="editConfig(row)"
                >
                  <el-icon><Icon :icon="iconMap.edit" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                content="删除配置"
                placement="top"
              >
                <el-button
                  circle
                  size="small"
                  type="danger"
                  plain
                  :aria-label="`删除连接 ${row.connectionName || row.connectionId}`"
                  @click="deleteConfig(row)"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- 新增配置弹窗 -->
    <AddDatabaseConfigDialog
      v-model:visible="addDialogVisible"
      :session-id="sessionId"
      @success="handleConfigSuccess"
      @cancel="handleAddDialogCancel"
    />

    <!-- 编辑配置弹窗 -->
    <EditDatabaseConfigDialog
      v-model:visible="editDialogVisible"
      :session-id="sessionId"
      :editing-config="editingConfig"
      @success="handleConfigSuccess"
      @cancel="handleEditDialogCancel"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { v4 as uuidV4 } from 'uuid'
import { icons } from '@/utils/icons.js'
import AddDatabaseConfigDialog from '@/components/PuppetConsole/Database/AddDatabaseConfigDialog.vue'
import EditDatabaseConfigDialog from '@/components/PuppetConsole/Database/EditDatabaseConfigDialog.vue'
import {
  getDatabaseConnectionsApi,
  deleteDatabaseConnectionApi,
  updateDatabaseConnectionStatusApi
} from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { formatDate } from '@/utils/format.js'
import sqlEngine from './SqlEngine.js'
import {
  DATABASE_MESSAGES,
  getDatabaseConnectionName,
  getDatabaseTestStatus,
  getDatabaseDialect,
  getDatabaseConnectionTarget,
  getUsername,
  getDriverClass,
  getDialectTagType,
  isStatusEnabled
} from '@/utils/database.js'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['addDataTab'])

const savedConfigs = ref([])
const savedLoading = ref(false)
const testingConnectionId = ref('')
const updatingStatusId = ref('')
const addDialogVisible = ref(false)
const editDialogVisible = ref(false)
const editingConfig = ref(null)
const searchText = ref('')
const statusFilter = ref('all')

const filteredConfigs = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()

  return savedConfigs.value.filter((item) => {
    const matchedStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'enabled' && isStatusEnabled(item.status)) ||
      (statusFilter.value === 'disabled' && !isStatusEnabled(item.status))

    if (!matchedStatus) {
      return false
    }

    if (!keyword) {
      return true
    }

    const content = [
      getDatabaseConnectionName(item),
      getDatabaseConnectionTarget(item),
      getUsername(item),
      sqlEngine.getDialectName(getDatabaseDialect(item))
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return content.includes(keyword)
  })
})

const loadSavedConfigs = async () => {
  if (!props.sessionId) {
    showWarning('缺少会话ID，无法加载配置')
    return
  }

  savedLoading.value = true
  try {
    const resp = await getDatabaseConnectionsApi({
      sessionId: props.sessionId
    })

    savedConfigs.value = resp.data || []
  } catch {
    showError('加载配置列表失败')
    savedConfigs.value = []
  } finally {
    savedLoading.value = false
  }
}

const openAddDialog = () => {
  addDialogVisible.value = true
}

const handleConfigSuccess = async () => {
  await loadSavedConfigs()
}

const handleAddDialogCancel = () => {
  addDialogVisible.value = false
}

const handleEditDialogCancel = () => {
  editDialogVisible.value = false
  editingConfig.value = null
}

const connectToDatabase = (row) => {
  if (!row) return
  if (!isStatusEnabled(row.status)) {
    showWarning('该数据库连接已停用，请先启用')
    return
  }

  const savedConnection = row.connection

  const payload = {
    connectionId: row.connectionId || uuidV4(),
    connectionName: getDatabaseConnectionName(row),
    url: getDatabaseConnectionTarget(row),
    connection: {
      ...savedConnection,
      connectionId: row.connectionId || ''
    }
  }

  emit('addDataTab', payload)
}

const editConfig = (row) => {
  if (!row) return
  editingConfig.value = row
  editDialogVisible.value = true
}

const getTestStatusTooltip = (row) => {
  const status = getDatabaseTestStatus(row?.testStatus)
  const details = [status.label]
  if (row?.lastTestTime) details.push(formatDate(row.lastTestTime))
  if (row?.lastTestMessage) details.push(row.lastTestMessage)
  return details.join(' · ')
}

const testSavedConnection = async (row) => {
  if (!row?.connectionId || !isStatusEnabled(row.status) || testingConnectionId.value) return
  testingConnectionId.value = row.connectionId
  try {
    await sqlEngine.testConnection({
      sessionId: props.sessionId,
      connection: { connectionId: row.connectionId }
    })
    showSuccess('数据库连接测试成功')
  } catch (error) {
    const message = error?.response?.data?.msg || error?.message || '数据库连接测试失败'
    showError(message)
  } finally {
    testingConnectionId.value = ''
    await loadSavedConfigs()
  }
}

const toggleConnectionStatus = async (row) => {
  if (!row?.connectionId || updatingStatusId.value) return
  const enabled = !isStatusEnabled(row.status)
  updatingStatusId.value = row.connectionId
  try {
    await updateDatabaseConnectionStatusApi({
      sessionId: props.sessionId,
      connectionId: row.connectionId,
      enabled
    })
    showSuccess(enabled ? '数据库连接已启用' : '数据库连接已停用')
    await loadSavedConfigs()
  } catch (error) {
    const message = error?.response?.data?.msg || error?.message || '更新连接状态失败'
    showError(message)
  } finally {
    updatingStatusId.value = ''
  }
}

const deleteConfig = async (row) => {
  if (!row || !row.connectionId) {
    showWarning('无法删除：缺少配置ID')
    return
  }
  const confirmed = await confirmDelete({
    message: `确定要删除配置 "${getDatabaseConnectionName(row)}" 吗？此操作不可恢复。`
  })
  if (!confirmed) return

  try {
    await deleteDatabaseConnectionApi({
      sessionId: props.sessionId,
      connectionId: row.connectionId
    })

    showSuccess(DATABASE_MESSAGES.DELETE_SUCCESS)
    await loadSavedConfigs()
  } catch (error) {
    const errorMsg =
      error?.response?.data?.msg ||
      error?.message ||
      DATABASE_MESSAGES.DELETE_FAILED
    showError(`${DATABASE_MESSAGES.DELETE_FAILED}: ${errorMsg}`)
  }
}

onMounted(async () => {
  try {
    await sqlEngine.refreshDialectCatalog()
  } catch {
    sqlEngine.clearDialectCatalog()
  }
  await loadSavedConfigs()
})

</script>

<style scoped>
.database-home {
  --database-home-panel-surface: var(--app-card-background);
  --database-home-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 64%,
    transparent
  );
  --database-home-soft-border: color-mix(in srgb, var(--el-border-color) 18%, transparent);
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  padding: 8px 10px 10px;
  background: transparent;
  overflow: hidden;
}

:global(html:not(.dark) .database-home),
:global(html[data-theme='light'] .database-home) {
  --database-home-panel-surface: var(--app-card-background);
  --database-home-muted-surface: var(--app-control-background-soft);
  --database-home-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

.configs-workbench {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border-radius: 0;
  border: 1px solid var(--database-home-soft-border);
  background: color-mix(in srgb, var(--database-home-panel-surface) 82%, transparent);
  overflow: hidden;
}

.workbench-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--app-control-background-soft);
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-search {
  flex: 1;
  min-width: 16rem;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.configs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  min-height: 0;
  overflow-y: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(14rem, 34vh);
  margin: 10px;
  background: transparent;
  border-radius: 12px;
  border: 1px dashed color-mix(in srgb, var(--el-border-color) 34%, transparent);
}

.empty-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.empty-copy strong {
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.empty-icon-shell {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  font-size: 24px;
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  color: var(--el-color-primary);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  margin-bottom: 4px;
}

.empty-copy span {
  max-width: 320px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.config-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px 10px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--database-home-soft-border);
  background: var(--database-home-panel-surface);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.config-card:hover {
  border-color: var(--database-home-soft-border);
  background: color-mix(in srgb, var(--el-color-primary) 3%, var(--database-home-panel-surface));
  box-shadow: none;
}

.config-main {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-base);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.config-main:hover .conn-title,
.config-main:hover .url-text {
  color: var(--el-text-color-primary);
}

.config-main:hover .config-icon-shell {
  border-color: var(--database-home-soft-border);
  background: var(--app-control-background-hover);
}

.config-main.is-disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.config-main.is-disabled:hover .conn-title,
.config-main.is-disabled:hover .url-text {
  color: inherit;
}

.config-icon-shell {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--database-home-soft-border);
  background: var(--database-home-muted-surface);
  flex-shrink: 0;
  transition: all var(--el-transition-duration) var(--el-transition-function);
}

.conn-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
}

.config-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  min-width: 0;
}

.config-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.conn-icon {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
  transition: all var(--el-transition-duration) var(--el-transition-function);
}

.conn-title {
  min-width: 0;
  font-weight: 700;
  font-size: 13px;
  color: var(--el-text-color-primary);
  transition: color var(--el-transition-duration) var(--el-transition-function);
}

.url-text {
  font-family: var(--el-font-family-mono);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
  transition: color var(--el-transition-duration) var(--el-transition-function);
}

.config-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  min-width: 0;
}

.config-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.config-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.enter-workbench-btn {
  min-width: 108px;
  height: 28px;
  border-radius: 6px;
  box-shadow: none;
}

.config-action-cluster {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border-radius: 0;
  border: 0;
  background: transparent;
}

.config-action-cluster :deep(.el-button) {
  margin: 0;
  width: 28px;
  height: 28px;
  border-radius: 5px;
}

.configs-workbench :deep(.el-tag) {
  --el-tag-bg-color: var(--database-home-muted-surface);
  --el-tag-border-color: transparent;
  --el-tag-text-color: var(--el-text-color-regular);
  border-color: transparent;
  font-weight: 600;
}

.config-action-cluster :deep(.el-button--danger.is-plain) {
  color: var(--el-color-danger);
  border-color: transparent;
  background: var(--database-home-muted-surface);
}

@media (max-width: 960px) {
  .config-card {
    grid-template-columns: 1fr;
  }

  .config-actions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 640px) {
  .database-home {
    padding: 0 10px 10px;
  }

  .workbench-toolbar {
    padding: 10px;
  }

  .configs-list {
    padding: 10px;
  }

  .config-title-row,
  .config-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .enter-workbench-btn {
    width: 100%;
  }
}
</style>
