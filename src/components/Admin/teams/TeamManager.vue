<template>
  <div class="team-manager">
    <PageHeader
      title="团队管理"
      :icon="iconMap.userFilled"
    >
      <template #actions>
        <el-button
          v-if="isAdmin"
          type="primary"
          :disabled="mutationBusy"
          @click="openAddTeamDialog"
        >
          <el-icon><Icon :icon="iconMap.plus" /></el-icon>
          新增团队
        </el-button>
      </template>
    </PageHeader>
    <AdminToolbar>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索团队名称、团队ID、队长"
        aria-label="搜索团队名称、团队ID、队长姓名或ID"
        clearable
        class="toolbar-search"
      >
        <template #prefix>
          <el-icon><Icon :icon="iconMap.search" /></el-icon>
        </template>
      </el-input>

      <template #actions>
        <el-button
          type="primary"
          plain
          :loading="loading"
          @click="refreshData"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          刷新
        </el-button>
      </template>
    </AdminToolbar>

    <StatsStrip :columns="3">
      <article class="metric-card">
        <span class="metric-label">团队总数</span>
        <strong class="metric-value">{{ teamData.length }}</strong>
      </article>
      <article class="metric-card">
        <span class="metric-label">已分配队长</span>
        <strong class="metric-value">{{ assignedLeaderCount }}</strong>
      </article>
      <article class="metric-card">
        <span class="metric-label">待分配队长</span>
        <strong class="metric-value">{{ unassignedLeaderCount }}</strong>
      </article>
    </StatsStrip>

    <AdminWorkspacePanel title="团队列表">
      <template #tags>
        <el-tag effect="light">
          结果 {{ filteredTeams.length }}
        </el-tag>
      </template>

      <el-alert
        v-if="listError"
        :title="listError"
        type="error"
        :closable="false"
        show-icon
      />
      <el-table
        v-loading="loading"
        :data="filteredTeams"
        class="team-table"
        :empty-text="emptyText"
      >
        <el-table-column
          prop="teamId"
          label="团队ID"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="teamName"
          label="团队名称"
          min-width="180"
        />
        <el-table-column
          prop="leaderId"
          label="队长"
          min-width="160"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.leaderId"
              effect="light"
              size="small"
            >
              {{ row.leaderName || row.leaderId }}
            </el-tag>
            <span
              v-else
              class="empty-text"
            >未分配</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="createTime"
          label="创建时间"
          min-width="180"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="110"
          fixed="right"
        >
          <template #default="{ row }">
            <el-tag
              v-if="isBuiltInTeam(row)"
              size="small"
              type="info"
              effect="plain"
            >
              内置团队
            </el-tag>
            <el-button
              v-else-if="isAdmin"
              type="danger"
              text
              size="small"
              :disabled="mutationBusy || loading"
              @click="delTeam(row)"
            >
              <el-icon><Icon :icon="iconMap.delete" /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </AdminWorkspacePanel>

    <el-dialog
      v-model="addTeamDialog"
      title="新增团队"
      width="560px"
      class="admin-entity-dialog"
      draggable
      :show-close="!submitting"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
    >
      <el-alert
        v-if="candidateError"
        :title="candidateError"
        type="error"
        :closable="false"
        show-icon
      />
      <el-form
        :model="team"
        :disabled="submitting"
        label-width="100px"
        label-position="left"
      >
        <el-form-item label="团队名称">
          <el-input
            v-model="team.teamName"
            placeholder="请输入团队名称"
            maxlength="100"
          />
        </el-form-item>
        <el-form-item label="队长">
          <el-select
            v-model="team.leaderId"
            placeholder="请选择队长"
            :loading="candidatesLoading"
            :no-data-text="candidateError ? '加载失败' : '没有可选择的未入队用户'"
            :disabled="candidatesLoading || Boolean(candidateError)"
            clearable
            filterable
          >
            <el-option
              v-for="item in leaderOptions"
              :key="item.userId"
              :label="item.userName"
              :value="item.userId"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="candidateError"
            text
            @click="loadCandidates"
          >
            重新加载队长候选
          </el-button>
          <el-button
            :disabled="submitting"
            @click="addTeamDialog = false"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="!canSubmitTeam"
            @click="addTeam"
          >
            提交
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import { computed, ref, reactive, onMounted, onScopeDispose, watch } from 'vue'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { showWarning } from '@/utils/messageUtils.js'
import { icons as iconMap } from '@/utils/icons.js'
import {
  addTeamApi,
  deleteTeamApi,
  getAllTeamsApi,
  getTeamLeaderOptionsApi
} from '@/services/api/admin.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { useAuth } from '@/composables/useAuth.js'
import AdminToolbar from '@/components/Admin/shared/AdminToolbar.vue'
import StatsStrip from '@/components/common/StatsStrip.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'

const BUILT_IN_TEAM_ID = 'system-admin'
const BUILT_IN_TEAM_NAME = '系统管理员'

const { isAdmin, fetchAuth } = useAuth()

const addTeamDialog = ref(false)
const loading = ref(false)
const listError = ref('')
const searchKeyword = ref('')
const team = reactive({ teamName: '', leaderId: '' })
const teamData = ref([])

const leaderOptions = ref([])
const candidatesLoading = ref(false)
const candidateError = ref('')
const submitting = ref(false)
const deleting = ref(false)
const mutationBusy = computed(() => submitting.value || deleting.value)
const canSubmitTeam = computed(() => !mutationBusy.value && !candidatesLoading.value
  && !candidateError.value && !!team.teamName.trim()
  && leaderOptions.value.some(({ userId }) => userId === team.leaderId))

let directoryRequest
let candidatesRequest
let disposed = false

const filteredTeams = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return teamData.value

  return teamData.value.filter(({ teamId, teamName, leaderId, leaderName }) =>
    [teamId, teamName, leaderId, leaderName]
      .some(value => value?.toLowerCase().includes(keyword))
  )
})
const emptyText = computed(() => {
  if (loading.value) return '正在加载…'
  if (listError.value) return '请刷新后重试'
  return searchKeyword.value.trim() ? '没有匹配的团队' : '暂无团队'
})

const assignedLeaderCount = computed(() => teamData.value.filter((item) => item.leaderId).length)
const unassignedLeaderCount = computed(() => teamData.value.length - assignedLeaderCount.value)

const refreshData = async () => {
  directoryRequest?.abort()
  const request = new AbortController()
  directoryRequest = request
  const { signal } = request
  loading.value = true
  listError.value = ''
  try {
    const { data } = await getAllTeamsApi({ signal })
    if (signal.aborted) return
    if (!Array.isArray(data)) throw new Error('团队目录响应格式异常')
    teamData.value = data
  } catch (error) {
    if (signal.aborted) return
    teamData.value = []
    listError.value = handleError(error, { defaultMessage: '加载团队列表失败', showMessage: false })
  } finally {
    if (directoryRequest === request) {
      directoryRequest = undefined
      loading.value = false
    }
  }
}

const loadCandidates = async () => {
  if (disposed || !isAdmin.value || !addTeamDialog.value || candidatesLoading.value) return
  const request = new AbortController()
  candidatesRequest = request
  const { signal } = request
  candidatesLoading.value = true
  candidateError.value = ''
  try {
    const { data } = await getTeamLeaderOptionsApi({ signal })
    if (!Array.isArray(data)) throw new Error('队长候选响应格式异常')
    if (!signal.aborted) leaderOptions.value = data
  } catch (error) {
    if (!signal.aborted) {
      candidateError.value = handleError(error, { defaultMessage: '加载队长候选失败', showMessage: false })
    }
  } finally {
    if (candidatesRequest === request) {
      candidatesRequest = undefined
      candidatesLoading.value = false
    }
  }
}

const openAddTeamDialog = () => {
  if (!isAdmin.value || mutationBusy.value || addTeamDialog.value) return
  Object.assign(team, { teamName: '', leaderId: '' })
  leaderOptions.value = []
  addTeamDialog.value = true
  return loadCandidates()
}

watch(addTeamDialog, (visible) => {
  if (visible) return
  candidatesRequest?.abort()
  candidatesRequest = undefined
  candidatesLoading.value = false
}, { flush: 'sync' })

const addTeam = () => {
  if (!isAdmin.value || !addTeamDialog.value || !canSubmitTeam.value) return
  const payload = { teamName: team.teamName.trim(), leaderId: team.leaderId }
  return executeRequest(() => addTeamApi(payload), {
    loadingRef: submitting,
    successMessage: '已创建团队',
    errorMessage: '创建团队失败',
    onSuccess: async () => {
      addTeamDialog.value = false
      if (!disposed) await refreshData()
    },
    onError: (error) => {
      const status = error?.response?.status
      if (disposed || !addTeamDialog.value || (status !== 404 && status !== 409)) return
      team.leaderId = ''
      return loadCandidates()
    }
  }).catch(() => false)
}

const isBuiltInTeam = (item) =>
  item.teamId === BUILT_IN_TEAM_ID || item.teamName === BUILT_IN_TEAM_NAME

const delTeam = async (row) => {
  if (!isAdmin.value || mutationBusy.value || loading.value) return
  if (isBuiltInTeam(row)) {
    showWarning('内置系统管理员团队禁止删除')
    return
  }
  const { teamId, teamName } = row
  deleting.value = true
  try {
    const confirmed = await confirmDelete({ message: `确定要删除团队「${teamName}」吗？此操作不可撤销。` })
    if (!confirmed || disposed) return
    await executeRequest(() => deleteTeamApi({ id: teamId }), {
      successMessage: '已删除团队',
      errorMessage: '删除团队失败',
      onSuccess: () => { if (!disposed) return refreshData() }
    }).catch(() => false)
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await fetchAuth()
  if (!disposed) await refreshData()
})
onScopeDispose(() => {
  disposed = true
  directoryRequest?.abort()
  candidatesRequest?.abort()
})
</script>

<style scoped>
.team-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: auto;
}

.toolbar-search {
  width: min(380px, 100%);
}

.team-table {
  flex: 1;
  min-height: 0;
}

.team-table :deep(.el-table__header th) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 650;
  background: var(--el-fill-color-light) !important;
}

.team-table :deep(.el-table__row td) {
  padding: 10px 0;
}

.empty-text {
  color: var(--el-text-color-placeholder);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:global(.admin-entity-dialog) {
  border-radius: var(--radius-overlay);
  box-shadow: var(--shadow-overlay);
}

:global(.admin-entity-dialog .el-dialog__header) {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--app-divider-color);
}

:global(.admin-entity-dialog .el-dialog__body) {
  padding: var(--space-4);
}

:global(.admin-entity-dialog .el-dialog__footer) {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--app-divider-color);
  background: var(--app-page-background);
}

@media (max-width: 768px) {
  .toolbar-search {
    width: 100%;
  }

  :deep(.admin-toolbar__actions) {
    width: 100%;
  }

  :deep(.admin-toolbar__actions .el-button) {
    flex: 1;
  }
}
</style>
