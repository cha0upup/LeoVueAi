<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isMove ? '移动文件' : '复制文件'"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-transfer-dialog file-dialog-shell"
    append-to-body
    @close="handleClose"
  >
    <div class="transfer-content file-dialog-content">
      <FileOperationSummary
        :name="fileName"
        :path="formatFilePath(sourcePath)"
        :icon="fileIconPresentation.icon"
        :icon-color="fileIconPresentation.color"
        :badges="summaryBadges"
        :tone="isMove ? 'warning' : 'default'"
      />

      <div class="transfer-strategy">
        <div
          v-if="isMove"
          class="strategy-pill strategy-pill--warning"
        >
          <span class="strategy-label">模式</span>
          <span class="strategy-value">搬移并替换原位置</span>
        </div>
        <div class="strategy-pill">
          <span class="strategy-label">落点</span>
          <span class="strategy-value">{{ useCurrentDir ? '当前目录' : '自定义目录' }}</span>
        </div>
        <div class="strategy-pill">
          <span class="strategy-label">命名</span>
          <span class="strategy-value">{{ useDefaultName ? (isMove ? '原文件名' : '默认副本名') : '自定义文件名' }}</span>
        </div>
        <div
          class="strategy-pill"
          :class="{
            'strategy-pill--danger': conflictStrategy === 'overwrite',
            'strategy-pill--info': conflictStrategy === 'autorename'
          }"
        >
          <span class="strategy-label">冲突</span>
          <span class="strategy-value">{{ conflictStrategyLabel }}</span>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="0"
        class="transfer-form"
      >
        <div class="transfer-grid">
          <el-form-item
            prop="targetDir"
            class="transfer-field"
          >
            <div class="field-head">
              <span class="field-label">{{ isMove ? '移动到' : '复制到' }}</span>
              <el-button
                size="small"
                link
                @click="useCurrentDirectory"
              >
                当前目录
              </el-button>
            </div>
            <el-input
              v-model="form.targetDir"
              placeholder="目标目录"
              clearable
              size="large"
              class="path-input"
            >
              <template #prefix>
                <el-icon><Icon :icon="iconMap.folder" /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item
            prop="targetName"
            class="transfer-field"
          >
            <div class="field-head">
              <span class="field-label">{{ isMove ? '目标文件名' : '副本名称' }}</span>
              <el-button
                size="small"
                link
                @click="resetTargetName"
              >
                {{ isMove ? '保留原名' : '默认副本名' }}
              </el-button>
            </div>
            <el-input
              v-model="form.targetName"
              :placeholder="isMove ? `默认使用 ${fileName}` : '副本文件名'"
              clearable
              size="large"
              class="name-input"
            >
              <template #prefix>
                <el-icon><Icon :icon="iconMap.document" /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </div>

        <!-- 冲突策略 -->
        <div class="conflict-row">
          <span class="field-label">同名冲突</span>
          <div class="conflict-chips">
            <button
              type="button"
              class="conflict-chip"
              :class="{ active: conflictStrategy === 'overwrite', 'conflict-chip--danger': conflictStrategy === 'overwrite' }"
              @click="conflictStrategy = 'overwrite'"
            >
              <el-icon><Icon :icon="iconMap.warning" /></el-icon>
              覆盖
            </button>
            <button
              type="button"
              class="conflict-chip"
              :class="{ active: conflictStrategy === 'autorename' }"
              @click="conflictStrategy = 'autorename'"
            >
              <el-icon><Icon :icon="iconMap.rename" /></el-icon>
              自动重命名
            </button>
            <button
              type="button"
              class="conflict-chip"
              :class="{ active: conflictStrategy === 'skip', 'conflict-chip--muted': conflictStrategy === 'skip' }"
              @click="conflictStrategy = 'skip'"
            >
              <el-icon><Icon :icon="iconMap.cancel" /></el-icon>
              跳过
            </button>
          </div>
        </div>

        <el-form-item class="transfer-result">
          <div class="result-card">
            <div class="result-head">
              <span class="field-label">{{ isMove ? '目标路径' : '生成路径' }}</span>
              <el-tag
                v-if="isMove"
                :type="sourcePath === fullTargetPath ? 'warning' : 'success'"
                size="small"
                effect="plain"
              >
                {{ sourcePath === fullTargetPath ? '路径重复' : '即将移动' }}
              </el-tag>
              <el-tag
                v-else
                size="small"
                type="success"
                effect="plain"
              >
                即将创建副本
              </el-tag>
            </div>
            <div class="path-preview-inline">
              <el-icon><Icon :icon="iconMap.location" /></el-icon>
              <span>{{ fullTargetPath }}</span>
            </div>
          </div>
        </el-form-item>

        <div
          v-if="isMove && sourcePath === fullTargetPath"
          class="path-warning"
        >
          <el-icon><Icon :icon="iconMap.warning" /></el-icon>
          <span>目标路径与源路径相同，无需移动</span>
        </div>
      </el-form>

      <div class="dialog-footer file-dialog-footer transfer-actions">
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
          :disabled="isMove && sourcePath === fullTargetPath"
          size="large"
          class="transfer-btn"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="isMove ? iconMap.check : iconMap.copy" /></el-icon>
          {{ submitButtonText }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'

import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { formatFilePath, formatFileSize as formatSize } from '@/utils/format.js'
import { copyFileApi, moveFileApi } from '@/services/api.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'
import {
  FILE_NAME_ERROR_MESSAGE,
  FILE_NAME_PATTERN,
  validateDirectoryPath,
  validateFileName
} from '@/utils/fileValidator.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

// 图标映射
const iconMap = icons

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
  },
  mode: {
    type: String,
    default: 'copy',
    validator: (value) => ['copy', 'move'].includes(value)
  }
})

// Emits
const emit = defineEmits(['refresh', 'close'])

// 冲突策略
const CONFLICT_STRATEGIES = {
  overwrite: '直接覆盖',
  autorename: '自动重命名',
  skip: '跳过'
}

// 响应式数据
const dialogVisible = ref(false)
const processing = ref(false)
const sourcePath = ref('')
const fileSize = ref(0)
const formRef = ref(null)
const conflictStrategy = ref('autorename')

const form = ref({
  targetDir: '',
  targetName: ''
})

// 计算属性
const isMove = computed(() => props.mode === 'move')

const fileName = computed(() => props.file.name || '未知文件')

const defaultTargetName = computed(() => {
  if (isMove.value) return fileName.value
  const name = fileName.value
  const lastDotIndex = name.lastIndexOf('.')
  if (lastDotIndex > 0) {
    const baseName = name.substring(0, lastDotIndex)
    const extension = name.substring(lastDotIndex)
    return `${baseName}_copy${extension}`
  }
  return `${name}_copy`
})

const targetDirPath = computed(() => {
  if (form.value.targetDir && form.value.targetDir.trim()) {
    return form.value.targetDir.trim()
  }
  return formatFilePath(`${props.disk}${props.currentPath}`)
})

const targetFileName = computed(() => {
  if (form.value.targetName && form.value.targetName.trim()) {
    return form.value.targetName.trim()
  }
  return defaultTargetName.value
})

const fullTargetPath = computed(() => {
  return formatFilePath(`${targetDirPath.value}/${targetFileName.value}`)
})

const fileIconPresentation = computed(() => getFileIconPresentation(props.file))
const useCurrentDir = computed(() => !form.value.targetDir || !form.value.targetDir.trim())
const useDefaultName = computed(() => !form.value.targetName || !form.value.targetName.trim())

const summaryBadges = computed(() => [
  { label: isMove.value ? '移动' : '复制', type: isMove.value ? 'warning' : 'primary' },
  { label: fileSize.value > 0 ? formatSize(fileSize.value) : '', type: 'info' }
])

const submitButtonText = computed(() => {
  if (processing.value) return isMove.value ? '移动中...' : '复制中...'
  return isMove.value ? '确认移动' : '确认复制'
})

const conflictStrategyLabel = computed(() => CONFLICT_STRATEGIES[conflictStrategy.value] ?? '自动重命名')

// 表单验证规则
const rules = computed(() => ({
  targetDir: [{ validator: validateDirectoryPath, trigger: 'blur' }],
  targetName: isMove.value
    ? [{ validator: validateFileName, trigger: 'blur' }]
    : [{ pattern: FILE_NAME_PATTERN, message: FILE_NAME_ERROR_MESSAGE, trigger: 'blur' }]
}))

// 方法
const openDialog = () => {
  sourcePath.value = formatFilePath(`${props.disk}${props.currentPath}/${props.file.name}`)
  fileSize.value = props.file.size || 0
  form.value.targetDir = ''
  form.value.targetName = ''
  conflictStrategy.value = 'autorename'
  dialogVisible.value = true
  formRef.value?.clearValidate()
}

const handleClose = () => {
  if (processing.value) return
  dialogVisible.value = false
  emit('close')
}

const useCurrentDirectory = () => {
  form.value.targetDir = ''
}

const resetTargetName = () => {
  form.value.targetName = ''
}

const handleSubmit = async () => {
  if (processing.value || !formRef.value) return

  if (isMove.value && sourcePath.value === fullTargetPath.value) {
    showWarning('源路径和目标路径相同，无需移动')
    return
  }

  try {
    await formRef.value.validate()
  } catch {
    showWarning('请检查输入信息')
    return
  }

  // 移动操作需要二次确认
  if (isMove.value) {
    const confirmed = await confirmAction({
      title: '确认移动',
      message: `确定要将文件移动到以下位置吗？\n\n源路径: ${sourcePath.value}\n目标路径: ${fullTargetPath.value}\n\n注意：移动后原文件将被删除。`,
      confirmButtonText: '确认移动'
    })
    if (!confirmed) return
  }

  processing.value = true
  try {
    if (isMove.value) {
      await moveFileApi({
        sessionId: props.sessionId,
        path: sourcePath.value,
        newPath: fullTargetPath.value,
        conflictStrategy: conflictStrategy.value
      })
      showSuccess('移动成功')
    } else {
      await copyFileApi({
        sessionId: props.sessionId,
        path: sourcePath.value,
        destPath: fullTargetPath.value,
        conflictStrategy: conflictStrategy.value
      })
      showSuccess('复制成功')
    }
    dialogVisible.value = false
    emit('refresh')
    emit('close')
  } catch (error) {
    showError(error.message || (isMove.value ? '移动失败，请重试' : '复制失败，请重试'))
  } finally {
    processing.value = false
  }
}

// 暴露方法
defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-transfer-dialog {
  --file-dialog-muted-surface: var(--app-dialog-intro-background);
  --file-dialog-raised-surface: var(--app-control-background-soft);
  --file-dialog-warning-surface: var(--app-dialog-warning-background);
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

:global(html:not(.dark) .file-transfer-dialog),
:global(html[data-theme='light'] .file-transfer-dialog) {
  --file-dialog-muted-surface: #f3f2ef;
  --file-dialog-raised-surface: #f8f7f4;
  --file-dialog-warning-surface: #f6efe1;
  --file-dialog-soft-border: rgba(24, 24, 27, 0.06);
}

.transfer-form {
  padding: 0;
}

.transfer-strategy {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.strategy-pill {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--file-dialog-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
}

.strategy-pill--warning {
  background: color-mix(in srgb, var(--el-color-warning) 9%, var(--file-dialog-raised-surface));
}

.strategy-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.strategy-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.transfer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.transfer-field {
  margin-bottom: 0 !important;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.path-input,
.name-input {
  width: 100%;
}

.path-input :deep(.el-input__wrapper),
.name-input :deep(.el-input__wrapper) {
  border-radius: 10px;
  min-height: 38px;
}

.path-preview-inline {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--file-dialog-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
  color: var(--el-text-color-regular);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  word-break: break-all;
}

.path-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--file-dialog-warning-surface);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 22%, var(--el-border-color));
  border-radius: 12px;
  color: color-mix(in srgb, var(--el-color-warning) 76%, var(--el-text-color-primary));
  font-size: 12px;
}

.path-warning .el-icon {
  font-size: 16px;
  color: var(--el-color-warning);
}

.strategy-pill--danger {
  background: color-mix(in srgb, var(--el-color-danger) 9%, var(--file-dialog-raised-surface));
}

.strategy-pill--info {
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--file-dialog-raised-surface));
}

/* ── Conflict strategy row ──────────────────────────────────── */
.conflict-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.conflict-row .field-label {
  white-space: nowrap;
  flex-shrink: 0;
}

.conflict-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.conflict-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  background: var(--file-dialog-raised-surface);
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.18s, border-color 0.18s, color 0.18s;
  outline: none;
}

.conflict-chip:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.conflict-chip.active {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--file-dialog-raised-surface));
  color: var(--el-color-primary);
  font-weight: 600;
}

.conflict-chip--danger.active {
  border-color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 10%, var(--file-dialog-raised-surface));
  color: var(--el-color-danger);
}

.conflict-chip--muted.active {
  border-color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-text-color-secondary) 8%, var(--file-dialog-raised-surface));
  color: var(--el-text-color-secondary);
}

.transfer-result {
  margin-top: 14px;
  margin-bottom: 0 !important;
}

.result-card {
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  background: var(--file-dialog-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.transfer-btn {
  min-width: 110px;
}

.transfer-btn .el-icon {
  margin-right: 4px;
}

.transfer-actions {
  margin-top: 18px;
}

.file-transfer-dialog :deep(.el-dialog__footer) {
  display: none;
}

@media (max-width: 768px) {
  .transfer-strategy,
  .transfer-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .result-head,
  .transfer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .transfer-btn {
    min-width: auto;
    width: 100%;
  }
}
</style>
