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
          label="全部角色"
          value=""
        />
        <el-option
          label="管理员"
          value="admin"
        />
        <el-option
          label="队长"
          value="leader"
        />
        <el-option
          label="普通用户"
          value="normal"
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
          :key="team.id"
          :label="team.teamname || team.teamName"
          :value="team.id"
        />
      </el-select>

      <template #actions>
        <el-button
          :disabled="!filteredUsers || filteredUsers.length === 0"
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
      <article class="metric-card total-users">
        <span class="metric-icon"><el-icon><Icon :icon="iconMap.user" /></el-icon></span>
        <div>
          <strong class="metric-value">{{ stats.total }}</strong>
          <span class="metric-label">用户总数</span>
        </div>
      </article>
      <article class="metric-card admin-users">
        <span class="metric-icon"><el-icon><Icon :icon="iconMap.userFilled" /></el-icon></span>
        <div>
          <strong class="metric-value">{{ stats.admin }}</strong>
          <span class="metric-label">管理员</span>
        </div>
      </article>
      <article class="metric-card leader-users">
        <span class="metric-icon"><el-icon><Icon :icon="iconMap.userFilled" /></el-icon></span>
        <div>
          <strong class="metric-value">{{ stats.leader }}</strong>
          <span class="metric-label">队长</span>
        </div>
      </article>
      <article class="metric-card normal-users">
        <span class="metric-icon"><el-icon><Icon :icon="iconMap.avatar" /></el-icon></span>
        <div>
          <strong class="metric-value">{{ stats.normal }}</strong>
          <span class="metric-label">普通用户</span>
        </div>
      </article>
      <article class="metric-card team-users">
        <span class="metric-icon"><el-icon><Icon :icon="iconMap.userFilled" /></el-icon></span>
        <div>
          <strong class="metric-value">{{ stats.assignedToTeam }}</strong>
          <span class="metric-label">已归属团队</span>
        </div>
      </article>
    </AdminStatsGrid>

    <AdminWorkspacePanel title="用户列表">
      <template #tags>
        <el-tag effect="light">
          筛选结果 {{ filteredUsers?.length || 0 }}
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
        :data="filteredUsers || []"
        class="users-table"
        empty-text="暂无用户"
      >
        <el-table-column
          prop="id"
          label="用户ID"
          min-width="150"
        >
          <template #default="{ row }">
            <el-tooltip
              :content="row.id"
              placement="top"
            >
              <span class="user-id">{{ row.id || '未知ID' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column
          prop="username"
          label="用户名"
          min-width="180"
        >
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar
                :size="32"
                class="user-avatar"
              >
                {{ (row.username || 'U').charAt(0).toUpperCase() }}
              </el-avatar>
              <span class="username">{{ row.username || '未知用户' }}</span>
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
          prop="teamname"
          label="所属团队"
          min-width="150"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.teamname"
              type="info"
              size="small"
              effect="plain"
            >
              {{ row.teamname }}
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
      @form-ready="setUserFormRef"
    />

    <UserPasswordResetDialog
      v-model="resetPasswordVisible"
      :form-state="resetForm"
      :rules="resetRules"
      :resetting="resetting"
      @submit="submitResetPassword"
      @form-ready="setResetFormRef"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElNotification } from 'element-plus'
import { v4 as uuidV4 } from 'uuid'
import { AUTH_FIELD_LIMITS } from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { executeDeleteWithConfirm, confirmAction } from '@/utils/confirmUtils.js'
import { omitFields } from '@/utils/dataUtils.js'
import { useEditDialog, useDialog } from '@/utils/dialogUtils.js'
import { validateForm, handleFormSubmit, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { addUserApi, deleteUserApi, getAllUsersApi, getAllTeamsApi, updateUserApi, resetUserPasswordApi } from '@/services/api.js'
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
  normalizeTeamRecord,
  normalizeUserRecord,
  normalizeUserStatus,
  userStats
} from './userManagerModel.js'

const iconMap = icons

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
const setUserFormRef = (instance) => {
  userFormRef.value = instance
}
const setResetFormRef = (instance) => {
  resetFormRef.value = instance
}

const userForm = reactive(createUserForm())
const resetForm = reactive(createPasswordResetForm())

// 表单验证规则
const userRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      max: AUTH_FIELD_LIMITS.usernameMaxLength,
      message: `用户名不能超过 ${AUTH_FIELD_LIMITS.usernameMaxLength} 个字符`,
      trigger: 'blur'
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      min: AUTH_FIELD_LIMITS.passwordMinLength,
      max: AUTH_FIELD_LIMITS.passwordMaxLength,
      message: `密码长度在 ${AUTH_FIELD_LIMITS.passwordMinLength} 到 ${AUTH_FIELD_LIMITS.passwordMaxLength} 个字符`,
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== userForm.password) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  privilege: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const resetRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      min: AUTH_FIELD_LIMITS.passwordMinLength,
      max: AUTH_FIELD_LIMITS.passwordMaxLength,
      message: `密码长度在 ${AUTH_FIELD_LIMITS.passwordMinLength} 到 ${AUTH_FIELD_LIMITS.passwordMaxLength} 个字符`,
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== resetForm.newPassword) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
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
const refreshData = async () => {
  await executeRequest(
    async () => {
      await Promise.all([getAllUsers(), getAllTeams()])
    },
    {
      loadingRef: loading,
      errorMessage: '数据刷新失败'
    }
  )
}

const getAllUsers = async () => {
  const response = await getAllUsersApi()
  userData.value = Array.isArray(response?.data)
    ? response.data.map(normalizeUserRecord)
    : []
}

const getAllTeams = async () => {
  const response = await getAllTeamsApi()
  teams.value = Array.isArray(response?.data)
    ? response.data.map(normalizeTeamRecord)
    : []
}

const openAddDialog = () => {
  userDialog.open()
  Object.assign(userForm, defaultUserForm)
  // 队长创建用户时预填充并锁定团队
  if (isLeader.value && currentUser.value?.teamId) {
    userForm.teamname = currentUser.value.teamId
  }
}

const editUser = (user) => {
  if (isBuiltInAdmin(user)) {
    ElNotification({
      title: '禁止操作',
      message: 'admin 是系统内置账户，不能编辑。',
      type: 'warning'
    })
    return
  }
  if (!canManageUser(user)) {
    ElNotification({
      title: '禁止操作',
      message: getManageDisabledReason(user) || '无权编辑该用户。',
      type: 'warning'
    })
    return
  }
  userDialog.open(user)
  Object.assign(userForm, {
    id: user.id,
    username: user.username,
    privilege: user.privilege || 'normal',
    teamname: user.teamname,
    status: isBuiltInAdmin(user) ? 1 : normalizeUserStatus(user.status)
  })
}

const defaultUserForm = createUserForm()

const closeUserDialog = () => {
  userDialog.close()
  resetUserForm()
}

const resetUserForm = () => {
  resetFormUtil(userFormRef, userForm, defaultUserForm)
}

const submitUser = async () => {
  // 验证表单
  const isValid = await validateForm(userFormRef)
  if (!isValid) return

  const editing = isEdit.value

  await handleFormSubmit(
    async () => {
      // 构建用户数据，排除确认密码字段
      const userData = omitFields(userForm, ['confirmPassword'])
      userData.userName = userData.username
      userData.teamId = userData.teamname
      delete userData.username
      delete userData.teamname
      userData.status = normalizeUserStatus(userData.status)
      if (editing && isBuiltInAdmin(userData)) {
        const originalUser = userDialog.currentItem.value || {}
        userData.privilege = originalUser.privilege || 'admin'
        userData.teamId = originalUser.teamname || ''
        userData.status = 1
      }

      if (!editing) {
        userData.userId = uuidV4()
      } else {
        userData.userId = userData.id
        // 编辑时排除密码字段（如果为空）
        delete userData.password
      }
      delete userData.id

      const response = editing
        ? await updateUserApi(userData)
        : await addUserApi(userData)

      return response
    },
    {
      loadingRef: submitting,
      successMessage: null, // 使用ElNotification，不显示ElMessage
      errorMessage: null,
      onSuccess: () => {
        ElNotification({
          title: '成功',
          message: editing ? '用户更新成功！' : '用户添加成功！',
          type: 'success'
        })
        closeUserDialog()
        getAllUsers()
      },
      onError: (error) => {
        ElNotification({
          title: '失败',
          message: error?.message || (editing ? '用户更新失败！' : '用户添加失败！'),
          type: 'error'
        })
      }
    }
  ).catch(() => false)
}

const deleteUser = async (user) => {
  if (isBuiltInAdmin(user)) {
    ElNotification({
      title: '禁止操作',
      message: 'admin 是系统内置账户，不能删除。',
      type: 'warning'
    })
    return
  }
  if (!canManageUser(user)) {
    ElNotification({
      title: '禁止操作',
      message: getManageDisabledReason(user) || '无权删除该用户。',
      type: 'warning'
    })
    return
  }

  await executeDeleteWithConfirm(
    async () => {
      const response = await deleteUserApi({ id: user.id || user.userId })
      if (!response.data) {
        throw new Error('删除失败')
      }
      return response
    },
    {
      title: '删除确认',
      message: `确定要删除用户 "${user.username || '未知用户'}" 吗？此操作不可撤销。`,
      successMessage: null, // 使用ElNotification
      errorMessage: null,
      onSuccess: () => {
        ElNotification({
          title: '成功',
          message: '用户删除成功！',
          type: 'success'
        })
        getAllUsers()
      },
      onError: () => {
        ElNotification({
          title: '失败',
          message: '用户删除失败！',
          type: 'error'
        })
      }
    }
  )
}

const resetPassword = (user) => {
  if (!canManageUser(user)) {
    ElNotification({
      title: '禁止操作',
      message: getManageDisabledReason(user) || '无权重置该用户密码。',
      type: 'warning'
    })
    return
  }
  resetForm.userId = user.id || user.userId
  resetForm.newPassword = ''
  resetForm.confirmPassword = ''
  resetPasswordDialog.open()
}

const submitResetPassword = async () => {
  // 验证表单
  const isValid = await validateForm(resetFormRef)
  if (!isValid) return

  await handleFormSubmit(
    async () => {
      const response = await resetUserPasswordApi({
        userId: resetForm.userId,
        newPassword: resetForm.newPassword
      })

      if (!response.data) {
        throw new Error('重置失败')
      }
      return response
    },
    {
      loadingRef: resetting,
      successMessage: null, // 使用ElNotification
      errorMessage: null,
      onSuccess: () => {
        ElNotification({
          title: '成功',
          message: '密码重置成功！',
          type: 'success'
        })
        resetPasswordDialog.close()
      },
      onError: (error) => {
        ElNotification({
          title: '失败',
          message: error?.message || '密码重置失败！',
          type: 'error'
        })
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
    { label: 'User ID', key: 'id' },
    { label: 'Username', key: 'username' },
    { label: 'Role', key: 'privilege' },
    { label: 'Team', key: 'teamname' },
    { label: 'Status', key: user => formatUserStatus(user.status) },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Created At', key: 'createTime' },
    { label: 'Last Login', key: 'lastLoginTime' }
  ])
}

const canManageUser = (user) => {
  return canManageUserForActor(user, actorContext.value)
}

const canEditUser = (user) => canEditUserForActor(user, actorContext.value)

const getManageDisabledReason = (user) => {
  return getManageDisabledReasonForActor(user, actorContext.value)
}

const getEditDisabledReason = (user) => {
  return getEditDisabledReasonForActor(user, actorContext.value)
}

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
