<template>
  <el-dialog
    v-model="dialogVisible"
    title="重命名"
    width="460px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-rename-dialog file-dialog-shell"
    append-to-body
    @close="handleClose"
    @opened="focusInput"
  >
    <div class="rename-content file-dialog-content">
      <FileOperationSummary
        :name="file.name"
        :path="filePath"
        :icon="fileIconPresentation.icon"
        :icon-color="fileIconPresentation.color"
        :badges="summaryBadges"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="0"
        @submit.prevent="handleSubmit"
      >
        <el-form-item
          prop="newName"
          class="rename-field"
        >
          <div class="field-head">
            <span class="field-label">新名称</span>
          </div>
          <el-input
            ref="inputRef"
            v-model="form.newName"
            placeholder="输入新文件名"
            size="large"
            clearable
            class="name-input"
            @keyup.enter="handleSubmit"
          >
            <template #prefix>
              <el-icon><Icon :icon="file.isDirectory ? iconMap.folder : iconMap.document" /></el-icon>
            </template>
          </el-input>
          <div class="path-preview">
            <el-icon><Icon :icon="iconMap.location" /></el-icon>
            <span>{{ newFilePath }}</span>
          </div>
        </el-form-item>
      </el-form>

      <div class="dialog-footer file-dialog-footer rename-actions">
        <el-button
          :disabled="processing"
          size="large"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="processing"
          :disabled="!canSubmit"
          size="large"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          {{ processing ? '重命名中...' : '确认重命名' }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFilePath } from '@/utils/format.js'
import { renameFileApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { FILE_NAME_PATTERN, FILE_NAME_ERROR_MESSAGE } from '@/utils/fileValidator.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

const iconMap = icons

const props = defineProps({
  sessionId: { type: String, required: true },
  file: { type: Object, required: true },
  disk: { type: String, default: '/' },
  currentPath: { type: String, default: '' }
})

const emit = defineEmits(['refresh', 'close'])

const dialogVisible = ref(false)
const processing = ref(false)
const formRef = ref(null)
const inputRef = ref(null)

const form = ref({ newName: '' })

const filePath = computed(() =>
  formatFilePath(`${props.disk}${props.currentPath}/${props.file.name}`)
)

const targetDirectory = computed(() => formatFilePath(`${props.disk}${props.currentPath}`).replace(/\/+$/, ''))

const newFilePath = computed(() => {
  const nextName = form.value.newName?.trim() || props.file.name || ''
  return formatFilePath(`${targetDirectory.value}/${nextName}`)
})

const fileIconPresentation = computed(() => getFileIconPresentation(props.file))

const summaryBadges = computed(() => [
  { label: props.file.isDirectory ? '文件夹' : (props.file.extension?.toUpperCase() || '文件') }
])

const canSubmit = computed(() => {
  const n = form.value.newName?.trim()
  return n && n !== props.file.name && FILE_NAME_PATTERN.test(n)
})

const rules = {
  newName: [
    { required: true, message: '请输入新名称', trigger: 'blur' },
    { pattern: FILE_NAME_PATTERN, message: FILE_NAME_ERROR_MESSAGE, trigger: 'blur' }
  ]
}

const openDialog = () => {
  form.value.newName = props.file.name || ''
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

const focusInput = () => {
  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('input')
    if (!el) return
    el.focus()
    // 选中不含扩展名的部分
    const name = form.value.newName
    const dot = name.lastIndexOf('.')
    const end = !props.file.isDirectory && dot > 0 ? dot : name.length
    el.setSelectionRange(0, end)
  })
}

const handleClose = () => {
  if (processing.value) return
  dialogVisible.value = false
  emit('close')
}

const handleSubmit = async () => {
  if (!canSubmit.value || processing.value) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  processing.value = true
  try {
    await renameFileApi({
      sessionId: props.sessionId,
      path: filePath.value,
      newName: form.value.newName.trim()
    })
    showSuccess('重命名成功')
    dialogVisible.value = false
    emit('refresh')
    emit('close')
  } catch (error) {
    showError(error.message || '重命名失败，请重试')
  } finally {
    processing.value = false
  }
}

defineExpose({ openDialog })
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-rename-dialog {
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

.file-rename-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--file-dialog-soft-border);
  box-shadow: var(--app-shell-shadow-strong);
}

.rename-content {
  padding: 0;
}

.rename-field {
  margin-bottom: 0 !important;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.name-input {
  width: 100%;
}

.name-input :deep(.el-input__wrapper) {
  border-radius: 10px;
  min-height: 38px;
}

.path-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--app-control-background-soft) 86%, var(--el-bg-color));
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.path-preview .el-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 14px;
}

.path-preview span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rename-actions {
  margin-top: 18px;
}

.file-rename-dialog :deep(.el-dialog__footer) {
  display: none;
}
</style>
