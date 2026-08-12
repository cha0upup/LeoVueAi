<template>
  <el-dialog
    v-model="downloadVisible"
    title="文件下载"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    append-to-body
    class="file-download-dialog file-dialog-shell"
  >
    <div class="download-content file-dialog-content">
      <FileOperationSummary
        :name="fileName"
        :path="targetFilePath"
        :icon="fileIconPresentation.icon"
        :icon-color="fileIconPresentation.color"
        :badges="summaryBadges"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="download-form"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item
              label="并发数"
              prop="concurrency"
            >
              <el-input-number
                v-model="form.concurrency"
                :min="1"
                :max="10"
                size="large"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              label="块大小"
              prop="chunkSize"
            >
              <el-select
                v-model="form.chunkSize"
                size="large"
                style="width: 100%"
              >
                <el-option
                  label="64KB"
                  :value="65536"
                />
                <el-option
                  label="128KB"
                  :value="131072"
                />
                <el-option
                  label="256KB"
                  :value="262144"
                />
                <el-option
                  label="512KB"
                  :value="524288"
                />
                <el-option
                  label="1MB"
                  :value="1048576"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <div class="dialog-footer file-dialog-footer download-actions">
        <el-button @click="handleClose">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="startDownload"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          开始下载
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { formatFilePath, formatFileSize as formatSize } from '@/utils/format.js'
import { taskEngine } from './TaskEngine.js'
import { getFileMd5Api } from '@/services/api.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

// 响应式数据
const downloadVisible = ref(false)
const dialogSessionId = ref('')
const filePath = ref('')
const fileName = ref('')
const fileSize = ref(0)
const fileMD5 = ref('')

const form = reactive({
  concurrency: 3,
  chunkSize: 524288
})

const formRef = ref(null)

const targetFilePath = computed(() => formatFilePath(filePath.value + fileName.value))

// 表单验证规则
const rules = {
  concurrency: [{ required: true, message: '请选择并发数', trigger: 'change' }],
  chunkSize: [{ required: true, message: '请选择块大小', trigger: 'change' }]
}

// 打开下载对话框
const openDialog = async (sessionIdParam, filePathParam, fileNameParam, fileSizeParam = 0) => {
  downloadVisible.value = true
  dialogSessionId.value = sessionIdParam
  filePath.value = filePathParam
  fileName.value = fileNameParam
  fileSize.value = fileSizeParam || 0

  // 获取文件MD5和大小信息
  try {
    await getFileMD5()
  } catch {
    // 静默处理获取MD5失败
  }
}

// 获取文件MD5和大小信息
const getFileMD5 = async () => {
  try {
    const response = await getFileMd5Api({
      sessionId: dialogSessionId.value,
      path: formatFilePath(filePath.value + fileName.value)
    })

    if (response.data.fileSize && response.data.fileSize > 0) {
      fileSize.value = response.data.fileSize
    }
    fileMD5.value = response.data.md5
  } catch {
    // 静默处理获取MD5失败
  }
}

// 创建下载任务
const createDownloadTask = () => {
  return taskEngine.createDownloadTask(
    dialogSessionId.value,
    filePath.value,
    fileName.value,
    fileSize.value,
    {
      chunkSize: form.chunkSize,
      concurrency: form.concurrency,
      background: true
    }
  )
}

const fileIconPresentation = computed(() =>
  getFileIconPresentation({
    name: fileName.value
  })
)

const summaryBadges = computed(() => [
  { label: formatSize(fileSize.value), type: 'info' },
  { label: fileMD5.value ? `MD5 ${fileMD5.value.slice(0, 8)}` : '', type: 'success' }
])

// 开始下载
const startDownload = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }
  try {
    const taskId = createDownloadTask()
    handleClose()
    showSuccess('下载任务已提交，可在任务管理器中查看进度')
    taskEngine.startTask(taskId).catch((err) => {
      showError(`下载启动失败: ${err.message}`)
    })
  } catch (error) {
    showError(`开始下载失败: ${error.message}`)
  }
}

// 关闭对话框
const handleClose = () => {
  downloadVisible.value = false
}

const iconMap = icons

// 暴露方法给父组件
defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

/* 确保文件下载弹窗显示在最上层 */
:deep(.file-download-dialog) {
  z-index: 3000 !important;
}

:deep(.file-download-dialog .el-overlay) {
  z-index: 2999 !important;
}

.file-download-dialog {
  --file-dialog-muted-surface: var(--app-dialog-intro-background);
  --file-dialog-raised-surface: var(--app-dialog-subtle-background);
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  --file-download-panel-surface: var(--app-dialog-background);
}

:global(html:not(.dark) .file-download-dialog),
:global(html[data-theme='light'] .file-download-dialog) {
  --file-dialog-muted-surface: #f7f9fc;
  --file-dialog-raised-surface: #ffffff;
  --file-download-panel-surface: #ffffff;
  --file-dialog-soft-border: rgba(30, 41, 59, 0.1);
}

.download-content {
  padding: 0;
}

.download-form {
  padding: 0 4px;
}

.download-actions {
  margin-top: 0;
  padding-top: 2px;
  align-items: center;
}

.file-download-dialog :deep(.el-dialog__footer) {
  display: none;
}

.file-download-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--file-dialog-soft-border);
  background: var(--file-download-panel-surface);
  box-shadow: var(--app-shell-shadow-strong);
}

.file-download-dialog :deep(.download-form .el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.file-download-dialog :deep(.download-form .el-input-number),
.file-download-dialog :deep(.download-form .el-select) {
  width: 100%;
}

.file-download-dialog :deep(.download-form .el-input-number .el-input__wrapper),
.file-download-dialog :deep(.download-form .el-select .el-select__wrapper) {
  border-radius: 10px;
  min-height: 36px;
}

@media (max-width: 768px) {
  .download-form {
    padding: 0;
  }

  .download-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
