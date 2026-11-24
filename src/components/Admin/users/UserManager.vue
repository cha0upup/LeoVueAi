<template>
  <div class="user-manager">
    <PageHeader
      title="用户管理"
      :icon="iconMap.user"
    >
      <template #actions>
        <el-button
          type="primary"
          :disabled="actionsDisabled"
          @click="openAddDialog"
        >
          <el-icon><Icon :icon="iconMap.plus" /></el-icon>
          新增用户
        </el-button>
      </template>
    </PageHeader>
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
          :disabled="mutationBusy"
          :loading="loading"
          @click="refreshData"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          刷新
        </el-button>
      </template>
    </AdminToolbar>

    <StatsStrip :columns="5">
      <article
        v-for="card in statsCardConfigs"
        :key="card.key"
        class="metric-card"
      >
        <span class="metric-label">{{ card.label }}</span>
        <strong class="metric-value">{{ stats[card.key] }}</strong>
      </article>
    </StatsStrip>

    <AdminWorkspacePanel title="用户列表">
      <template #tags>
        <el-tag effect="light">
          筛选结果 {{ filteredUsers.length }}
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
        :data="filteredUsers"
        class="users-table"
        :empty-text="emptyText"
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
                :disabled="actionsDisabled || !canEditUser(row)"
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
                :disabled="actionsDisabled || !canManageUser(row)"
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
                :disabled="actionsDisabled || !canManageUser(row) || isBuiltInAdmin(row)"
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
      :form-state="userForm"
      :rules="userRules"
      :teams="teams"
      :is-admin="isAdmin"
      :is-leader="isLeader"
      :submitting="submitting"
      @submit="submitUser"
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
import PageHeader from '@/components/common/PageHeader.vue'
import { ref, reactive, computed, onMounted, onScopeDispose, watch } from 'vue'
import { AUTH_FIELD_LIMITS } from '@/constants/app.js'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { executeRequest, withLoading } from '@/utils/apiUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { confirmDelete, confirmAction } from '@/utils/confirmUtils.js'
import { useEditDialog, useDialog } from '@/utils/dialogUtils.js'
import { createPasswordRules, createPasswordMatchValidator, validateForm } from '@/utils/formUtils.js'
import {
  addUserApi,
  deleteUserApi,
  getAllUsersApi,
  getAllTeamsApi,
  updateUserApi,
  resetUserPasswordApi
} from '@/services/api/admin.js'
import { showWarning } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'
import { useAuth } from '@/composables/useAuth.js'
import AdminToolbar from '@/components/Admin/shared/AdminToolbar.vue'
import StatsStrip from '@/components/common/StatsStrip.vue'
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
  { key: 'total', label: '用户总数' },
  { key: 'admin', label: '管理员' },
  { key: 'leader', label: '队长' },
  { key: 'normal', label: '普通用户' },
  { key: 'assignedToTeam', label: '已归属团队' }
]

const { currentUser, isAdmin, isLeader, fetchAuth } = useAuth()

// 响应式数据
const loading = ref(false)
const submitting = ref(false)
const resetting = ref(false)
const deleting = ref(false)
const listError = ref('')
const mutationBusy = computed(() => submitting.value || resetting.value || deleting.value)
const actionsDisabled = computed(() => loading.value || mutationBusy.value || Boolean(listError.value))
let directoryRequest
let disposed = false

// 使用对话框工具
const userDialog = useEditDialog()
const userDialogVisible = userDialog.visible
const isEdit = computed(() => !!userDialog.currentItem.value)
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

const emptyText = computed(() => {
  if (loading.value) return '正在加载…'
  if (listError.value) return '请刷新后重试'
  return userData.value.length ? '没有匹配的用户' : '暂无用户'
})

const loadDirectory = async (includeTeams) => {
  directoryRequest?.abort()
  const request = new AbortController()
  directoryRequest = request
  const { signal } = request
  loading.value = true
  listError.value = ''
  try {
    const [usersResponse, teamsResponse] = await Promise.all([
      getAllUsersApi({ signal }),
      includeTeams ? getAllTeamsApi({ signal }) : null
    ])
    if (signal.aborted) return
    if (!Array.isArray(usersResponse.data) || (includeTeams && !Array.isArray(teamsResponse.data))) {
      throw new Error('用户目录响应格式异常')
    }
    userData.value = usersResponse.data
    if (includeTeams) teams.value = teamsResponse.data
  } catch (error) {
    if (signal.aborted) return
    request.abort()
    listError.value = handleError(error, { defaultMessage: '加载用户目录失败，请重试', showMessage: false })
  } finally {
    if (directoryRequest === request) {
      directoryRequest = undefined
      loading.value = false
    }
  }
}

const refreshData = () => loadDirectory(true)

const openAddDialog = () => {
  if (actionsDisabled.value || userDialogVisible.value || resetPasswordVisible.value) return
  Object.assign(userForm, createUserForm())
  // 队长创建用户时预填充其团队，写入时仍由后端判断归属。
  if (isLeader.value && currentUser.value?.teamId) userForm.teamId = currentUser.value.teamId
  userDialog.open()
}

const editUser = (user) => {
  if (actionsDisabled.value || userDialogVisible.value || resetPasswordVisible.value) return
  if (!canEditUser(user)) {
    showWarning(getEditDisabledReason(user))
    return
  }
  Object.assign(userForm, createUserForm(), {
    userId: user.userId,
    userName: user.userName,
    privilege: user.privilege || 'normal',
    teamId: user.teamId,
    status: normalizeUserStatus(user.status)
  })
  userDialog.open(user)
}

watch(userDialogVisible, (visible) => {
  if (visible) return
  userDialog.close()
  Object.assign(userForm, createUserForm())
  userFormRef.value?.clearValidate?.()
}, { flush: 'sync' })

watch(resetPasswordVisible, (visible) => {
  if (visible) return
  Object.assign(resetForm, createPasswordResetForm())
  resetFormRef.value?.clearValidate?.()
}, { flush: 'sync' })

const submitUser = () => {
  if (!userDialogVisible.value || actionsDisabled.value) return
  return withLoading(submitting, async () => {
    if (!await validateForm(userFormRef) || disposed || !userDialogVisible.value) return
    const editing = isEdit.value
    const fields = {
      privilege: userForm.privilege,
      teamId: userForm.teamId,
      status: normalizeUserStatus(userForm.status)
    }

    await executeRequest(
      () => editing
        ? updateUserApi({ userId: userForm.userId, ...fields })
        : addUserApi({ userName: userForm.userName.trim(), password: userForm.password, ...fields }),
      {
        successMessage: editing ? '用户已更新' : '用户已创建',
        errorMessage: editing ? '更新用户失败' : '创建用户失败',
        onSuccess: async () => {
          userDialog.close()
          if (!disposed) await loadDirectory(false)
        }
      }
    ).catch(() => false)
  })
}

const deleteUser = (user) => {
  if (actionsDisabled.value || userDialogVisible.value || resetPasswordVisible.value) return
  if (isBuiltInAdmin(user) || !canManageUser(user)) {
    showWarning(isBuiltInAdmin(user) ? '系统内置 admin 禁止删除' : getManageDisabledReason(user))
    return
  }

  const { userId, userName } = user
  return withLoading(deleting, async () => {
    const confirmed = await confirmDelete({
      title: '删除确认',
      message: `确定要删除用户「${userName || '未知用户'}」吗？此操作不可撤销。`
    })
    if (!confirmed || disposed) return
    await executeRequest(() => deleteUserApi({ id: userId }), {
      successMessage: '用户已删除',
      errorMessage: '删除用户失败',
      onSuccess: () => { if (!disposed) return loadDirectory(false) }
    }).catch(() => false)
  })
}

const resetPassword = (user) => {
  if (actionsDisabled.value || userDialogVisible.value || resetPasswordVisible.value) return
  if (!canManageUser(user)) {
    showWarning(getManageDisabledReason(user))
    return
  }
  Object.assign(resetForm, createPasswordResetForm(), { userId: user.userId })
  resetPasswordDialog.open()
}

const submitResetPassword = () => {
  if (!resetPasswordVisible.value || actionsDisabled.value) return
  return withLoading(resetting, async () => {
    if (!await validateForm(resetFormRef) || disposed || !resetPasswordVisible.value) return
    const { userId, newPassword } = resetForm
    await executeRequest(() => resetUserPasswordApi({ userId, newPassword }), {
      successMessage: '密码已重置',
      errorMessage: '重置密码失败',
      onSuccess: resetPasswordDialog.close
    }).catch(() => false)
  })
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

onMounted(async () => {
  try {
    await fetchAuth()
    if (!disposed) await refreshData()
  } catch (error) {
    if (!disposed) listError.value = handleError(error, { defaultMessage: '初始化用户目录失败', showMessage: false })
  }
})

onScopeDispose(() => {
  disposed = true
  directoryRequest?.abort()
  Object.assign(userForm, createUserForm())
  Object.assign(resetForm, createPasswordResetForm())
})
</script>

<style scoped>
.user-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow: auto;
}

.toolbar-search {
  width: min(380px, 100%);
}

.toolbar-filter {
  width: 140px;
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
