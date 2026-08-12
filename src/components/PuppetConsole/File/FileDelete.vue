<template>
  <el-dialog
    v-model="dialogVisible"
    title="删除确认"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-delete-dialog file-dialog-shell"
    append-to-body
    @close="handleClose"
  >
    <div class="delete-content file-dialog-content">
      <FileOperationSummary
        :name="fileName"
        :path="filePath"
        :icon="fileIconPresentation.icon"
        :icon-color="fileIconPresentation.color"
        :badges="summaryBadges"
        tone="danger"
      />

      <div class="danger-card">
        <div class="danger-title">
          <el-icon class="warning-icon">
            <Icon :icon="iconMap.warning" />
          </el-icon>
          <span>删除后不可恢复</span>
        </div>
        <div class="detail-item">
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          <span>{{ fileTypeText === '文件夹' ? '内容会一并清除' : '内容会被永久清除' }}</span>
        </div>
      </div>

      <div class="dialog-footer file-dialog-footer delete-actions">
        <el-button
          :disabled="deleting"
          size="large"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          type="danger"
          :loading="deleting"
          size="large"
          class="delete-btn"
          @click="handleDelete"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          {{ deleting ? '删除中...' : '确认删除' }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'

import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { formatFilePath } from '@/utils/format.js'
import { deleteFileApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'
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
  }
})

// Emits
const emit = defineEmits(['refresh', 'close'])

// 响应式数据
const dialogVisible = ref(false)
const deleting = ref(false)

// 计算属性
const fileTypeText = computed(() => {
  return props.file.isDirectory ? '文件夹' : '文件'
})

const fileName = computed(() => {
  return props.file.name || '未知文件'
})

const filePath = computed(() => {
  return formatFilePath(`${props.disk}${props.currentPath}/${props.file.name}`)
})

const fileIconPresentation = computed(() => getFileIconPresentation(props.file))

const summaryBadges = computed(() => [
  { label: fileTypeText.value, type: props.file.isDirectory ? 'info' : 'danger' }
])

// 方法
const openDialog = () => {
  dialogVisible.value = true
}

const handleClose = () => {
  if (deleting.value) return // 删除过程中不允许关闭

  dialogVisible.value = false
  emit('close')
}

const handleDelete = async () => {
  if (deleting.value) return

  deleting.value = true
  try {
    await deleteFileApi({
      sessionId: props.sessionId,
      path: filePath.value
    })
    showSuccess('删除成功')
    dialogVisible.value = false
    emit('refresh')
    emit('close')
  } catch (error) {
    showError(error.message || '删除失败，请重试')
  } finally {
    deleting.value = false
  }
}

// 暴露方法
defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-delete-dialog {
  --file-delete-muted-surface: rgba(248, 250, 252, 0.82);
  --file-delete-soft-border: rgba(148, 163, 184, 0.14);
  --file-dialog-soft-border: var(--file-delete-soft-border);
}

:global(html:not(.dark) .file-delete-dialog),
:global(html[data-theme='light'] .file-delete-dialog) {
  --file-delete-muted-surface: #f7f9fc;
  --file-delete-soft-border: rgba(30, 41, 59, 0.1);
  --file-dialog-soft-border: var(--file-delete-soft-border);
}

.file-delete-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--file-delete-soft-border);
  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.12);
}

.delete-content {
  padding: 0;
}

.danger-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--file-delete-muted-surface));
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-danger) 18%, transparent);
}

.danger-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--el-color-danger);
}

.warning-icon {
  font-size: 16px;
  color: var(--el-color-danger);
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.detail-item .el-icon {
  font-size: 14px;
  color: var(--el-color-info);
  margin-top: 1px;
  flex-shrink: 0;
}

.delete-btn {
  min-width: 110px;
}

.delete-btn .el-icon {
  margin-right: 4px;
}

.delete-actions {
  margin-top: 18px;
}

.file-delete-dialog :deep(.el-dialog__footer) {
  display: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .file-delete-dialog {
    width: 90% !important;
    max-width: 400px;
  }

  .danger-card {
    padding: 12px;
  }

  .detail-item {
    font-size: 12px;
  }

  .delete-actions {
    flex-direction: column;
  }

  .delete-btn {
    min-width: auto;
  }
}
</style>
