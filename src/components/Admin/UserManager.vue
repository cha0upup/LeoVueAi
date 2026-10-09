<template>
  <div class="user-manager">
    <AdminToolbar>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名、用户ID或角色"
        clearable
        class="toolbar-search"
      >
        <template #prefix>
          <el-icon><Icon :icon="iconMap.search" /></el-icon>
        </template>
      </el-input>

      <el-select
        v-model="filterRole"
        placeholder="角色"
        clearable
        class="toolbar-filter"
      >
        <el-option
          v-for="role in ['', 'admin', 'leader', 'normal']"
          :key="role"
          :label="role ? getRoleDisplayName(role) : '全部角色'"
          :value="role"
        />
      </el-select>

      <el-select
        v-model="filterTeam"
        placeholder="团队"
        clearable
        class="toolbar-filter"
      >
        <el-option
          label="全部团队"
          value=""
        />
        <el-option
          v-for="team in teams"
          :key="team.teamId"
          :label="team.teamName"
          :value="team.teamId"
        />
      </el-select>

      <template #actions>
        <el-button
          :disabled="!filteredUsers.length"
          plain
          @click="exportUsers"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          导出
        </el-button>
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

    <AdminStatsGrid :columns="5">
      <article
        v-for="card in statsCardConfigs"
        :key="card.key"
        class="metric-card"
        :class="card.className"
      >
        <span class="metric-icon"><el-icon><Icon :icon="card.icon" /></el-icon></span>
        <div>
          <strong class="metric-value">{{ stats[card.key] }}</strong>
          <span class="metric-label">{{ card.label }}</span>
        </div>
      </article>
    </AdminStatsGrid>

    <AdminWorkspacePanel title="用户列表">
      <template #tags>
        <el-tag effect="light">
          筛选结果 {{ filteredUsers.length }}
        </el-tag>
      </template>

      <template
        #actions
      >
        <el-button
          type="primary"
          @click="openAddDialog"
        >
          <el-icon><Icon :icon="iconMap.plus" /></el-icon>
          新增用户
        </el-button>
      </template>

      <el-table
        v-loading="loading"
        :data="filteredUsers"
        class="users-table"
        empty-text="暂无用户"
      >
        <el-table-column
          prop="userId"
          label="用户ID"
          min-width="150"
        >
          <template #default="{ row }">
            <el-tooltip
              :content="row.userId"
              placement="top"
            >
              <span class="user-id">{{ row.userId || '未知ID' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column
          prop="userName"
          label="用户名"
          min-width="180"
        >
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar
                :size="32"
                class="user-avatar"
              >
                {{ (row.userName || 'U').charAt(0).toUpperCase() }}
              </el-avatar>
              <span class="username">{{ row.userName || '未知用户' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="privilege"
          label="角色"
          width="110"
        >
          <template #default="{ row }">
            <el-tag
              :type="getRoleTagType(row.privilege)"
              size="small"
              effect="light"
            >
              {{ getRoleDisplayName(row.privilege) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="teamId"
          label="所属团队"
          min-width="150"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.teamId"
              type="info"
              size="small"
              effect="plain"
            >
              {{ row.teamId }}
            </el-tag>
            <span
              v-else
              class="no-team"
            >未分配团队</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="createTime"
          label="创建时间"
          width="170"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          width="90"
        >
          <template #default="{ row }">
            <StatusIndicator
              :status="isUserEnabled(row.status) ? 'normal' : 'disabled'"
              :label="formatUserStatus(row.status)"
              compact
            />
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="230"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="row-actions">
              <el-button
                type="primary"
                text
                size="small"
                :disabled="!canEditUser(row)"
                :title="getEditDisabledReason(row)"
                @click="editUser(row)"
              >
                <el-icon><Icon :icon="iconMap.edit" /></el-icon>
                编辑
              </el-button>
              <el-button
                type="warning"
                text
                size="small"
                :disabled="!canManageUser(row)"
                :title="getManageDisabledReason(row)"
                @click="resetPassword(row)"
              >
                <el-icon><Icon :icon="iconMap.key" /></el-icon>
                重置密码
              </el-button>
              <el-button
                type="danger"
                text
                size="small"
                :disabled="!canManageUser(row) || isBuiltInAdmin(row)"
                :title="isBuiltInAdmin(row) ? '系统内置 admin 禁止删除' : getManageDisabledReason(row)"
                @click="deleteUser(row)"
              >
                <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </AdminWorkspacePanel>

    <UserEditorDialog
      v-model="userDialogVisible"
      :editing="isEdit"
      :editing-built-in-admin="isEditingBuiltInAdmin"
      :form-state="userForm"
      :rules="userRules"
      :teams="teams"
      :is-admin="isAdmin"
      :is-leader="isLeader"
      :submitting="submitting"
      @submit="submitUser"
      @closed="closeUserDialog"
      @form-ready="userFormRef = $event"
    />

    <UserPasswordResetDialog
      v-model="resetPasswordVisible"
      :form-state="resetForm"
      :rules="resetRules"
      :resetting="resetting"
      @submit="submitResetPassword"
      @form-ready="resetFormRef = $event"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElNotification } from 'element-plus'
import { v4 as uuidV4 } from 'uuid'
import { AUTH_FIELD_LIMITS } from '@/constants/app.js'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { executeDeleteWithConfirm, confirmAction } from '@/utils/confirmUtils.js'
import { omitFields } from '@/utils/dataUtils.js'
import { useEditDialog, useDialog } from '@/utils/dialogUtils.js'
import { createPasswordRules, createPasswordMatchValidator, validateForm, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import {
  addUserApi,
  deleteUserApi,
  getAllUsersApi,
  getAllTeamsApi,
  updateUserApi,
  resetUserPasswordApi
} from '@/services/api/admin.js'
import { showError } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'
import { useAuth } from '@/composables/useAuth.js'
import AdminToolbar from '@/components/Admin/shared/AdminToolbar.vue'
import AdminStatsGrid from '@/components/Admin/shared/AdminStatsGrid.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import UserEditorDialog from './UserEditorDialog.vue'
import UserPasswordResetDialog from './UserPasswordResetDialog.vue'
import {
  canEditUser as canEditUserForActor,
  canManageUser as canManageUserForActor,
  createPasswordResetForm,
  createUserForm,
  filterUsers,
  formatUserStatus,
  getEditDisabledReason as getEditDisabledReasonForActor,
  getManageDisabledReason as getManageDisabledReasonForActor,
  getRoleDisplayName,
  getRoleTagType,
  isBuiltInAdmin,
  isUserEnabled,
  normalizeUserStatus,
  userStats
} from './userManagerModel.js'

const statsCardConfigs = [
  { key: 'total', label: '用户总数', icon: iconMap.user, className: 'total-users' },
  { key: 'admin', label: '管理员', icon: iconMap.userFilled, className: 'admin-users' },
  { key: 'leader', label: '队长', icon: iconMap.userFilled, className: 'leader-users' },
  { key: 'normal', label: '普通用户', icon: iconMap.avatar, className: 'normal-users' },
  { key: 'assignedToTeam', label: '已归属团队', icon: iconMap.userFilled, className: 'team-users' }
]

const { currentUser, isAdmin, isLeader, fetchAuth } = useAuth()

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const resetting = ref(false)

// 使用对话框工具
const userDialog = useEditDialog()
const userDialogVisible = userDialog.visible
const isEdit = computed(() => !!userDialog.currentItem.value)
const isEditingBuiltInAdmin = computed(() =>
  isBuiltInAdmin(userDialog.currentItem.value) || isBuiltInAdmin(userForm)
)
const resetPasswordDialog = useDialog()
const resetPasswordVisible = resetPasswordDialog.visible

// 数据
const userData = ref([])
const teams = ref([])
const searchKeyword = ref('')
const filterRole = ref('')
const filterTeam = ref('')

// 表单
const userFormRef = ref(null)
const resetFormRef = ref(null)
const userForm = reactive(createUserForm())
const resetForm = reactive(createPasswordResetForm())

// 表单验证规则
const userRules = {
  userName: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      max: AUTH_FIELD_LIMITS.usernameMaxLength,
      message: `用户名不能超过 ${AUTH_FIELD_LIMITS.usernameMaxLength} 个字符`,
      trigger: 'blur'
    }
  ],
  password: createPasswordRules('请输入密码'),
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: createPasswordMatchValidator(() => userForm.password, '两次输入密码不一致'),
      trigger: 'blur'
    }
  ],
  privilege: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const resetRules = {
  newPassword: createPasswordRules(),
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: createPasswordMatchValidator(() => resetForm.newPassword, '两次输入密码不一致'),
      trigger: 'blur'
    }
  ]
}

// 计算属性
const filteredUsers = computed(() => filterUsers(userData.value, {
  keyword: searchKeyword.value,
  role: filterRole.value,
  team: filterTeam.value
}))
const stats = computed(() => userStats(userData.value))
const actorContext = computed(() => ({
  isAdmin: isAdmin.value,
  isLeader: isLeader.value,
  currentUser: currentUser.value
}))

// 方法
const notifyUser = (type, message) => {
  ElNotification({
    title: { warning: '禁止操作', success: '成功', error: '失败' }[type],
    message,
    type
  })
}

const refreshData = async () => {
  await executeRequest(
    () => Promise.all([getAllUsers(), getAllTeams()]),
    {
      loadingRef: loading,
      errorMessage: '数据刷新失败'
    }
  )
}

const getAllUsers = async () => {
  const response = await getAllUsersApi()
  userData.value = Array.isArray(response?.data) ? response.data : []
}

const getAllTeams = async () => {
  const response = await getAllTeamsApi()
  teams.value = Array.isArray(response?.data) ? response.data : []
}

const openAddDialog = () => {
  userDialog.open()
  Object.assign(userForm, defaultUserForm)
  // 队长创建用户时预填充并锁定团队
  if (isLeader.value && currentUser.value?.teamId) userForm.teamId = currentUser.value.teamId
}

const editUser = (user) => {
  if (isBuiltInAdmin(user)) {
    notifyUser('warning', 'admin 是系统内置账户，不能编辑。')
    return
  }
  if (!canManageUser(user)) {
    notifyUser('warning', getManageDisabledReason(user) || '无权编辑该用户。')
    return
  }
  userDialog.open(user)
  Object.assign(userForm, {
    userId: user.userId,
    userName: user.userName,
    privilege: user.privilege || 'normal',
    teamId: user.teamId,
    status: isBuiltInAdmin(user) ? 1 : normalizeUserStatus(user.status)
  })
}

const defaultUserForm = createUserForm()

const closeUserDialog = () => {
  userDialog.close()
  resetFormUtil(userFormRef, userForm, defaultUserForm)
}

const submitUser = async () => {
  // 验证表单
  if (!await validateForm(userFormRef)) return

  const editing = isEdit.value

  await executeRequest(
    () => {
      // 构建用户数据，排除确认密码字段
      const userData = omitFields(userForm, ['confirmPassword'])
      userData.status = normalizeUserStatus(userData.status)
      if (editing && isBuiltInAdmin(userData)) {
        const originalUser = userDialog.currentItem.value || {}
        userData.privilege = originalUser.privilege || 'admin'
        userData.teamId = originalUser.teamId || ''
        userData.status = 1
      }

      if (!editing) {
        userData.userId = uuidV4()
      } else {
        // 编辑时排除密码字段（如果为空）
        delete userData.password
      }
      return editing ? updateUserApi(userData) : addUserApi(userData)
    },
    {
      loadingRef: submitting,
      successMessage: null, // 使用ElNotification，不显示ElMessage
      errorMessage: null,
      onSuccess: () => {
        notifyUser('success', editing ? '用户更新成功！' : '用户添加成功！')
        closeUserDialog()
        return getAllUsers()
      },
      onError: (error) => {
        notifyUser('error', error?.message || (editing ? '用户更新失败！' : '用户添加失败！'))
      }
    }
  ).catch(() => false)
}

const deleteUser = async (user) => {
  if (isBuiltInAdmin(user)) {
    notifyUser('warning', 'admin 是系统内置账户，不能删除。')
    return
  }
  if (!canManageUser(user)) {
    notifyUser('warning', getManageDisabledReason(user) || '无权删除该用户。')
    return
  }

  await executeDeleteWithConfirm(
    () => deleteUserApi({ id: user.userId }),
    {
      title: '删除确认',
      message: `确定要删除用户 "${user.userName || '未知用户'}" 吗？此操作不可撤销。`,
      successMessage: null, // 使用ElNotification
      errorMessage: null,
      onSuccess: () => {
        notifyUser('success', '用户删除成功！')
        return getAllUsers()
      },
      onError: () => {
        notifyUser('error', '用户删除失败！')
      }
    }
  )
}

const resetPassword = (user) => {
  if (!canManageUser(user)) {
    notifyUser('warning', getManageDisabledReason(user) || '无权重置该用户密码。')
    return
  }
  resetForm.userId = user.userId
  resetForm.newPassword = ''
  resetForm.confirmPassword = ''
  resetPasswordDialog.open()
}

const submitResetPassword = async () => {
  // 验证表单
  if (!await validateForm(resetFormRef)) return

  await executeRequest(
    () =>
      resetUserPasswordApi({
        userId: resetForm.userId,
        newPassword: resetForm.newPassword
      }),
    {
      loadingRef: resetting,
      successMessage: null, // 使用ElNotification
      errorMessage: null,
      onSuccess: () => {
        notifyUser('success', '密码重置成功！')
        resetPasswordDialog.close()
      },
      onError: (error) => {
        notifyUser('error', error?.message || '密码重置失败！')
      }
    }
  ).catch(() => false)
}

const exportUsers = async () => {
  const confirmed = await confirmAction({
    title: '导出确认',
    message: '确定要导出当前用户列表吗？',
    type: 'info'
  })

  if (!confirmed) return

  exportTsv(filteredUsers.value, `admin-users-${Date.now()}`, [
    { label: 'User ID', key: 'userId' },
    { label: 'Username', key: 'userName' },
    { label: 'Role', key: 'privilege' },
    { label: 'Team', key: 'teamId' },
    { label: 'Status', key: user => formatUserStatus(user.status) },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Created At', key: 'createTime' },
    { label: 'Last Login', key: 'lastLoginTime' }
  ])
}

const canManageUser = (user) => canManageUserForActor(user, actorContext.value)

const canEditUser = (user) => canEditUserForActor(user, actorContext.value)

const getManageDisabledReason = (user) => getManageDisabledReasonForActor(user, actorContext.value)

const getEditDisabledReason = (user) => getEditDisabledReasonForActor(user, actorContext.value)

// 生命周期
onMounted(async () => {
  try {
    await fetchAuth()
    refreshData()
  } catch {
    showError('初始化数据失败')
  }
})
</script>

<style scoped>
.user-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}

.toolbar-search {
  width: min(380px, 100%);
}

.toolbar-filter {
  width: 140px;
}

.total-users .metric-icon {
  background: color-mix(in srgb, var(--el-color-primary) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-primary);
}

.admin-users .metric-icon {
  background: color-mix(in srgb, var(--el-color-danger) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-danger);
}

.leader-users .metric-icon {
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-warning);
}

.normal-users .metric-icon {
  background: color-mix(in srgb, var(--el-color-success) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-success);
}

.team-users .metric-icon {
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--el-bg-color-overlay));
  color: var(--el-color-warning);
}

.users-table {
  flex: 1;
  min-height: 0;
}

.users-table :deep(.el-table__header th) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 650;
  background: var(--el-fill-color-light) !important;
}

.users-table :deep(.el-table__row td) {
  padding: 10px 0;
}

.user-id {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--el-font-size-extra-small);
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
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.no-team {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.row-actions :deep(.el-button) {
  margin-left: 0;
  padding: 4px 6px;
}

@media (max-width: 768px) {
  .user-manager {
    gap: 14px;
  }

  .toolbar-search,
  .toolbar-filter {
    width: 100%;
  }

  :deep(.admin-toolbar__actions),
  :deep(.admin-workspace-panel__actions) {
    width: 100%;
  }

  :deep(.admin-toolbar__actions .el-button),
  :deep(.admin-workspace-panel__actions .el-button) {
    flex: 1;
  }
}
</style>
