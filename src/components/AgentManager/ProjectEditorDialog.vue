<template>
  <el-dialog
    v-model="visible"
    width="var(--dialog-width-sm)"
    align-center
    draggable
    class="project-editor-dialog workbench-dialog"
    :show-close="!busy"
    :close-on-click-modal="!busy"
    :close-on-press-escape="!busy"
    :before-close="requestClose"
  >
    <template #header="{ titleId }">
      <div class="project-dialog-title">
        <span class="project-dialog-title__icon">
          <el-icon><Icon :icon="editing ? iconMap.settings : iconMap.folderAdd" /></el-icon>
        </span>
        <span>
          <strong :id="titleId">{{ editing ? '项目设置' : '新建项目' }}</strong>
        </span>
      </div>
    </template>

    <div
      v-if="editing"
      class="project-status-banner"
      :class="form.status"
    >
      <span class="project-status-banner__dot" />
      <div>
        <strong>{{ form.status === 'archived' ? '项目已归档' : '项目进行中' }}</strong>
        <small>
          {{ form.status === 'archived' ? '保留已有主机和会话记录，当前工作区按只读方式展示' : '可继续整理主机并创建项目会话' }}
        </small>
        <small>归档和恢复只变更状态，其他修改请单独保存。</small>
      </div>
    </div>

    <el-form
      :id="formId"
      ref="formRef"
      :model="form"
      :rules="rules"
      :disabled="busy"
      label-position="top"
      @submit.prevent="save"
    >
      <div class="project-form-grid">
        <el-form-item
          label="项目名称"
          prop="projectName"
        >
          <el-input
            v-model="form.projectName"
            maxlength="100"
            placeholder="例如：客户门户升级"
          />
        </el-form-item>
        <el-form-item label="项目编码">
          <el-input
            v-model="form.projectCode"
            maxlength="50"
            placeholder="例如 ACME-2026"
          />
        </el-form-item>
      </div>
      <el-form-item
        label="可见范围"
        prop="permission"
      >
        <div class="permission-options">
          <button
            v-for="option in permissionOptions"
            :key="option.value"
            type="button"
            class="permission-card"
            :class="{ selected: form.permission === option.value }"
            :disabled="busy"
            @click="form.permission = option.value"
          >
            <span class="permission-card__icon"><el-icon><Icon :icon="option.icon" /></el-icon></span>
            <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
            <span class="permission-card__radio"><i /></span>
          </button>
        </div>
      </el-form-item>
      <el-form-item label="项目说明">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="1000"
          show-word-limit
          placeholder="记录项目目标、范围或交接说明"
        />
      </el-form-item>
      <el-form-item
        v-if="canTransferOwner"
        label="项目负责人"
      >
        <el-button
          v-if="!ownerTransfer"
          :disabled="busy"
          @click="openOwnerTransfer"
        >
          交接负责人
        </el-button>
        <div
          v-else
          class="project-owner-transfer"
        >
          <el-alert
            v-if="ownerTransfer.error"
            :title="ownerTransfer.error"
            type="error"
            :closable="false"
            show-icon
          />
          <el-select
            v-model="ownerTransfer.newOwnerUserId"
            aria-label="接任账号"
            filterable
            placeholder="选择接任账号"
            no-data-text="暂无可接任的已启用账号"
            :loading="ownerTransfer.loading"
            :disabled="ownerTransfer.loading || Boolean(ownerTransfer.error) || busy"
          >
            <el-option
              v-for="account in ownerTransfer.accounts"
              :key="account.userId"
              :label="account.userName || account.userId"
              :value="account.userId"
            />
          </el-select>
          <el-button
            v-if="ownerTransfer.error"
            type="primary"
            plain
            :disabled="busy"
            @click="loadOwnerOptions"
          >
            重新加载
          </el-button>
          <el-button
            v-else
            type="primary"
            :disabled="!ownerTransfer.newOwnerUserId || busy"
            @click="confirmOwnerTransfer"
          >
            提交交接
          </el-button>
          <el-button
            text
            :disabled="busy"
            @click="closeOwnerTransfer"
          >
            取消交接
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="project-dialog-actions">
        <button
          v-if="editing"
          type="button"
          class="project-lifecycle-action delete"
          :disabled="busy"
          @click="remove"
        >
          <el-icon><Icon icon="mdi:trash-can-outline" /></el-icon>删除项目
        </button>
        <button
          v-if="editing && form.status !== 'archived'"
          type="button"
          class="project-lifecycle-action archive"
          :disabled="busy"
          @click="archive"
        >
          <el-icon><Icon icon="mdi:archive-arrow-down-outline" /></el-icon>归档
        </button>
        <button
          v-if="editing && form.status === 'archived'"
          type="button"
          class="project-lifecycle-action restore"
          :disabled="busy"
          @click="restore"
        >
          <el-icon><Icon icon="mdi:archive-arrow-up-outline" /></el-icon>恢复项目
        </button>
        <span class="project-dialog-actions__spacer" />
        <el-button
          :disabled="busy"
          @click="requestClose()"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          :form="formId"
          :loading="saving"
          :disabled="!canSave"
        >
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onScopeDispose, reactive, ref, shallowRef, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'

import {
  addProjectApi,
  archiveProjectApi,
  deleteProjectApi,
  restoreProjectApi,
  transferProjectApi,
  updateProjectApi
} from '@/services/api/projects.js'
import { getEnabledUserOptionsApi } from '@/services/api/admin.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'
import { useAuth } from '@/composables/useAuth.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { showSuccess } from '@/utils/messageUtils.js'
import { icons as iconMap } from '@/utils/icons.js'

const emit = defineEmits(['saved'])
const { isAdmin } = useAuth()
const permissionOptions = [
  { value: 'private', label: '仅自己', description: '只有项目负责人和管理员可查看与维护', icon: iconMap.lock },
  { value: 'team', label: '团队协作', description: '同团队成员可查看并整理项目主机', icon: 'mdi:account-group-outline' }
]
const visible = ref(false)
const editing = ref(false)
const activeAction = shallowRef(null)
const busy = computed(() => activeAction.value !== null)
const saving = computed(() => busy.value && activeAction.value.kind !== 'discard')
const formId = useId()
const formRef = ref(null)
const ownerTransfer = ref(null)
let ownerOptionsRequest
let disposed = false
const createForm = () => ({
  projectId: '',
  projectName: '',
  projectCode: '',
  description: '',
  permission: 'private',
  status: 'active',
  ownerUserId: '',
  teamId: ''
})
const form = reactive(createForm())
const details = computed(() => ({
  projectName: form.projectName ?? '',
  projectCode: form.projectCode ?? '',
  description: form.description ?? '',
  permission: form.permission
}))
const initialDetails = shallowRef(details.value)
const hasChanges = computed(() => Object.keys(initialDetails.value)
  .some(field => details.value[field] !== initialDetails.value[field]))
const canSave = computed(() => !busy.value && (!editing.value || hasChanges.value))
const canTransferOwner = computed(() => isAdmin.value && editing.value && Boolean(form.projectId && form.ownerUserId))
const rules = { projectName: [{ required: true, message: '请输入项目名称', trigger: 'blur' }] }

function closeOwnerTransfer() {
  ownerOptionsRequest?.abort()
  ownerOptionsRequest = undefined
  ownerTransfer.value = null
}

watch([visible, isAdmin], ([isOpen, admin]) => {
  if (!isOpen) activeAction.value = null
  if (!isOpen || !admin) closeOwnerTransfer()
}, { flush: 'sync' })
onScopeDispose(() => {
  disposed = true
  activeAction.value = null
  closeOwnerTransfer()
})

const open = (project = null) => {
  activeAction.value = null
  closeOwnerTransfer()
  Object.assign(form, createForm(), project)
  initialDetails.value = details.value
  editing.value = Boolean(project)
  formRef.value?.clearValidate?.()
  visible.value = true
}

async function requestClose(done) {
  if (disposed || !visible.value || busy.value) return
  if (hasChanges.value) {
    const action = { kind: 'discard' }
    const generation = sessionGeneration.value
    activeAction.value = action
    try {
      const discard = await confirmAction({
        title: '放弃项目修改？',
        message: '当前有未保存的项目资料，关闭后将丢弃这些修改。',
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑'
      })
      if (!discard || activeAction.value !== action || !isCurrentSession(generation)) return
    } finally {
      if (activeAction.value === action) activeAction.value = null
    }
  }
  done?.()
  visible.value = false
}

const runAction = async (request, { successMessage, errorMessage, selectProject = true, statusOnly = false }) => {
  if (!visible.value || busy.value) return
  const action = {}
  const generation = sessionGeneration.value
  activeAction.value = action
  const isCurrent = () => activeAction.value === action && isCurrentSession(generation)
  try {
    const response = await request(isCurrent)
    if (!response || disposed || !isCurrentSession(generation)) return
    if (!isCurrent()) {
      // The write committed, but a different editor is now open. Refresh without switching projects.
      emit('saved')
      return
    }
    if (statusOnly) form.status = response.data.status
    else visible.value = false
    showSuccess(successMessage)
    if (selectProject) emit('saved', response.data)
    else emit('saved')
  } catch (error) {
    if (isCurrent()) handleError(error, { defaultMessage: errorMessage })
  } finally {
    if (activeAction.value === action) activeAction.value = null
  }
}

const isCurrentTransfer = (transfer) =>
  visible.value && canTransferOwner.value && ownerTransfer.value === transfer

const openOwnerTransfer = () => {
  if (!visible.value || !canTransferOwner.value || ownerTransfer.value || busy.value) return
  ownerTransfer.value = { accounts: [], newOwnerUserId: '', loading: false, error: '' }
  return loadOwnerOptions()
}

async function loadOwnerOptions() {
  const transfer = ownerTransfer.value
  if (!transfer || !isCurrentTransfer(transfer) || transfer.loading || busy.value) return
  const request = new AbortController()
  ownerOptionsRequest = request
  transfer.loading = true
  transfer.error = ''
  try {
    const { data } = await getEnabledUserOptionsApi({ signal: request.signal })
    if (request.signal.aborted || !isCurrentTransfer(transfer)) return
    if (!Array.isArray(data)) throw new Error('接任账号响应格式异常')
    transfer.accounts = data.filter(account => account?.userId && account.userId !== form.ownerUserId)
  } catch (error) {
    if (!request.signal.aborted && isCurrentTransfer(transfer)) {
      transfer.error = handleError(error, { defaultMessage: '加载接任账号失败，请重试', showMessage: false })
    }
  } finally {
    if (ownerOptionsRequest === request) ownerOptionsRequest = undefined
    transfer.loading = false
  }
}

const confirmOwnerTransfer = () => {
  const transfer = ownerTransfer.value
  if (!transfer || !isCurrentTransfer(transfer)) return
  const recipient = transfer.accounts.find(account => account.userId === transfer.newOwnerUserId)
  if (!recipient) return
  const { projectId, projectName } = form
  return runAction(async (isCurrent) => {
    const confirmed = await confirmAction({
      title: '交接项目负责人',
      message: `将项目“${projectName}”交接给“${recipient.userName || recipient.userId}”？共享团队和归档状态保持原样，其他未保存的修改将丢弃。`,
      confirmButtonText: '确认交接'
    })
    if (confirmed && isCurrent() && isCurrentTransfer(transfer)) return transferProjectApi(projectId, recipient.userId)
  }, { successMessage: '项目负责人已交接', errorMessage: '项目交接失败，请重试' })
}

const save = () => {
  if (!canSave.value) return
  const updating = editing.value
  return runAction(async (isCurrent) => {
    if (!formRef.value || !await formRef.value.validate().catch(() => false) || !isCurrent()) return
    return updating ? updateProjectApi({ projectId: form.projectId, ...details.value }) : addProjectApi(details.value)
  }, {
    successMessage: updating ? '项目已更新' : '项目已创建',
    errorMessage: updating ? '更新项目失败' : '创建项目失败'
  })
}

const archive = () => {
  const { projectId, projectName } = form
  return runAction(async (isCurrent) => {
    const confirmed = await confirmAction({
      title: '归档项目',
      message: `归档“${projectName}”后将保留项目数据，但项目会停止接收新主机和新会话。`,
      confirmButtonText: '确认归档'
    })
    if (confirmed && isCurrent()) return archiveProjectApi(projectId)
  }, { successMessage: '项目已归档', errorMessage: '归档项目失败', statusOnly: true })
}

const remove = () => {
  const { projectId, projectName } = form
  return runAction(async (isCurrent) => {
    const confirmed = await confirmAction({
      title: '删除项目',
      message: `删除项目“${projectName}”后，主机资产和会话仍会保留，但项目归属将被解除。此操作不可恢复。`,
      confirmButtonText: '确认删除',
      type: 'error'
    })
    if (confirmed && isCurrent()) return deleteProjectApi(projectId)
  }, { successMessage: '项目已删除', errorMessage: '删除项目失败', selectProject: false })
}

const restore = () => runAction(() => restoreProjectApi(form.projectId), {
  successMessage: '项目已恢复',
  errorMessage: '恢复项目失败',
  statusOnly: true
})

defineExpose({ open })
</script>

<style scoped>
.project-dialog-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-dialog-title__icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.project-dialog-title > span:last-child,
.project-status-banner > div,
.permission-card > span:nth-child(2) {
  display: flex;
  flex-direction: column;
}

.project-dialog-title strong {
  font-size: 15px;
}

.project-status-banner small,
.permission-card small {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.project-status-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  margin-bottom: 16px;
  border-radius: 8px;
  color: var(--el-color-success-dark-2);
  background: color-mix(in srgb, var(--el-color-success) 8%, var(--app-control-background-soft));
}

.project-status-banner.archived {
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
}

.project-status-banner__dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
}

.project-status-banner strong {
  font-size: 12px;
}

.project-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 12px;
}

.project-owner-transfer {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-owner-transfer .el-select {
  flex: 1 1 180px;
}

.project-owner-transfer .el-button + .el-button {
  margin-left: 0;
}

.permission-options {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.permission-card {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-divider-color);
  border-radius: 9px;
  background: var(--app-card-background);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}

.permission-card:hover,
.permission-card.selected {
  border-color: color-mix(in srgb, var(--el-color-primary) 55%, var(--el-border-color));
}

.permission-card.selected {
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--app-card-background));
}

.permission-card__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.permission-card strong {
  font-size: 12px;
}

.permission-card__radio {
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--el-border-color-darker);
  border-radius: 50%;
}

.permission-card.selected .permission-card__radio {
  border-color: var(--el-color-primary);
}

.permission-card.selected .permission-card__radio i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
.project-dialog-actions {
  width: 100%;
  display: flex;
  align-items: center;
}
.project-dialog-actions__spacer {
  flex: 1;
}

.project-lifecycle-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 0;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.project-lifecycle-action.archive {
  color: var(--el-color-warning-dark-2);
}

.project-lifecycle-action.restore {
  color: var(--el-color-success-dark-2);
}

.project-lifecycle-action.delete {
  color: var(--el-color-danger);
}

.project-lifecycle-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
