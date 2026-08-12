<template>
  <div class="team-manager">
    <AdminToolbar>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索团队名称、团队ID、队长"
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

    <AdminStatsGrid :columns="3">
      <article class="metric-card">
        <span class="metric-icon primary"><el-icon><Icon :icon="iconMap.userFilled" /></el-icon></span>
        <div><strong class="metric-value">{{ teamData.length }}</strong><span class="metric-label">团队总数</span></div>
      </article>
      <article class="metric-card">
        <span class="metric-icon success"><el-icon><Icon :icon="iconMap.user" /></el-icon></span>
        <div><strong class="metric-value">{{ assignedLeaderCount }}</strong><span class="metric-label">已分配队长</span></div>
      </article>
      <article class="metric-card">
        <span class="metric-icon warning"><el-icon><Icon :icon="iconMap.warning" /></el-icon></span>
        <div><strong class="metric-value">{{ unassignedLeaderCount }}</strong><span class="metric-label">待分配队长</span></div>
      </article>
    </AdminStatsGrid>

    <AdminWorkspacePanel title="团队列表">
      <template #tags>
        <el-tag effect="light">
          结果 {{ filteredTeams.length }}
        </el-tag>
      </template>

      <template #actions>
        <el-button
          v-if="isAdmin"
          type="primary"
          @click="openAddTeamDialog"
        >
          <el-icon><Icon :icon="iconMap.plus" /></el-icon>
          新增团队
        </el-button>
      </template>

      <el-table
        v-loading="loading"
        :data="filteredTeams"
        class="team-table"
        empty-text="暂无团队"
      >
        <el-table-column
          prop="id"
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
              {{ getUserName(row.leaderId) }}
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
              @click="delTeam(row.teamId || row.id)"
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
      @close="close"
    >
      <el-form
        :model="team"
        label-width="100px"
        label-position="left"
      >
        <el-form-item label="团队名称">
          <el-input
            v-model="team.teamName"
            placeholder="请输入团队名称"
          />
        </el-form-item>
        <el-form-item label="队长">
          <el-select
            v-model="team.leaderId"
            placeholder="请选择队长"
            clearable
          >
            <el-option
              v-for="item in users"
              :key="item.userId"
              :label="item.userName"
              :value="item.userId"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="close">
            取消
          </el-button>
          <el-button
            type="primary"
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
import { computed, ref, reactive, onMounted } from 'vue'
import { ElNotification } from 'element-plus'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { v4 as uuidV4 } from 'uuid'
import { icons } from '@/utils/icons.js'
import { addTeamApi, deleteTeamApi, getAllTeamsApi, getUsersNoTeamApi, getAllUsersApi } from '@/services/api.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { useAuth } from '@/composables/useAuth.js'
import AdminToolbar from '@/components/Admin/shared/AdminToolbar.vue'
import AdminStatsGrid from '@/components/Admin/shared/AdminStatsGrid.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'

const iconMap = icons
const BUILT_IN_TEAM_IDS = new Set(['system-admin', 'admin-team', 'adminteam'])
const BUILT_IN_TEAM_NAMES = new Set(['系统管理员', 'adminteam'])

const { isAdmin, fetchAuth } = useAuth()

const addTeamDialog = ref(false)
const loading = ref(false)
const searchKeyword = ref('')
const team = reactive({})
const teamData = ref([])
const users = ref([])        // 无团队用户，用于新建团队时选队长
const allUsers = ref([])     // 全部用户，用于显示队长名称

const filteredTeams = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return teamData.value

  return teamData.value.filter((item) => {
    const leaderName = getUserName(item.leaderId).toLowerCase()
    return [item.teamId || item.id, item.teamName, item.teamname, leaderName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })
})

const assignedLeaderCount = computed(() => teamData.value.filter((item) => item.leaderId).length)
const unassignedLeaderCount = computed(() => teamData.value.filter((item) => !item.leaderId).length)

const getAllTeam = async () => {
  loading.value = true
  try {
    const resp = await getAllTeamsApi()
    teamData.value = (resp.data || []).map((item) => ({
      ...item,
      id: item.id || item.teamId,
      teamName: item.teamName || item.teamname
    }))
  } finally {
    loading.value = false
  }
}

const getAllUser = async () => {
  if (isAdmin.value) {
    const [noTeamResp, allResp] = await Promise.all([getUsersNoTeamApi(), getAllUsersApi()])
    users.value = noTeamResp.data || []
    allUsers.value = allResp.data || []
    return
  }
  const allResp = await getAllUsersApi()
  users.value = []
  allUsers.value = allResp.data || []
}

const openAddTeamDialog = async () => {
  addTeamDialog.value = true
  await getAllUser()
}

const addTeam = async () => {
  if (!team.teamName || !team.teamName.trim()) {
    ElNotification({ title: '验证失败', message: '请输入团队名称！', type: 'warning' })
    return
  }
  if (!team.leaderId) {
    ElNotification({ title: '验证失败', message: '请选择队长！', type: 'warning' })
    return
  }

  const payload = {
    teamId: uuidV4(),
    teamName: team.teamName.trim(),
    leaderId: team.leaderId
  }
  try {
    await addTeamApi(payload)
    ElNotification({ title: '通知', message: '添加团队成功！', type: 'success' })
    close()
    await refreshData()
  } catch (error) {
    ElNotification({ title: '错误', message: error?.message || '添加团队失败，请稍后重试！', type: 'error' })
  }
}

const close = () => {
  addTeamDialog.value = false
  Object.keys(team).forEach((k) => delete team[k])
}

const delTeam = async (id) => {
  const found = teamData.value.find((t) => (t.teamId || t.id) === id)
  const teamName = found ? found.teamName : '该团队'
  if (isBuiltInTeam(found || { teamId: id })) {
    ElNotification({ title: '禁止操作', message: '内置系统管理员团队禁止删除。', type: 'warning' })
    return
  }

  const confirmed = await confirmDelete({
    message: `确定要删除团队 "${teamName}" 吗？此操作不可撤销。`
  })
  if (!confirmed) return

  try {
    await deleteTeamApi({ id })
    ElNotification({ title: '通知', message: '删除团队成功！', type: 'success' })
    await refreshData()
  } catch (error) {
    ElNotification({ title: '错误', message: error?.message || '删除团队失败，请稍后重试！', type: 'error' })
  }
}

const refreshData = async () => {
  try {
    await Promise.all([getAllTeam(), getAllUser()])
  } catch {
    ElNotification({ title: '错误', message: '刷新数据失败！', type: 'error' })
  }
}

const getUserName = (userId) => {
  const user = allUsers.value.find((u) => u.userId === userId || u.id === userId)
  return user ? user.userName || user.username : '未知用户'
}

const isBuiltInTeam = (item) => {
  if (!item) return false
  const teamId = item.teamId || item.id
  const teamName = item.teamName || item.teamname
  return BUILT_IN_TEAM_IDS.has(teamId) || BUILT_IN_TEAM_NAMES.has(teamName)
}

onMounted(async () => {
  await fetchAuth()
  getAllTeam()
  getAllUser()
})
</script>

<style scoped>
.team-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}

.toolbar-search {
  width: min(380px, 100%);
}

.metric-icon.primary {
  background: color-mix(in srgb, var(--el-color-primary) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-primary);
}

.metric-icon.success {
  background: color-mix(in srgb, var(--el-color-success) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-success);
}

.metric-icon.warning {
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-warning);
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
