<template>
  <ManagerLayout
    title="主机资产"
    :icon="iconMap.server"
    module-class="agent-manager"
    hide-toolbar
    :initial-list-width="380"
    :list-min="320"
    :list-max="540"
  >
    <template #list>
      <div class="list-header">
        <div class="list-title-group">
          <span class="list-kicker">Host Directory</span>
          <div class="list-title-line">
            <h2>主机与会话</h2>
            <span class="directory-summary">
              <span
                ><strong>{{ totalCount }}</strong> 主机</span
              >
              <i />
              <span :class="{ 'has-live': liveSessions.length }">
                <strong>{{ liveSessions.length }}</strong> 会话
              </span>
            </span>
          </div>
        </div>

        <el-dropdown
          split-button
          type="primary"
          size="small"
          class="action-add"
          :disabled="!isCurrentWorkspaceWritable"
          @click="openAddAgentDialog"
          @command="handleCreateCommand"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新增主机
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="import">
                <el-icon><Icon :icon="iconMap.upload" /></el-icon>
                导入主机配置
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <ProjectSwitcher
        :model-value="selectedProjectId"
        :projects="projects"
        :active-project="activeProject"
        :loading="projectsLoading"
        @update:model-value="handleProjectChange"
        @create="projectEditor?.open()"
        @edit="projectEditor?.open($event)"
      />

      <div v-if="activeProject?.status === 'archived'" class="project-context-notice">
        <el-icon><Icon icon="mdi:archive-outline" /></el-icon>
        <span>归档项目保留主机与会话视图，不再创建新归属或新会话。</span>
        <button
          v-if="activeProject.manageable"
          type="button"
          @click="projectEditor?.open(activeProject)"
        >
          恢复
        </button>
      </div>

      <div class="filter-row">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索主机名、地址、会话 ID"
          class="search-input"
          clearable
          size="small"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>

        <el-select v-model="sortMode" class="sort-select" size="small" aria-label="排序方式">
          <el-option label="按更新时间" value="updateTime" />
          <el-option label="按名称" value="name" />
        </el-select>

        <el-tooltip content="刷新列表" placement="top">
          <button
            class="u-icon-btn"
            type="button"
            aria-label="刷新主机列表"
            :disabled="loading || sessionsLoading"
            @click="refresh"
          >
            <el-icon :class="{ 'u-spin': loading || sessionsLoading }">
              <Icon :icon="iconMap.refresh" />
            </el-icon>
          </button>
        </el-tooltip>

        <button
          class="batch-toggle-btn"
          :class="{ active: batchMode }"
          type="button"
          @click="toggleBatchMode"
        >
          <el-icon><Icon :icon="checkIcon" /></el-icon>
          批量
        </button>
      </div>

      <div class="table-panel">
        <AgentTable
          ref="agentTable"
          :agents="filteredAgents"
          :loading="loading"
          :table-key="tableKey"
          :load-children="loadChildren"
          :keyword="searchKeyword"
          :current-agent-id="currentAgent?.agentId || ''"
          :connection-results="connectionTestResults"
          :testing-agent-ids="testingAgentIds"
          :batch-mode="batchMode"
          :sessions-by-agent-id="sessionsByAgentId"
          :project-memberships="projectMemberships"
          :empty-title="emptyDirectoryCopy.title"
          :empty-description="emptyDirectoryCopy.description"
          @enter-console="openAgentConsole"
          @row-click="handleRowClick"
          @selection-change="handleAgentSelectionChange"
        />
      </div>

      <Transition name="batch-bar">
        <div v-if="batchMode" class="batch-action-bar">
          <span class="batch-bar-count">已选 {{ selectedCount }} 台</span>
          <div class="batch-bar-actions">
            <el-tooltip content="批量测试连接" placement="top">
              <button
                class="bar-btn"
                type="button"
                :disabled="batchTestLoading || selectedCount === 0"
                @click="batchTestConnections"
              >
                <el-icon><Icon :icon="iconMap.test" /></el-icon>
                <span>测试</span>
              </button>
            </el-tooltip>
            <button
              class="bar-btn bar-btn--primary"
              type="button"
              :disabled="selectedCount === 0 || !assignableProjects.length"
              @click="openProjectAssignment"
            >
              <el-icon><Icon :icon="iconMap.folderAdd" /></el-icon>
              加入项目
            </button>
            <el-dropdown trigger="click" placement="top-end" @command="handleBatchCommand">
              <button class="bar-btn bar-btn--icon" type="button" aria-label="更多批量操作">
                <el-icon><Icon :icon="iconMap.more" /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="toggle-all">
                    <el-icon><Icon :icon="allSelected ? iconMap.cancel : checkIcon" /></el-icon>
                    {{ allSelected ? '取消全选' : '选择当前列表' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="export" :disabled="batchExportLoading">
                    <el-icon><Icon :icon="iconMap.download" /></el-icon>导出选中主机
                  </el-dropdown-item>
                  <el-dropdown-item v-if="activeProject?.contentEditable" command="detach" divided>
                    <el-icon><Icon :icon="iconMap.close" /></el-icon>从当前项目移出
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided class="batch-danger-item">
                    <el-icon><Icon :icon="iconMap.delete" /></el-icon>删除主机资产
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <button
              class="bar-btn bar-btn--muted"
              type="button"
              aria-label="退出批量操作"
              @click="toggleBatchMode"
            >
              <el-icon><Icon :icon="iconMap.cancel" /></el-icon>
            </button>
          </div>
        </div>
      </Transition>
    </template>

    <template #detail>
      <AgentDetailPanel
        :agent="currentAgent"
        :total-count="totalCount"
        :connection-test-loading="connectionTestLoading"
        :is-current-agent-testing="isCurrentAgentTesting"
        :batch-test-loading="batchTestLoading"
        :test-conn-result="testConnResult"
        :cache-check-result="cacheCheckResult"
        :cache-check-loading="cacheCheckLoading"
        :cache-availability="currentCacheAvailability"
        :cache-availability-loading="cacheAvailabilityLoading"
        :quick-saving-key="quickSavingKey"
        :sessions="currentAgentSessions"
        :active-session-id="activeSessionId"
        :deleting-session-ids="deletingSessionIds"
        :can-create-hosts="isCurrentWorkspaceWritable"
        :can-create-session="activeProject?.status !== 'archived'"
        :empty-title="emptyDirectoryCopy.title"
        :empty-description="emptyDirectoryCopy.description"
        @enter-console="openAgentConsole"
        @new-session="createNewSession"
        @enter-cache="enterCacheForAgent"
        @refresh-cache-availability="loadCacheAvailability"
        @test-conn="doTestConn"
        @edit="openEditAgentDialog"
        @share="openShareAgentDialog"
        @add-child-agent="openAddChildAgent"
        @delete="deleteAgent"
        @toggle-quick-config="toggleQuickConfig"
        @enter-cache-mode="enterCacheMode"
        @add="openAddAgentDialog"
        @import="openImportAgentDialog"
        @dismiss-test-result="testConnResult = null"
        @dismiss-cache-result="cacheCheckResult = null"
        @select-session="selectSession"
        @open-session="openExistingSession"
        @delete-session="deleteLiveSession"
      />
    </template>

    <AddAgent ref="addAgent" :project-id="activeProjectId" @refresh="refresh" />
    <ImportAgent ref="importAgent" :project-id="activeProjectId" @refresh="refresh" />
    <EditAgent ref="editAgent" @refresh="refresh" />
    <ShareAgent ref="shareAgent" />
    <AddChildAgent ref="addChildAgent" />
    <ProjectEditorDialog ref="projectEditor" @saved="handleProjectSaved" />
    <ProjectAssignmentDialog
      ref="projectAssignment"
      :projects="projects"
      :current-project-id="activeProjectId"
      @saved="handleProjectAssignmentSaved"
    />
    <SessionPickerDialog
      ref="sessionPicker"
      :projects="projects"
      @open-session="openExistingSession"
      @create-session="createNewSession"
    />
    <HostSelectionDialog ref="hostSelectionDialog" />
  </ManagerLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { executeDeleteWithConfirm, executeBatchDelete } from '@/utils/confirmUtils.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { createLogger } from '@/utils/logger.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import {
  getAgentsApi,
  deleteAgentApi,
  updateAgentApi,
  exportAgentsApi
} from '@/services/api/agent-manage.js'
import {
  initAgentApi,
  checkAgentCacheApi,
  initAgentCacheApi,
  testAgentConnectionApi
} from '@/services/api/agent-node.js'
import { deleteSessionApi, getSessionsApi } from '@/services/api/sessions.js'
import {
  getProjectAgentsApi,
  getWorkspaceAgentChildrenApi,
  getUnassignedAgentsApi,
  detachProjectAgentsApi,
  getAgentProjectMembershipsApi
} from '@/services/api/projects.js'
import AddChildAgent from './AddChildAgent.vue'
import AddAgent from './AddAgent.vue'
import EditAgent from './EditAgent.vue'
import ImportAgent from './ImportAgent.vue'
import AgentDetailPanel from './AgentDetailPanel.vue'
import AgentTable from './AgentTable.vue'
import ShareAgent from './ShareAgent.vue'
import ProjectAssignmentDialog from './ProjectAssignmentDialog.vue'
import ProjectEditorDialog from './ProjectEditorDialog.vue'
import ProjectSwitcher from './ProjectSwitcher.vue'
import SessionPickerDialog from './SessionPickerDialog.vue'
import HostSelectionDialog from './HostSelectionDialog.vue'
import { useHostSelection } from './useHostSelection.js'
import { resolveAgentSessionEntry } from './agentSessionEntry.js'
import { resolveAgentRuntimeStatus } from './agentRuntimeStatus.js'
import ManagerLayout from '@/components/common/ManagerLayout.vue'
import { buildAgentTransferBundle, encodeAgentTransferPayload } from '@/utils/agentTransfer.js'

const logger = createLogger('AgentManager')
import {
  buildAgentUpdatePayload,
  dedupeAgents,
  normalizeAgentList,
  useAgentDirectory
} from '@/composables/useAgentDirectory.js'
import { useProjectDirectory } from '@/composables/useProjectDirectory.js'

const INVALID_SESSION_ID = 0
const BATCH_TEST_CONCURRENCY = 4

const emit = defineEmits(['open-agent-console'])

const addAgent = ref(null)
const importAgent = ref(null)
const editAgent = ref(null)
const shareAgent = ref(null)
const addChildAgent = ref(null)
const projectEditor = ref(null)
const projectAssignment = ref(null)
const sessionPicker = ref(null)
const hostSelectionDialog = ref(null)
const agentTable = ref(null)
const tableKey = ref(0)

const allAgents = ref([])
const loading = ref(false)
const quickSavingKey = ref('')
const searchKeyword = ref('')
const currentAgent = ref(null)
const selectedAgents = ref([])
const sortMode = ref('updateTime')
const batchMode = ref(false)
const prioritizeOnlineNodes = ref(false)
const batchTestLoading = ref(false)
const batchExportLoading = ref(false)
const testingAgentIds = ref([])
const liveSessions = ref([])
const sessionsLoading = ref(false)
const activeSessionId = ref('')
const deletingSessionIds = ref([])
const projectMemberships = ref({})
let sessionRefreshTimer = null
let agentLoadToken = 0
let sessionLoadToken = 0
let membershipContextToken = 0
const CONN_RESULTS_KEY = 'agent_conn_results'

const {
  projects,
  projectsLoading,
  selectedProjectId,
  activeProject,
  activeProjectId,
  isUnassignedProject,
  isAllProjects,
  loadProjects,
  selectProject
} = useProjectDirectory()
const hostSelection = useHostSelection(hostSelectionDialog, activeProjectId)
const assignableProjects = computed(() =>
  projects.value.filter(
    (project) =>
      project.status !== 'archived' &&
      project.contentEditable &&
      project.projectId !== activeProjectId.value
  )
)
const isCurrentWorkspaceWritable = computed(
  () =>
    isAllProjects.value ||
    isUnassignedProject.value ||
    (activeProject.value?.status === 'active' && activeProject.value?.contentEditable)
)

const connectionTestResults = ref(
  safeLocalStorage.getJSON(
    CONN_RESULTS_KEY,
    {},
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  )
)

// 缓存模式
const cacheCheckResult = ref(null) // { hasCache, saveTime } | null
const cacheCheckLoading = ref(false)
const cacheAvailabilityLoading = ref(false)
const cacheAvailability = ref({
  agentId: '',
  checked: false,
  hasCache: false,
  saveTime: null
})
let cacheAvailabilityRequestToken = 0

const iconMap = icons
const checkIcon = iconMap.check || 'ep:finished'
const sessionsByAgentId = computed(() => {
  return liveSessions.value.reduce((groups, session) => {
    const agentId = session?.agentId
    if (!agentId) return groups
    if (!groups[agentId]) groups[agentId] = []
    groups[agentId].push(session)
    return groups
  }, {})
})

const { filteredAgents, totalCount, sortAgents } = useAgentDirectory({
  allAgents,
  searchKeyword,
  sortMode,
  prioritizeOnlineNodes,
  connectionTestResults,
  sessionsByAgentId
})
const selectedCount = computed(() => selectedAgents.value.length)
const allSelected = computed(() => {
  const total = filteredAgents.value.length
  return total > 0 && selectedCount.value === total
})
const isCurrentAgentTesting = computed(() =>
  Boolean(
    currentAgent.value?.agentId && testingAgentIds.value.includes(currentAgent.value.agentId)
  )
)

const currentAgentSessions = computed(() => {
  const agentId = currentAgent.value?.agentId
  return agentId ? sessionsByAgentId.value[agentId] || [] : []
})

const currentCacheAvailability = computed(() => {
  if (cacheAvailability.value.agentId !== currentAgent.value?.agentId) {
    return { checked: false, hasCache: false, saveTime: null }
  }
  return cacheAvailability.value
})

const emptyDirectoryCopy = computed(() => {
  if (isAllProjects.value) {
    return {
      title: '暂无可访问主机',
      description: '新增或导入第一台入口主机开始管理资产'
    }
  }
  if (isUnassignedProject.value) {
    return {
      title: '待整理队列已清空',
      description: '所有入口主机都已归属项目，也可以在这里继续新增主机'
    }
  }
  if (activeProject.value?.status === 'archived') {
    return { title: '归档项目暂无主机', description: '该项目当前仅保留项目信息与历史上下文' }
  }
  if (!activeProject.value?.contentEditable) {
    return { title: '项目暂无主机', description: '项目负责人尚未整理入口主机' }
  }
  return { title: '项目暂无主机', description: '新增或导入第一台入口主机开始工作' }
})

const loadCacheAvailability = async (row, { showErrorMessage = false } = {}) => {
  if (!row?.agentId) return null
  const requestToken = ++cacheAvailabilityRequestToken
  cacheAvailabilityLoading.value = true
  try {
    const response = await checkAgentCacheApi(row.agentId)
    const status = {
      agentId: row.agentId,
      checked: true,
      hasCache: Boolean(response.data?.hasCache),
      saveTime: response.data?.saveTime || null
    }
    if (requestToken === cacheAvailabilityRequestToken) {
      cacheAvailability.value = status
    }
    return status
  } catch {
    if (showErrorMessage) showError('检查主机缓存失败')
    return null
  } finally {
    if (requestToken === cacheAvailabilityRequestToken) {
      cacheAvailabilityLoading.value = false
    }
  }
}

const selectAgent = (row) => {
  if (!row?.agentId) return
  currentAgent.value = row
  if (!currentAgentSessions.value.some((session) => session.sessionId === activeSessionId.value)) {
    activeSessionId.value = ''
  }
  testConnResult.value = null
  loadCacheAvailability(row)
}

const handleRowClick = (row) => {
  selectAgent(row)
}

const selectSession = (session) => {
  activeSessionId.value = session?.sessionId || ''
}

const openExistingSession = (session) => {
  if (!session?.sessionId) return
  activeSessionId.value = session.sessionId
  const params = {
    agentName: session.agentName,
    sessionId: session.sessionId,
    projectId: session.projectId || activeProjectId.value,
    projectName:
      session.projectName ||
      projects.value.find((project) => project.projectId === session.projectId)?.projectName ||
      activeProject.value?.projectName ||
      '',
    connLink: session.connLink,
    cacheMode: Boolean(session.cacheMode),
    capabilities: Array.isArray(session.capabilities) ? session.capabilities : [],
    currentHostId: session.currentHostId || ''
  }
  emit('open-agent-console', params)
}

const getLiveSessions = async () => {
  const requestToken = ++sessionLoadToken
  const requestedProjectId = activeProjectId.value
  const requestedUnassigned = isUnassignedProject.value
  await executeRequest(
    async () => {
      const response = await getSessionsApi(
        requestedProjectId ? { projectId: requestedProjectId } : {}
      )
      if (
        requestToken !== sessionLoadToken ||
        requestedProjectId !== activeProjectId.value ||
        requestedUnassigned !== isUnassignedProject.value
      ) {
        return response
      }
      const sessions = requestedUnassigned
        ? (response.data || []).filter((session) => !session?.projectId)
        : response.data || []
      liveSessions.value = sessions
        .slice()
        .sort(
          (a, b) =>
            Number(b.lastActiveTime || b.updateTime || 0) -
            Number(a.lastActiveTime || a.updateTime || 0)
        )
      if (!liveSessions.value.some((session) => session.sessionId === activeSessionId.value)) {
        activeSessionId.value = ''
      }
      return response
    },
    {
      loadingRef: sessionsLoading,
      successMessage: null,
      errorMessage: '获取存活会话失败'
    }
  )
}

const deleteLiveSession = async (session) => {
  if (!session?.sessionId || deletingSessionIds.value.includes(session.sessionId)) return
  deletingSessionIds.value = [...deletingSessionIds.value, session.sessionId]
  try {
    await executeDeleteWithConfirm(() => deleteSessionApi({ sessionId: session.sessionId }), {
      successMessage: '会话已关闭',
      errorMessage: '关闭会话失败',
      onSuccess: () => getLiveSessions()
    })
  } finally {
    deletingSessionIds.value = deletingSessionIds.value.filter(
      (sessionId) => sessionId !== session.sessionId
    )
  }
}

const connectionTestLoading = ref(false)
const testConnResult = ref(null)

const normalizeAgentTestResult = (row, data = {}, latencyMs = null, error = null) => {
  const responseData = data && typeof data === 'object' ? data : {}
  const success = !error && Boolean(responseData.success)
  return {
    ...responseData,
    agentId: row?.agentId || responseData.agentId,
    agentName: row?.agentName || responseData.agentName,
    connLink: row?.connLink || responseData.connLink,
    success,
    message: error?.message || responseData.message || (success ? '连接成功' : '连接无响应'),
    latencyMs: responseData.latencyMs ?? latencyMs
  }
}

const setConnectionTestResult = (result) => {
  if (!result?.agentId) return
  connectionTestResults.value = {
    ...connectionTestResults.value,
    [result.agentId]: result
  }
}

const markAgentsTesting = (agentIds, testing) => {
  const idSet = new Set(testingAgentIds.value)
  const ids = (agentIds || []).filter(Boolean)
  ids.forEach((agentId) => {
    if (testing) {
      idSet.add(agentId)
    } else {
      idSet.delete(agentId)
    }
  })
  testingAgentIds.value = Array.from(idSet)
}

const testAgentConnection = async (row) => {
  const startedAt = Date.now()
  try {
    const resp = await testAgentConnectionApi({ agentId: row.agentId })
    return normalizeAgentTestResult(row, resp?.data, Date.now() - startedAt)
  } catch (e) {
    return normalizeAgentTestResult(row, {}, Date.now() - startedAt, e)
  }
}

const runWithConcurrency = async (items, worker, concurrency = BATCH_TEST_CONCURRENCY) => {
  const results = []
  let cursor = 0
  const runnerCount = Math.min(concurrency, items.length)
  const runners = Array.from({ length: runnerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })

  await Promise.all(runners)
  return results
}

const doTestConn = async (row) => {
  if (!row?.agentId || connectionTestLoading.value || batchTestLoading.value) return
  testConnResult.value = null
  connectionTestLoading.value = true
  markAgentsTesting([row.agentId], true)
  try {
    const result = await testAgentConnection(row)
    setConnectionTestResult(result)
    testConnResult.value = result
  } finally {
    markAgentsTesting([row.agentId], false)
    connectionTestLoading.value = false
  }
}

const handleAgentSelectionChange = (selection = []) => {
  selectedAgents.value = dedupeAgents(selection)
}

const clearAgentSelection = () => {
  selectedAgents.value = []
  agentTable.value?.clearChecked?.()
}

const toggleBatchMode = () => {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    clearAgentSelection()
  }
}

const batchTestConnections = async () => {
  const targets = dedupeAgents(selectedAgents.value).filter((item) => item?.agentId)

  if (!targets.length) {
    showWarning('请先勾选要测试的主机')
    return
  }

  batchTestLoading.value = true
  const agentIds = targets.map((item) => item.agentId)
  markAgentsTesting(agentIds, true)

  try {
    const results = await runWithConcurrency(targets, async (row) => {
      const result = await testAgentConnection(row)
      setConnectionTestResult(result)
      if (currentAgent.value?.agentId === row.agentId) {
        testConnResult.value = result
      }
      return result
    })

    const successCount = results.filter((item) => item.success).length
    const failCount = results.length - successCount
    prioritizeOnlineNodes.value = true

    if (failCount === 0) {
      showSuccess(`批量测试完成，${successCount} 个连接成功`)
    } else if (successCount > 0) {
      showWarning(`批量测试完成：成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      showError(`批量测试失败，${failCount} 个连接无响应`)
    }
  } finally {
    markAgentsTesting(agentIds, false)
    batchTestLoading.value = false
  }
}

const updateAgentInDirectory = (updatedAgent) => {
  const index = allAgents.value.findIndex((item) => item.agentId === updatedAgent.agentId)
  if (index !== -1) {
    Object.assign(allAgents.value[index], updatedAgent)
  }

  if (currentAgent.value?.agentId === updatedAgent.agentId) {
    Object.assign(currentAgent.value, updatedAgent)
  }
}

const toggleQuickConfig = async (field) => {
  if (!currentAgent.value || quickSavingKey.value || field !== 'proxyEnabled') return

  const nextValue = currentAgent.value[field] ? 0 : 1
  const payload = buildAgentUpdatePayload(currentAgent.value, { [field]: nextValue })
  const key = `${currentAgent.value.agentId}:${field}`
  quickSavingKey.value = key

  try {
    await executeRequest(
      async () => {
        const resp = await updateAgentApi(payload)
        updateAgentInDirectory(resp?.data ? { ...payload, ...resp.data } : payload)
        return resp
      },
      {
        successMessage: `代理开关已${nextValue ? '开启' : '关闭'}`,
        errorMessage: '代理开关更新失败'
      }
    )
  } finally {
    if (quickSavingKey.value === key) {
      quickSavingKey.value = ''
    }
  }
}

const createNewSession = async (row) => {
  if (activeProject.value?.status === 'archived') {
    showWarning('归档项目保留已有会话，新会话入口已关闭')
    return
  }
  cacheCheckResult.value = null
  const selected = await hostSelection.open(row)
  if (!selected?.selectedHostId) return

  await executeRequest(
    async () => {
      const resp = await initAgentApi(row.agentId, activeProjectId.value, selected.selectedHostId)
      const sessionId = resp.data.sessionId
      const connLink = row.connLink

      if (sessionId === INVALID_SESSION_ID) {
        throw new Error('主机初始化失败')
      }

      const agentConsoleParams = {
        agentName: row.agentName,
        sessionId,
        projectId: activeProjectId.value,
        projectName: activeProject.value?.projectName || '',
        connLink,
        cacheMode: false,
        capabilities: Array.isArray(resp.data?.capabilities) ? resp.data.capabilities : [],
        initialPrompt: row.initialPrompt || ''
      }

      await getLiveSessions()
      emit('open-agent-console', agentConsoleParams)
      return resp
    },
    {
      successMessage: null,
      errorMessage: null,
      onError: async () => {
        // 连接失败时检查是否有本地缓存
        try {
          cacheCheckLoading.value = true
          const cacheResp = await checkAgentCacheApi(row.agentId)
          cacheCheckResult.value = {
            agent: row,
            hasCache: cacheResp.data?.hasCache || false,
            saveTime: cacheResp.data?.saveTime || null
          }
          if (!cacheResp.data?.hasCache) {
            showError('主机初始化失败')
          }
        } catch {
          showError('主机初始化失败')
        } finally {
          cacheCheckLoading.value = false
        }
      }
    }
  )
}

const openAgentConsole = (row) => {
  if (!row?.agentId) return
  // Entering a console from the tree must also move the directory selection.
  // Otherwise the route/tab changes while the workbench keeps highlighting the
  // previously selected host when the user returns to it.
  selectAgent(row)
  const decision = resolveAgentSessionEntry(sessionsByAgentId.value[row.agentId])
  if (decision.action === 'reuse') {
    openExistingSession(decision.session)
    return
  }
  if (decision.action === 'choose') {
    sessionPicker.value?.open(row, decision.sessions)
    return
  }
  createNewSession(row)
}

const openCacheSession = async (row, selected = null) => {
  const chosen = selected || (await hostSelection.open(row, 'cache'))
  if (!chosen?.selectedHostId) return false
  const resp = await initAgentCacheApi(row.agentId, activeProjectId.value, chosen.selectedHostId)
  const sessionId = resp.data.sessionId
  emit('open-agent-console', {
    agentName: row.agentName,
    sessionId,
    projectId: activeProjectId.value,
    projectName: activeProject.value?.projectName || '',
    connLink: row.connLink,
    cacheMode: true,
    capabilities: Array.isArray(resp.data?.capabilities) ? resp.data.capabilities : []
  })
  cacheCheckResult.value = null
  showSuccess('已进入缓存模式')
  return true
}

const enterCacheMode = async () => {
  const row = cacheCheckResult.value?.agent
  if (!row || cacheCheckLoading.value) return
  cacheCheckLoading.value = true
  try {
    await openCacheSession(row)
  } catch {
    showError('进入缓存模式失败')
  } finally {
    cacheCheckLoading.value = false
  }
}

const enterCacheForAgent = async (row) => {
  if (!row?.agentId || cacheCheckLoading.value) return
  cacheCheckResult.value = null
  cacheCheckLoading.value = true
  try {
    const cacheResponse = await checkAgentCacheApi(row.agentId)
    cacheAvailability.value = {
      agentId: row.agentId,
      checked: true,
      hasCache: Boolean(cacheResponse.data?.hasCache),
      saveTime: cacheResponse.data?.saveTime || null
    }
    if (!cacheAvailability.value.hasCache) {
      showWarning('该主机暂无可用缓存，请先成功进入一次实时控制台并完成数据采集')
      return
    }
    await openCacheSession(row)
  } catch {
    showError('进入缓存模式失败')
  } finally {
    cacheCheckLoading.value = false
  }
}

const loadProjectMemberships = async (rows = [], contextToken = membershipContextToken) => {
  const agentIds = [...new Set(rows.map((item) => item?.agentId).filter(Boolean))]
  if (!agentIds.length) return
  try {
    const response = await getAgentProjectMembershipsApi(agentIds)
    if (contextToken !== membershipContextToken || !isAllProjects.value) return
    projectMemberships.value = {
      ...projectMemberships.value,
      ...(response.data || {})
    }
  } catch (error) {
    if (import.meta.env.DEV) logger.warn('加载主机项目归属失败', error)
  }
}

const getAgents = async () => {
  const requestToken = ++agentLoadToken
  const requestedProjectId = activeProjectId.value
  const requestedUnassigned = isUnassignedProject.value
  const requestedAll = isAllProjects.value
  await executeRequest(
    async () => {
      const resp = requestedAll
        ? await getAgentsApi()
        : requestedUnassigned
          ? await getUnassignedAgentsApi()
          : await getProjectAgentsApi(requestedProjectId)
      if (
        requestToken !== agentLoadToken ||
        requestedProjectId !== activeProjectId.value ||
        requestedUnassigned !== isUnassignedProject.value ||
        requestedAll !== isAllProjects.value
      ) {
        return resp
      }
      allAgents.value = normalizeAgentList(resp.data || [])
      currentAgent.value =
        allAgents.value.find((item) => item.agentId === currentAgent.value?.agentId) ||
        allAgents.value[0] ||
        null
      if (currentAgent.value) loadCacheAvailability(currentAgent.value)
      membershipContextToken += 1
      projectMemberships.value = {}
      if (requestedAll) {
        loadProjectMemberships(allAgents.value, membershipContextToken)
      }
      return resp
    },
    {
      loadingRef: loading,
      successMessage: null,
      errorMessage: '获取主机数据失败'
    }
  )
}

const loadChildren = async (tree, treeNode, resolve) => {
  try {
    const resp = await getWorkspaceAgentChildrenApi(activeProjectId.value, tree.agentId)
    const children = (resp.data || []).map((item) => ({
      ...item,
      hasChildren: true,
      level: treeNode.level + 1
    }))
    if (isAllProjects.value) loadProjectMemberships(children, membershipContextToken)
    resolve(sortAgents(children))
  } catch {
    resolve([])
  }
}

const getAgentRuntimeStatus = (row) =>
  resolveAgentRuntimeStatus({
    agent: row,
    sessions: sessionsByAgentId.value[row?.agentId] || [],
    isTesting: testingAgentIds.value.includes(row?.agentId),
    connectionResult: connectionTestResults.value[row?.agentId] || null
  })

const getLoadedAgent = (agentId) => {
  if (!agentId) return null
  return (
    allAgents.value.find((item) => item.agentId === agentId) ||
    agentTable.value?.getLoadedAgent?.(agentId) ||
    null
  )
}

const getParentHostContext = (row) => {
  const parentAgentId = row?.parentAgentId
  if (!parentAgentId || parentAgentId === 'root') return null
  const host = getLoadedAgent(parentAgentId)
  if (!host) {
    return {
      host: { agentId: parentAgentId },
      status: 'unconfigured',
      label: '状态未知'
    }
  }
  return { host, ...getAgentRuntimeStatus(host) }
}

const openEditAgentDialog = (row) => {
  editAgent.value?.openEditAgentDialog(row, getParentHostContext(row))
}

const openShareAgentDialog = (row) => {
  shareAgent.value?.openShareAgent(row)
}

const openImportAgentDialog = () => {
  if (!isCurrentWorkspaceWritable.value) {
    showWarning(
      activeProject.value?.status === 'archived'
        ? '已归档项目不再接收导入主机'
        : '当前项目为只读工作区'
    )
    return
  }
  importAgent.value?.openImportAgent()
}

const handleCreateCommand = (command) => {
  if (command === 'import') openImportAgentDialog()
}

const downloadBase64Config = (base64, filename) => {
  downloadBlob(new Blob([base64], { type: 'text/plain' }), filename)
}

const batchExportAgents = async () => {
  const targets = dedupeAgents(selectedAgents.value).filter((item) => item?.agentId)
  if (!targets.length) {
    showWarning('请先勾选要导出的主机')
    return
  }
  batchExportLoading.value = true
  try {
    const targetIds = targets.map((item) => item.agentId)
    const response = await exportAgentsApi(targetIds)
    const includedAgents = Array.isArray(response.data) ? response.data : []
    const bundle = buildAgentTransferBundle(includedAgents, targetIds)
    const date = new Date().toISOString().slice(0, 10)
    const filename =
      targets.length === 1
        ? `${targets[0].agentName || 'agent'}_bundle_${date}.txt`
        : `agents_bundle_${date}.txt`
    downloadBase64Config(encodeAgentTransferPayload(bundle), filename)
    const dependencyCount = Math.max(0, bundle.agents.length - targets.length)
    showSuccess(
      dependencyCount
        ? `已导出 ${targets.length} 台目标主机，并携带 ${dependencyCount} 台祖先依赖`
        : `已导出 ${targets.length} 台主机`
    )
  } catch (error) {
    showError(error?.message || '导出主机配置失败')
  } finally {
    batchExportLoading.value = false
  }
}

const selectAllAgents = () => {
  if (allSelected.value) {
    clearAgentSelection()
  } else {
    const ids = filteredAgents.value.map((item) => item.agentId).filter(Boolean)
    agentTable.value?.selectAll?.(ids)
  }
}

const handleBatchCommand = (command) => {
  const handlers = {
    'toggle-all': selectAllAgents,
    export: batchExportAgents,
    detach: detachFromCurrentProject,
    delete: batchDeleteAgents
  }
  handlers[command]?.()
}

const openAddAgentDialog = () => {
  if (!isCurrentWorkspaceWritable.value) {
    showWarning(
      activeProject.value?.status === 'archived'
        ? '已归档项目不再接收新主机'
        : '当前项目为只读工作区'
    )
    return
  }
  addAgent.value?.openAddAgent()
}

const handleProjectChange = (projectId) => {
  if (!projectId || projectId === selectedProjectId.value) return
  selectProject(projectId)
  currentAgent.value = null
  activeSessionId.value = ''
  membershipContextToken += 1
  projectMemberships.value = {}
  tableKey.value += 1
  clearAgentSelection()
  Promise.all([getAgents(), getLiveSessions()])
}

const handleProjectSaved = async (project) => {
  await loadProjects()
  if (project?.projectId) {
    selectProject(project.projectId)
  }
  await refresh({ reloadProjects: false })
}

const openProjectAssignment = () => {
  projectAssignment.value?.open(dedupeAgents(selectedAgents.value))
}

const handleProjectAssignmentSaved = async () => {
  clearAgentSelection()
  await loadProjects()
  await refresh({ reloadProjects: false })
}

const detachFromCurrentProject = async () => {
  const projectId = activeProjectId.value
  const targets = dedupeAgents(selectedAgents.value).filter((item) => item?.agentId)
  if (!projectId || !activeProject.value?.contentEditable || !targets.length) return
  await executeDeleteWithConfirm(
    () =>
      detachProjectAgentsApi(
        projectId,
        targets.map((item) => item.agentId)
      ),
    {
      message: `确定将选中的 ${targets.length} 台入口主机从项目中移除吗？主机资产本身会继续保留。`,
      successMessage: '已从项目移除',
      errorMessage: '移出项目失败',
      onSuccess: async () => {
        clearAgentSelection()
        await loadProjects()
        await refresh({ reloadProjects: false })
      }
    }
  )
}

const openAddChildAgent = (row) => {
  addChildAgent.value?.openAddChildAgent(row, getAgentRuntimeStatus(row))
}

const deleteAgent = async (row) => {
  await executeDeleteWithConfirm(() => deleteAgentApi({ agentId: row.agentId }), {
    message: `删除主机“${row.agentName || row.agentId}”将同时删除其全部子节点并关闭相关会话，此操作不可恢复。`,
    successMessage: '主机删除成功',
    errorMessage: '主机删除失败',
    loadingRef: loading,
    onSuccess: () => refresh()
  })
}

const batchDeleteAgents = async () => {
  const targets = dedupeAgents(selectedAgents.value).filter((item) => item?.agentId)
  const selectedIds = new Set(targets.map((item) => item.agentId))
  const agentById = new Map(allAgents.value.map((item) => [item.agentId, item]))
  const deletionRoots = targets.filter((item) => {
    const visited = new Set([item.agentId])
    let parentId = item.parentAgentId
    while (parentId && parentId !== 'root' && !visited.has(parentId)) {
      if (selectedIds.has(parentId)) return false
      visited.add(parentId)
      parentId = agentById.get(parentId)?.parentAgentId
    }
    return true
  })
  await executeBatchDelete(deletionRoots, (item) => deleteAgentApi({ agentId: item.agentId }), {
    itemName: '主机',
    confirmMessage: `确定删除选中的 ${targets.length} 台主机吗？父节点的全部未选中子节点也会一并删除，相关会话将被关闭，此操作不可恢复。`,
    loadingRef: loading,
    onSuccess: () => refresh()
  })
}

const refresh = async ({ reloadProjects = true } = {}) => {
  tableKey.value += 1
  agentTable.value?.clearSelection()
  selectedAgents.value = []
  if (reloadProjects) await loadProjects()
  await Promise.all([getAgents(), getLiveSessions()])
}

onMounted(() => {
  refresh()
  sessionRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && !sessionsLoading.value) {
      getLiveSessions()
    }
  }, 15000)
})

onUnmounted(() => {
  if (sessionRefreshTimer) {
    window.clearInterval(sessionRefreshTimer)
    sessionRefreshTimer = null
  }
})

watch(connectionTestResults, (val) => {
  const persisted = safeLocalStorage.setJSON(CONN_RESULTS_KEY, val)
  if (!persisted && import.meta.env.DEV) {
    logger.warn('连接测试结果写入 localStorage 失败')
  }
})

watch(sortMode, () => {
  prioritizeOnlineNodes.value = false
})
</script>

<style scoped>
@import '@/styles/workbench-directory-shared.css';

.agent-manager {
  --workbench-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
  --pm-blue: var(--el-color-primary);
  --pm-blue-soft: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
  --pm-muted: var(--el-text-color-secondary);
  --pm-border: color-mix(in srgb, var(--el-border-color) 70%, transparent);
  --pm-soft-border: color-mix(in srgb, var(--el-border-color) 54%, transparent);
  --pm-panel-soft: var(--app-control-background-soft);
  --pm-panel-strong: var(--app-card-background);
  --pm-red: var(--el-color-danger);
  --pm-green: var(--el-color-success);
  --pm-ink: var(--el-text-color-primary);
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px auto;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--pm-soft-border) 70%, transparent);
  flex-shrink: 0;
}

.project-context-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin: 0 8px 8px;
  border-radius: 7px;
  color: var(--el-color-warning-dark-2);
  background: color-mix(in srgb, var(--el-color-warning) 9%, var(--app-control-background-soft));
  font-size: 10px;
}

.project-context-notice span {
  flex: 1;
}

.project-context-notice button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.list-title-line {
  display: flex;
  align-items: center;
  gap: 7px;
}

.list-title-line h2 {
  margin: 0;
}

.directory-summary {
  height: 20px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-tag);
  background: var(--app-control-background-soft);
  color: var(--el-text-color-secondary);
  font-size: 10px;
  white-space: nowrap;
}

.directory-summary strong {
  color: var(--el-text-color-regular);
  font-weight: 600;
}

.directory-summary i {
  width: 1px;
  height: 10px;
  background: var(--app-divider-color);
}

.directory-summary .has-live,
.directory-summary .has-live strong {
  color: var(--el-color-success-dark-2);
}

.search-input {
  grid-column: 1 / -1;
}

.action-add {
  min-width: 0;
}

.action-add :deep(.el-button-group) {
  display: flex;
}

.sort-select {
  width: 100%;
}

.sort-select :deep(.el-select__wrapper) {
  min-height: 30px;
  border-radius: 6px;
  border: 0;
  background: var(--pm-panel-soft);
  box-shadow: none;
}

.sort-select :deep(.el-select__selected-item) {
  color: var(--pm-muted);
  font-size: 12px;
  font-weight: 600;
}

.batch-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-control);
  border: 1px solid var(--pm-border);
  background: transparent;
  color: var(--pm-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-fast) var(--motion-easing);
}

.batch-toggle-btn:hover {
  color: var(--pm-blue);
  border-color: color-mix(in srgb, var(--pm-blue) 30%, transparent);
  background: color-mix(in srgb, var(--pm-blue) 6%, transparent);
}

.batch-toggle-btn.active {
  color: var(--pm-blue);
  border-color: color-mix(in srgb, var(--pm-blue) 40%, transparent);
  background: color-mix(in srgb, var(--pm-blue) 10%, transparent);
}

.table-panel {
  flex: 1;
  min-height: 0;
  padding: 8px;
}

/* ── 底部批量操作栏 ── */
.batch-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  margin: 0 8px 8px;
  border-radius: var(--radius-control);
  background: var(--app-selected-background);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 24%, var(--app-border-color));
  box-shadow: none;
  flex-shrink: 0;
  z-index: var(--z-sticky-bar);
}

.batch-bar-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--pm-blue);
  white-space: nowrap;
}

.batch-bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pm-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-fast) var(--motion-easing);
  white-space: nowrap;
}

.bar-btn:hover {
  color: var(--pm-blue);
  background: color-mix(in srgb, var(--pm-blue) 8%, transparent);
  border-color: color-mix(in srgb, var(--pm-blue) 24%, transparent);
}

.bar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bar-btn--muted:hover {
  color: var(--pm-muted);
  background: var(--pm-panel-soft);
  border-color: transparent;
}

.bar-btn--primary {
  color: white;
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.bar-btn--primary:hover {
  color: white;
  background: var(--el-color-primary-light-3);
  border-color: var(--el-color-primary-light-3);
}

.bar-btn--icon {
  width: 26px;
  padding: 0;
  justify-content: center;
}

.batch-bar-actions :deep(.el-dropdown) {
  display: inline-flex;
}

:global(.batch-danger-item) {
  color: var(--el-color-danger) !important;
}

/* 入场/离场动画 */
.batch-bar-enter-active,
.batch-bar-leave-active {
  transition:
    opacity var(--motion-base) var(--motion-easing),
    transform var(--motion-base) var(--motion-easing);
}

.batch-bar-enter-from,
.batch-bar-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
