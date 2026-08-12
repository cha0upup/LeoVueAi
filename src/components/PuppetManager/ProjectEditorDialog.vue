<template>
  <el-dialog
    v-model="visible"
    width="560px"
    draggable
    class="project-editor-dialog"
    @closed="reset"
  >
    <template #header>
      <div class="project-dialog-title">
        <span class="project-dialog-title__icon">
          <el-icon><Icon :icon="editing ? iconMap.settings : iconMap.folderAdd" /></el-icon>
        </span>
        <span>
          <strong>{{ editing ? '项目设置' : '新建项目' }}</strong>
          <small>{{ editing ? '维护项目信息、可见范围与生命周期' : '创建独立的主机与会话工作区' }}</small>
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
      </div>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
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
            type="button"
            class="permission-card"
            :class="{ selected: form.permission === 'private' }"
            @click="form.permission = 'private'"
          >
            <span class="permission-card__icon"><el-icon><Icon :icon="iconMap.lock" /></el-icon></span>
            <span><strong>仅自己</strong><small>只有项目负责人和管理员可查看与维护</small></span>
            <span class="permission-card__radio"><i /></span>
          </button>
          <button
            type="button"
            class="permission-card"
            :class="{ selected: form.permission === 'team' }"
            @click="form.permission = 'team'"
          >
            <span class="permission-card__icon"><el-icon><Icon icon="mdi:account-group-outline" /></el-icon></span>
            <span><strong>团队协作</strong><small>同团队成员可查看并整理项目主机</small></span>
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
    </el-form>

    <template #footer>
      <div class="project-dialog-actions">
        <button
          v-if="editing && form.status !== 'archived'"
          type="button"
          class="project-lifecycle-action archive"
          @click="archive"
        >
          <el-icon><Icon icon="mdi:archive-arrow-down-outline" /></el-icon>归档
        </button>
        <button
          v-if="editing && form.status === 'archived'"
          type="button"
          class="project-lifecycle-action restore"
          @click="restore"
        >
          <el-icon><Icon icon="mdi:archive-arrow-up-outline" /></el-icon>恢复项目
        </button>
        <span class="project-dialog-actions__spacer" />
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="save"
        >
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessageBox } from 'element-plus'

import { addProjectApi, archiveProjectApi, updateProjectApi } from '@/services/api.js'
import { showSuccess } from '@/utils/messageUtils.js'
import { icons } from '@/utils/icons.js'

const emit = defineEmits(['saved'])
const iconMap = icons
const visible = ref(false)
const editing = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({
  projectId: '',
  projectName: '',
  projectCode: '',
  description: '',
  permission: 'private',
  status: 'active',
  teamId: ''
})
const rules = { projectName: [{ required: true, message: '请输入项目名称', trigger: 'blur' }] }

const reset = () => {
  Object.assign(form, {
    projectId: '',
    projectName: '',
    projectCode: '',
    description: '',
    permission: 'private',
    status: 'active',
    teamId: ''
  })
  editing.value = false
  formRef.value?.clearValidate?.()
}

const open = (project = null) => {
  reset()
  if (project) {
    editing.value = true
    Object.assign(form, project)
  }
  visible.value = true
}

const save = async () => {
  await formRef.value?.validate?.()
  saving.value = true
  try {
    const response = editing.value ? await updateProjectApi(form) : await addProjectApi(form)
    showSuccess(editing.value ? '项目已更新' : '项目已创建')
    visible.value = false
    emit('saved', response.data)
  } finally {
    saving.value = false
  }
}

const archive = async () => {
  try {
    await ElMessageBox.confirm(
      '归档后保留项目数据，但项目会停止接收新主机和新会话。',
      '归档项目',
      { confirmButtonText: '确认归档', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  saving.value = true
  try {
    const response = await archiveProjectApi(form.projectId)
    showSuccess('项目已归档')
    visible.value = false
    emit('saved', response.data)
  } finally {
    saving.value = false
  }
}

const restore = async () => {
  saving.value = true
  try {
    form.status = 'active'
    const response = await updateProjectApi(form)
    showSuccess('项目已恢复')
    visible.value = false
    emit('saved', response.data)
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.project-dialog-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-dialog-title__icon {
  width: 36px;
  height: 36px;
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

.project-dialog-title small,
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
</style>
