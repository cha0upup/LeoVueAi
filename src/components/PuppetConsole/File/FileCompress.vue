<template>
  <el-dialog
    v-model="dialogVisible"
    title="压缩文件"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-compress-dialog file-dialog-shell"
    append-to-body
    :before-close="handleBeforeClose"
    @opened="handleOpened"
    @closed="handleClosed"
  >
    <div class="compress-content file-dialog-content">
      <FileOperationSummary
        :name="fileName"
        :path="filePath"
        :icon="iconMap.compress"
        :badges="summaryBadges"
      />

      <div class="compress-config">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          :validate-on-rule-change="false"
          label-width="0"
          class="compress-form"
        >
          <el-form-item
            prop="archiveName"
            class="compress-field"
            :show-message="showArchiveValidation"
          >
            <div class="field-head">
              <span class="field-label">压缩包名称</span>
            </div>
            <el-input
              ref="archiveNameInputRef"
              v-model="form.archiveName"
              placeholder="请输入压缩包名称"
              clearable
              size="large"
              class="archive-input"
              @blur="markArchiveTouched"
              @input="handleArchiveNameInput"
              @keyup.enter="handleCompress"
            >
              <template #prefix>
                <el-icon class="input-icon">
                  <Icon :icon="iconMap.compress" />
                </el-icon>
              </template>
              <template #suffix>
                <span class="file-extension">.zip</span>
              </template>
            </el-input>
            <div
              class="inline-path-preview"
              :class="{ 'is-empty': !effectiveArchiveName }"
            >
              <el-icon class="path-icon">
                <Icon :icon="iconMap.location" />
              </el-icon>
              <span class="path-text">{{ outputPathPreview }}</span>
              <el-tooltip
                v-if="effectiveArchiveName"
                content="复制输出路径"
                placement="top"
              >
                <el-button
                  class="path-copy"
                  text
                  size="small"
                  aria-label="复制压缩包输出路径"
                  @click="copyOutputPath"
                >
                  <el-icon><Icon :icon="iconMap.copyPath" /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </el-form-item>

          <el-form-item
            prop="exclude"
            class="compress-field compress-field--full"
          >
            <div class="field-head">
              <span class="field-label">排除规则</span>
              <span
                v-if="hasExcludeRule"
                class="field-assist"
              >按正则匹配</span>
            </div>
            <div class="exclude-input-wrapper">
              <el-input
                v-model="form.exclude"
                type="textarea"
                :rows="2"
                placeholder="可选：输入正则表达式，多个规则用 | 分隔"
                clearable
                size="large"
                class="exclude-input"
              />
            </div>
            <div class="exclude-tips">
              <div class="tips-header">
                <span>常用排除</span>
                <el-button
                  v-if="hasExcludeRule"
                  text
                  size="small"
                  class="clear-exclude-btn"
                  @click="clearExclude"
                >
                  <el-icon><Icon :icon="iconMap.close" /></el-icon>
                  清除
                </el-button>
              </div>
              <div class="exclude-presets">
                <button
                  v-for="preset in EXCLUDE_PRESETS"
                  :key="preset.value"
                  type="button"
                  class="preset-tag"
                  :class="{ active: isPresetSelected(preset.value) }"
                  @click="applyPreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <div class="dialog-footer file-dialog-footer compress-actions">
        <el-button
          :disabled="compressing"
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
              type="primary"
              :loading="compressing"
              :disabled="!canSubmit"
              class="compress-btn"
              @click="handleCompress"
            >
              <el-icon v-if="!compressing"><Icon :icon="iconMap.files" /></el-icon>
              {{ compressing ? '压缩中...' : '开始压缩' }}
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, reactive, nextTick } from 'vue'

import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { formatFilePath } from '@/utils/format.js'
import { compressFileApi } from '@/services/api.js'
import { showError, showInfo, showSuccess } from '@/utils/messageUtils.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

// Props
const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  file: {
    type: Object,
    required: true
  },
  disk: {
    type: String,
    default: '/'
  },
  currentPath: {
    type: String,
    default: ''
  }
})

const iconMap = icons

// Emits
const emit = defineEmits(['refresh', 'close'])

// 响应式数据
const dialogVisible = ref(false)
const compressing = ref(false)
const formRef = ref(null)
const archiveNameInputRef = ref(null)
const submitAttempted = ref(false)
const archiveTouched = ref(false)

// 表单数据
const form = reactive({
  archiveName: '',
  exclude: ''
})

// 计算属性
const fileName = computed(() => {
  return props.file.name || '未知文件'
})

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

const targetDirectory = computed(() => normalizeDirectoryPath(`${props.disk}${props.currentPath}`))

const filePath = computed(() => (
  props.file.path ? formatFilePath(props.file.path) : joinPath(targetDirectory.value, fileName.value)
))

const normalizedArchiveName = computed(() => form.archiveName.trim())

const effectiveArchiveName = computed(() => normalizedArchiveName.value.replace(/\.zip$/i, ''))

const hasExcludeRule = computed(() => Boolean(form.exclude.trim()))

const summaryBadges = computed(() => [
  { label: 'ZIP', type: 'info' },
  { label: hasExcludeRule.value ? '已设置排除' : '完整打包', type: hasExcludeRule.value ? 'warning' : 'info' }
])

const outputPath = computed(() => {
  if (!effectiveArchiveName.value) return targetDirectory.value
  return joinPath(targetDirectory.value, `${effectiveArchiveName.value}.zip`)
})

const outputPathPreview = computed(() => (
  effectiveArchiveName.value ? outputPath.value : '输入名称后生成输出路径'
))

// 常用排除规则预设
const EXCLUDE_PRESETS = [
  { label: '排除.log文件', value: '.*\\.log$' },
  { label: '排除临时文件', value: '.*\\.(tmp|temp|bak)$' },
  { label: '排除隐藏文件', value: '^\\.' },
  { label: '排除node_modules', value: '.*/node_modules/.*' },
  { label: '排除.git目录', value: '.*/\\.git/.*' },
  { label: '排除编译文件', value: '.*\\.(class|o|so|dll)$' }
]

// 路径验证规则
const PATH_PATTERN = /^[^\\/:*?"<>|]+$/
const PATH_ERROR_MSG = '名称不能包含特殊字符 \\ / : * ? " < > |'

const showArchiveValidation = computed(() => submitAttempted.value || archiveTouched.value)

const hasArchiveNamePatternError = computed(() => (
  Boolean(effectiveArchiveName.value) && !PATH_PATTERN.test(effectiveArchiveName.value)
))

const canSubmit = computed(() => (
  Boolean(effectiveArchiveName.value) &&
  !hasArchiveNamePatternError.value &&
  !compressing.value
))

const submitDisabledReason = computed(() => {
  if (compressing.value) return '正在压缩，请稍候'
  if (!effectiveArchiveName.value) return '请输入压缩包名称'
  if (hasArchiveNamePatternError.value) return PATH_ERROR_MSG
  return ''
})

// 表单验证规则
const rules = {
  archiveName: [
    { required: true, message: '请输入压缩包名称', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        const normalizedValue = String(value || '').trim().replace(/\.zip$/i, '')
        if (!normalizedValue) {
          callback(new Error('请输入压缩包名称'))
        } else if (!PATH_PATTERN.test(normalizedValue)) {
          callback(new Error(PATH_ERROR_MSG))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 方法
const openDialog = async () => {
  dialogVisible.value = true
  resetForm()

  await nextTick()
  archiveNameInputRef.value?.focus?.()
}

const handleOpened = async () => {
  await nextTick()
  archiveNameInputRef.value?.focus?.()
  document.querySelector('.file-compress-dialog .archive-input input')?.focus?.()
}

const handleBeforeClose = (done) => {
  if (compressing.value) return // 压缩过程中不允许关闭
  done()
}

const requestClose = () => {
  if (compressing.value) return
  dialogVisible.value = false
}

const handleClosed = () => {
  emit('close')
}

const resetForm = () => {
  // 生成默认压缩包名称（移除原扩展名，添加_compressed）
  const baseName = props.file.name.replace(/\.[^.]*$/, '') || props.file.name
  form.archiveName = `${baseName}_compressed`
  form.exclude = ''
  submitAttempted.value = false
  archiveTouched.value = false
  formRef.value?.clearValidate()
}

const markArchiveTouched = () => {
  archiveTouched.value = true
  formRef.value?.validateField?.('archiveName')
}

const handleArchiveNameInput = () => {
  const strippedName = form.archiveName.trim().replace(/\.zip$/i, '')
  if (strippedName !== form.archiveName) {
    form.archiveName = strippedName
  }
  if (!showArchiveValidation.value) {
    formRef.value?.clearValidate?.('archiveName')
  }
}

const clearExclude = () => {
  form.exclude = ''
}

const copyOutputPath = () => {
  if (!effectiveArchiveName.value) return
  navigator.clipboard.writeText(outputPath.value).then(
    () => showSuccess('已复制输出路径'),
    () => showError('复制失败，请手动复制')
  )
}

// 应用预设排除规则
const applyPreset = (presetValue) => {
  const currentExclude = form.exclude.trim()

  // 检查当前是否包含该预设值
  if (currentExclude === presetValue) {
    // 完全匹配，则清除
    form.exclude = ''
  } else if (currentExclude.includes(presetValue)) {
    // 包含该预设值，需要移除（可能是组合的一部分）
    const parts = currentExclude
      .split('|')
      .map((p) => p.trim())
      .filter((p) => p && p !== presetValue)
    form.exclude = parts.join('|')
  } else {
    // 不包含，添加该预设值
    form.exclude = currentExclude ? `${currentExclude}|${presetValue}` : presetValue
  }
}

// 检查预设是否被选中
const isPresetSelected = (presetValue) => {
  if (!form.exclude.trim()) return false
  const parts = form.exclude.split('|').map((p) => p.trim())
  return parts.includes(presetValue)
}

const handleCompress = async () => {
  if (!formRef.value) return

  submitAttempted.value = true
  archiveTouched.value = true

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  compressing.value = true
  showInfo('正在压缩...')

  try {
    // 构建请求参数
    const params = {
      sessionId: props.sessionId,
      src: filePath.value,
      des: outputPath.value,
      format: 'zip'
    }

    // 如果填写了排除规则，添加到参数中
    if (form.exclude && form.exclude.trim()) {
      params.exclude = form.exclude.trim()
    }

    await compressFileApi(params)
    showSuccess('压缩成功')
    dialogVisible.value = false
    emit('refresh')
  } catch (error) {
    showError(error.message || '压缩失败，请重试')
  } finally {
    compressing.value = false
  }
}

// 暴露方法
defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-compress-dialog {
  --file-compress-panel-surface: color-mix(in srgb, var(--app-control-background-soft) 86%, var(--el-bg-color));
  --file-compress-raised-surface: color-mix(in srgb, var(--el-bg-color-overlay) 92%, var(--app-control-background-soft));
  --file-compress-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

:global(html:not(.dark) .file-compress-dialog),
:global(html[data-theme='light'] .file-compress-dialog) {
  --file-compress-panel-surface: #f7f9fc;
  --file-compress-raised-surface: #ffffff;
  --file-compress-soft-border: rgba(30, 41, 59, 0.1);
}

:global(.el-dialog.file-compress-dialog) {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--file-compress-soft-border);
  background: var(--app-dialog-background);
  box-shadow: var(--app-shell-shadow-strong);
}

:global(.el-dialog.file-compress-dialog > .el-dialog__header) {
  padding: 16px 20px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--file-compress-soft-border) 76%, transparent);
}

:global(.el-dialog.file-compress-dialog > .el-dialog__body) {
  padding: 12px 20px 16px;
}

:global(.el-dialog.file-compress-dialog .el-dialog__title) {
  font-size: 16px;
  font-weight: 700;
}

.compress-content {
  gap: 12px;
}

.compress-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compress-form {
  padding: 0;
}

.file-compress-dialog :deep(.compress-form .el-form-item) {
  margin-bottom: 12px;
}

.file-compress-dialog :deep(.compress-form .el-input__wrapper),
.file-compress-dialog :deep(.compress-form .el-textarea__inner) {
  border-radius: 10px;
}

.file-compress-dialog :deep(.compress-form .el-input__wrapper) {
  min-height: 38px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.input-icon {
  color: var(--el-color-primary);
}

.file-extension {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.inline-path-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 9px;
  background: var(--file-compress-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-compress-soft-border) 88%, transparent);
}

.inline-path-preview.is-empty {
  color: var(--el-text-color-placeholder);
}

.path-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 14px;
}

.path-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.path-copy {
  width: 24px;
  min-width: 24px;
  height: 24px;
  padding: 0;
}

.exclude-input-wrapper {
  width: 100%;
}

.exclude-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.exclude-tips {
  margin-top: 8px;
  padding: 8px;
  border-radius: 10px;
  background: var(--file-compress-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-compress-soft-border) 88%, transparent);
}

.tips-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.clear-exclude-btn {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  padding: 0;
}

.clear-exclude-btn:hover {
  color: var(--el-color-danger);
}

.exclude-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-tag {
  height: 24px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--file-compress-soft-border) 92%, transparent);
  border-radius: 7px;
  background: var(--file-compress-raised-surface);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--el-transition-duration) var(--el-transition-function);
}

.preset-tag:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--file-compress-soft-border));
  color: var(--el-text-color-primary);
}

.preset-tag.active {
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--file-compress-raised-surface));
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, var(--file-compress-soft-border));
  color: var(--el-color-primary);
}

.compress-btn {
  min-width: 104px;
}

.compress-btn .el-icon {
  margin-right: 4px;
}

.compress-actions {
  margin-top: 0;
  padding-top: 2px;
  align-items: center;
}

.compress-actions > span {
  display: inline-flex;
}

.file-compress-dialog :deep(.el-dialog__footer) {
  display: none;
}

@media (max-width: 768px) {
  :global(.el-dialog.file-compress-dialog) {
    width: 92vw !important;
  }

  .compress-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .path-text {
    white-space: normal;
    word-break: break-all;
  }

  .compress-btn {
    min-width: auto;
  }

  .compress-actions > span,
  .compress-actions .el-button {
    width: 100%;
  }
}
</style>
