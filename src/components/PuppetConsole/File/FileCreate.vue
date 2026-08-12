<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="720px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-create-dialog file-dialog-shell"
    align-center
    :before-close="handleBeforeClose"
    @opened="handleOpened"
    @closed="handleClosed"
  >
    <div class="create-form file-dialog-content">
      <div class="create-summary">
        <div class="summary-main">
          <span class="summary-label">保存到</span>
          <el-tooltip
            :content="targetDirectory"
            placement="top"
            :show-after="500"
          >
            <span class="summary-path">{{ targetDirectory }}</span>
          </el-tooltip>
          <el-tooltip
            content="复制目录路径"
            placement="top"
          >
            <el-button
              class="summary-copy"
              text
              size="small"
              aria-label="复制目标路径"
              @click="copyTargetPath"
            >
              <el-icon><Icon :icon="iconMap.copyPath" /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="summary-meta">
          <span class="summary-chip">
            <span class="summary-label">落点</span>
            当前目录
          </span>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="0"
        class="create-form-content"
      >
        <el-form-item
          prop="name"
          class="create-field"
          :show-message="showNameValidation"
        >
          <div class="field-head">
            <span class="field-label">名称</span>
            <span
              v-if="nameAssistText"
              class="field-assist"
            >{{ nameAssistText }}</span>
          </div>
          <el-input
            ref="nameInputRef"
            v-model="form.name"
            :placeholder="namePlaceholder"
            clearable
            size="large"
            class="name-input"
            @blur="markNameTouched"
            @input="handleNameInput"
            @keyup.enter="handleSave({ openAfterCreate: createType === 'file' })"
          >
            <template #prefix>
              <el-icon class="input-icon">
                <Icon :icon="createType === 'file' ? iconMap.document : iconMap.folder" />
              </el-icon>
            </template>
          </el-input>
          <div
            class="inline-path-preview"
            :class="{ 'is-empty': !normalizedName }"
          >
            <el-icon class="path-icon">
              <Icon :icon="iconMap.location" />
            </el-icon>
            <span class="path-text">{{ pathPreviewText }}</span>
            <el-tooltip
              v-if="normalizedName"
              content="复制生成路径"
              placement="top"
            >
              <el-button
                class="path-copy"
                text
                size="small"
                aria-label="复制已创建路径"
                @click="copyGeneratedPath"
              >
                <el-icon><Icon :icon="iconMap.copyPath" /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </el-form-item>

        <el-form-item
          v-if="createType === 'file'"
          prop="content"
          class="create-field create-field--full"
        >
          <div class="field-head">
            <span class="field-label">内容</span>
          </div>
          <div class="editor-panel">
            <div class="editor-meta">
              <div class="editor-tags">
                <el-tag
                  type="info"
                  size="small"
                >
                  {{ form.content.length }} 字符
                </el-tag>
              </div>
              <div class="editor-actions">
                <el-button
                  size="small"
                  link
                  :disabled="!form.content"
                  @click="clearContent"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                  清空
                </el-button>
              </div>
            </div>
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="7"
              :placeholder="contentPlaceholder"
              resize="none"
              class="content-editor"
              show-word-limit
              :maxlength="10000"
            />
          </div>
        </el-form-item>
      </el-form>

      <div class="dialog-footer file-dialog-footer create-actions">
        <el-button
          :disabled="saving"
          @click="requestClose"
        >
          取消
        </el-button>
        <el-tooltip
          :disabled="canSubmit"
          :content="submitDisabledReason"
          placement="top"
        >
          <span>
            <el-button
              :loading="saving && saveIntent === 'create'"
              :disabled="!canSubmit"
              @click="handleSave({ openAfterCreate: false })"
            >
              <el-icon v-if="!(saving && saveIntent === 'create')">
                <Check />
              </el-icon>
              {{ createType === 'folder' ? '创建文件夹' : '创建文件' }}
            </el-button>
          </span>
        </el-tooltip>
        <el-tooltip
          v-if="createType === 'file'"
          :disabled="canSubmit"
          :content="submitDisabledReason"
          placement="top"
        >
          <span>
            <el-button
              type="primary"
              :loading="saving && saveIntent === 'open'"
              :disabled="!canSubmit"
              @click="handleSave({ openAfterCreate: true })"
            >
              <el-icon v-if="!(saving && saveIntent === 'open')">
                <Icon :icon="iconMap.view" />
              </el-icon>
              创建并打开
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFilePath } from '@/utils/format.js'
import { validateForm, handleFormSubmit } from '@/utils/formUtils.js'
import { newDirApi, newFileApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const iconMap = icons
const emit = defineEmits(['refresh', 'created'])

const dialogVisible = ref(false)
const createType = ref('file')
const saving = ref(false)
const saveIntent = ref('')
const forceClosing = ref(false)
const sessionId = ref('')
const currentPath = ref('')
const submitAttempted = ref(false)
const nameTouched = ref(false)

const form = ref({
  name: '',
  content: ''
})

const formRef = ref(null)
const nameInputRef = ref(null)

const dialogTitle = computed(() => (createType.value === 'file' ? '新建文件' : '新建文件夹'))

const namePlaceholder = computed(() => (
  createType.value === 'file' ? '请输入完整文件名，例如 app.js' : '请输入文件夹名称'
))

const contentPlaceholder = computed(() => '输入文件内容，可留空')

const normalizeDirectoryPath = (path) => {
  const formatted = formatFilePath(path || '/').replace(/\/\.$/, '')
  if (formatted === '/' || /^[A-Za-z]:\/?$/.test(formatted)) {
    return formatted.endsWith('/') ? formatted : `${formatted}/`
  }
  return formatted.replace(/\/+$/, '')
}

const joinPath = (basePath, name) => {
  const base = normalizeDirectoryPath(basePath)
  if (base === '/') return formatFilePath(`/${name}`)
  return formatFilePath(`${base}${base.endsWith('/') ? '' : '/'}${name}`)
}

const targetDirectory = computed(() => normalizeDirectoryPath(currentPath.value))

const normalizedName = computed(() => form.value.name.trim())

const hasNameExtension = computed(() => /\.[^./\\]+$/.test(normalizedName.value))

const effectiveName = computed(() => {
  if (!normalizedName.value) return ''
  return normalizedName.value
})

const fullPath = computed(() => {
  if (!effectiveName.value) return targetDirectory.value
  return joinPath(targetDirectory.value, effectiveName.value)
})

const pathPreviewText = computed(() => (
  effectiveName.value ? fullPath.value : '输入名称后生成路径'
))

const nameAssistText = computed(() => {
  if (createType.value === 'file' && normalizedName.value && !hasNameExtension.value) {
    return '未包含扩展名'
  }
  return ''
})

const PATH_PATTERN = /^[^\\/:*?"<>|]+$/
const PATH_ERROR_MSG = '名称不能包含特殊字符 \\ / : * ? " < > |'

const showNameValidation = computed(() => submitAttempted.value || nameTouched.value)

const hasNamePatternError = computed(() => (
  Boolean(normalizedName.value) && !PATH_PATTERN.test(normalizedName.value)
))

const hasReservedNameError = computed(() => ['.', '..'].includes(normalizedName.value))

const canSubmit = computed(() => (
  Boolean(normalizedName.value) &&
  !hasNamePatternError.value &&
  !hasReservedNameError.value &&
  !saving.value
))

const submitDisabledReason = computed(() => {
  if (saving.value) return '正在创建，请稍候'
  if (!normalizedName.value) return '请输入名称'
  if (hasNamePatternError.value) return PATH_ERROR_MSG
  if (hasReservedNameError.value) return '名称不能为 . 或 ..'
  return ''
})

const rules = computed(() => ({
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    {
      pattern: PATH_PATTERN,
      message: PATH_ERROR_MSG,
      trigger: 'blur'
    },
    {
      validator: (rule, value, callback) => {
        const trimmedValue = value?.trim()
        if (value && trimmedValue.length === 0) {
          callback(new Error('名称不能为空'))
        } else if (['.', '..'].includes(trimmedValue)) {
          callback(new Error('名称不能为 . 或 ..'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  content: [
    {
      validator: (rule, value, callback) => {
        if (createType.value === 'file' && value && value.length > 10000) {
          callback(new Error('文件内容不能超过10000字符'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}))

const openDialog = async (sessionIdParam, currentPathParam, type = 'file') => {
  sessionId.value = sessionIdParam
  currentPath.value = currentPathParam

  resetForm()

  createType.value = type === 'folder' ? 'folder' : 'file'

  dialogVisible.value = true

  await nextTick()
  nameInputRef.value?.focus?.()
}

const handleOpened = async () => {
  await nextTick()
  nameInputRef.value?.focus?.()
  document.querySelector('.file-create-dialog .name-input input')?.focus?.()
}

const hasDraft = computed(() => Boolean(normalizedName.value || form.value.content))

const confirmDiscard = async () => {
  if (!hasDraft.value) return true
  return confirmAction({
    title: '确认取消',
    message: '确定要取消创建吗？未保存的内容将丢失',
    cancelButtonText: '继续编辑'
  })
}

const handleBeforeClose = async (done) => {
  if (forceClosing.value) {
    done()
    return
  }
  if (saving.value) return
  const confirmed = await confirmDiscard()
  if (confirmed) {
    done()
  }
}

const requestClose = async () => {
  if (saving.value) return
  const confirmed = await confirmDiscard()
  if (confirmed) {
    closeDialog()
  }
}

const closeDialog = (force = false) => {
  forceClosing.value = force
  dialogVisible.value = false
}

const handleClosed = () => {
  forceClosing.value = false
  createType.value = 'file'
  resetForm()
}

const resetForm = () => {
  form.value = {
    name: '',
    content: ''
  }
  submitAttempted.value = false
  nameTouched.value = false
  saveIntent.value = ''
  forceClosing.value = false
  formRef.value?.clearValidate()
}

const markNameTouched = () => {
  nameTouched.value = true
  formRef.value?.validateField?.('name')
}

const handleNameInput = () => {
  if (!showNameValidation.value) {
    formRef.value?.clearValidate?.('name')
  }
}

const clearContent = () => {
  form.value.content = ''
}

const copyTargetPath = () => {
  navigator.clipboard.writeText(targetDirectory.value).then(
    () => showSuccess('已复制目录路径'),
    () => showError('复制失败，请手动复制')
  )
}

const copyGeneratedPath = () => {
  if (!effectiveName.value) return
  navigator.clipboard.writeText(fullPath.value).then(
    () => showSuccess('已复制生成路径'),
    () => showError('复制失败，请手动复制')
  )
}

const handleSave = async ({ openAfterCreate = false } = {}) => {
  if (saving.value) return

  submitAttempted.value = true
  nameTouched.value = true

  const isValid = await validateForm(formRef, { errorMessage: '请先填写有效名称' })
  if (!isValid) return

  const shouldOpen = createType.value === 'file' && openAfterCreate
  saveIntent.value = shouldOpen ? 'open' : 'create'

  try {
    await handleFormSubmit(
      async () => {
        const isFolder = createType.value === 'folder'
        const params = {
          sessionId: sessionId.value,
          path: fullPath.value,
          ...(isFolder ? {} : { content: form.value.content || '' })
        }

        await (isFolder ? newDirApi(params) : newFileApi(params))
        return {
          name: effectiveName.value,
          path: fullPath.value,
          type: isFolder ? 'folder' : 'file',
          size: isFolder ? 0 : form.value.content.length,
          open: shouldOpen
        }
      },
      {
        loadingRef: saving,
        successMessage: createType.value === 'folder'
          ? '文件夹创建成功！'
          : shouldOpen ? '文件创建成功，正在打开...' : '文件创建成功！',
        errorMessage: '创建失败，请重试',
        onSuccess: (createdEntry) => {
          closeDialog(true)
          emit('refresh')
          emit('created', createdEntry)
        }
      }
    )
  } finally {
    saveIntent.value = ''
  }
}

watch(dialogVisible, (newVal) => {
  if (!newVal) {
    formRef.value?.clearValidate?.()
  }
})

defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-create-dialog {
  --file-create-panel-surface: color-mix(in srgb, var(--app-control-background-soft) 86%, var(--el-bg-color));
  --file-create-raised-surface: color-mix(in srgb, var(--el-bg-color-overlay) 92%, var(--app-control-background-soft));
  --file-create-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

:global(html:not(.dark) .file-create-dialog),
:global(html[data-theme='light'] .file-create-dialog) {
  --file-create-panel-surface: #f7f9fc;
  --file-create-raised-surface: #ffffff;
  --file-create-soft-border: rgba(30, 41, 59, 0.1);
}

:global(.el-dialog.file-create-dialog) {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--file-create-soft-border);
  background: var(--app-dialog-background);
  box-shadow: var(--app-shell-shadow-strong);
}

:global(.el-dialog.file-create-dialog > .el-dialog__header) {
  padding: 16px 20px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--file-create-soft-border) 76%, transparent);
}

:global(.el-dialog.file-create-dialog > .el-dialog__body) {
  padding: 12px 20px 16px;
}

:global(.el-dialog.file-create-dialog .el-dialog__title) {
  font-size: 16px;
  font-weight: 700;
}

.create-form {
  padding: 0;
  gap: 12px;
}

.create-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--file-create-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-create-soft-border) 88%, transparent);
}

.summary-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.summary-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.summary-path {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.summary-copy,
.path-copy {
  width: 24px;
  min-width: 24px;
  height: 24px;
  padding: 0;
}

.summary-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 8px;
  background: var(--file-create-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-create-soft-border) 86%, transparent);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 700;
}

.create-form-content {
  padding: 0;
}

.file-create-dialog :deep(.create-form-content .el-form-item) {
  margin-bottom: 12px;
}

.file-create-dialog :deep(.create-form-content .el-input__wrapper),
.file-create-dialog :deep(.create-form-content .el-textarea__inner) {
  border-radius: 10px;
}

.file-create-dialog :deep(.create-form-content .el-input__wrapper) {
  min-height: 38px;
}

.input-icon {
  color: var(--el-color-primary);
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.field-assist {
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.inline-path-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  margin-top: 8px;
  padding: 7px 9px;
  border-radius: 10px;
  background: var(--file-create-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-create-soft-border) 88%, transparent);
}

.inline-path-preview.is-empty {
  color: var(--el-text-color-placeholder);
}

.path-icon {
  flex: 0 0 auto;
  color: var(--el-color-primary);
}

.path-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.inline-path-preview.is-empty .path-text {
  color: var(--el-text-color-placeholder);
  font-family: inherit;
}

.editor-panel {
  width: 100%;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--file-create-soft-border) 92%, transparent);
  border-radius: 12px;
  background: var(--file-create-raised-surface);
}

.editor-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 7px;
}

.editor-tags,
.editor-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.content-editor :deep(.el-textarea__inner) {
  min-height: 136px !important;
  font-family: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  background: var(--app-dialog-background);
}

.create-actions {
  margin-top: 0;
  padding-top: 2px;
  align-items: center;
}

.create-actions > span {
  display: inline-flex;
}

.file-create-dialog :deep(.el-dialog__footer) {
  display: none;
}

@media (max-width: 768px) {
  :global(.el-dialog.file-create-dialog) {
    width: 92vw !important;
  }

  .create-summary,
  .summary-main,
  .summary-meta,
  .editor-meta,
  .create-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-path,
  .path-text {
    white-space: normal;
    word-break: break-all;
  }
}
</style>
