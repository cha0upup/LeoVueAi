<template>
  <el-dialog
    v-model="uploadVisible"
    title="文件上传"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    class="file-upload-dialog file-dialog-shell"
  >
    <div class="upload-content file-dialog-content">
      <FileOperationSummary
        :name="summaryName"
        :path="summaryPath"
        :icon="summaryIcon"
        :icon-color="summaryIconColor"
        :badges="summaryBadges"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="upload-form"
      >
        <div
          v-if="fileList.length === 0"
          class="file-select-area"
        >
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :multiple="false"
            :accept="acceptedFileTypes"
            drag
            class="upload-dragger"
          >
            <el-icon class="el-icon--upload">
              <Icon :icon="iconMap.uploadFilled" />
            </el-icon>
            <div class="el-upload__text">
              拖入文件或点击选择
            </div>
          </el-upload>
        </div>

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

      <div class="dialog-footer file-dialog-footer upload-actions">
        <el-button @click="handleClose">
          取消
        </el-button>

        <el-button
          type="primary"
          :disabled="fileList.length === 0"
          @click="startUpload"
        >
          <el-icon>
            <Icon :icon="iconMap.uploadFilled" />
          </el-icon>
          开始上传
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
import { getFileIconPresentation } from '@/utils/fileIcons.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// 响应式数据
const uploadVisible = ref(false)
const dialogSessionId = ref('')
const fullCurrentPath = ref('')

const form = reactive({
  serverPath: '',
  concurrency: 3,
  chunkSize: 524288
})

const formRef = ref(null)
const uploadRef = ref(null)
const fileList = ref([])
const currentTaskIds = ref(new Map())

// 常量
const acceptedFileTypes = '*'

const fileIconPresentation = computed(() =>
  getFileIconPresentation({
    name: fileList.value[0]?.name || ''
  })
)

const selectedFile = computed(() => fileList.value[0] || null)

const summaryName = computed(() => selectedFile.value?.name || '选择本地文件')

const summaryPath = computed(() => (
  selectedFile.value
    ? formatFilePath(`${form.serverPath}${selectedFile.value.name}`)
    : formatFilePath(form.serverPath)
))

const summaryIcon = computed(() => (
  selectedFile.value ? fileIconPresentation.value.icon : iconMap.uploadFilled
))

const summaryIconColor = computed(() => (
  selectedFile.value ? fileIconPresentation.value.color : ''
))

const summaryBadges = computed(() => [
  { label: '单文件', type: 'info' },
  { label: selectedFile.value ? formatSize(selectedFile.value.size) : '', type: 'info' }
])

// 表单验证规则
const rules = {
  serverPath: [{ required: true, message: '请输入存储路径', trigger: 'blur' }],
  concurrency: [{ required: true, message: '请选择并发数', trigger: 'change' }],
  chunkSize: [{ required: true, message: '请选择块大小', trigger: 'change' }]
}

// 方法
const openDialog = (sessionIdParam, fullCurrentPathParam) => {
  uploadVisible.value = true
  dialogSessionId.value = sessionIdParam
  fullCurrentPath.value = fullCurrentPathParam
  form.serverPath = fullCurrentPathParam + '/'
  resetForm()
}

const handleClose = () => {
  uploadVisible.value = false
}

const resetForm = () => {
  form.serverPath = `${fullCurrentPath.value}/`
  form.concurrency = 3
  form.chunkSize = 524288
  fileList.value = []
  currentTaskIds.value.clear()
}

const handleFileChange = (file) => {
  // 单文件上传模式：清空旧文件
  if (fileList.value.length > 0) {
    fileList.value = []
    currentTaskIds.value.clear()
  }

  // 添加到文件列表
  fileList.value.push(file)
  showSuccess(`文件 ${file.name} 已添加`)
}

const handleFileRemove = (file) => {
  const index = fileList.value.findIndex((f) => f.uid === file.uid)
  if (index > -1) {
    fileList.value.splice(index, 1)
    currentTaskIds.value.delete(file.uid)
  }
}

const startUpload = async () => {
  if (fileList.value.length === 0) {
    showWarning('请选择要上传的文件')
    return
  }

  try {
    // 为每个文件创建上传任务
    for (const file of fileList.value) {
      const taskId = taskEngine.createUploadTask(
        dialogSessionId.value,
        form.serverPath,
        file.name,
        file.size,
        file.raw,
        {
          chunkSize: form.chunkSize,
          concurrency: form.concurrency,
          maxRetries: 3,
          background: true
        }
      )
      currentTaskIds.value.set(file.uid, taskId)
      taskEngine.startTask(taskId).catch(() => {})
    }

    showSuccess('上传已开始，可在任务管理器中查看进度')
    handleClose()
  } catch (error) {
    showError(`上传失败: ${error.message}`)
  }
}

const iconMap = icons

// 暴露方法
defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-upload-dialog {
  --file-dialog-muted-surface: var(--app-control-background-soft);
  --file-upload-panel-surface: var(--app-dialog-intro-background);
  --file-dialog-raised-surface: var(--app-dialog-subtle-background);
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

:global(html:not(.dark) .file-upload-dialog),
:global(html[data-theme='light'] .file-upload-dialog) {
  --file-dialog-muted-surface: #f7f9fc;
  --file-upload-panel-surface: #f7f9fc;
  --file-dialog-raised-surface: #ffffff;
  --file-dialog-soft-border: rgba(30, 41, 59, 0.1);
}

.upload-content {
  padding: 0;
}

.upload-form {
  padding: 0 4px;
}

.upload-actions {
  margin-top: 0;
  padding-top: 2px;
  align-items: center;
}

.file-upload-dialog :deep(.el-dialog__footer) {
  display: none;
}

.file-select-area {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.upload-dragger {
  width: 100%;
}

:deep(.el-upload-dragger) {
  border-radius: var(--radius-container);
  border: 1px dashed color-mix(in srgb, var(--file-dialog-soft-border) 72%, transparent);
  background: var(--file-upload-panel-surface);
  padding: 22px 16px;
}

:deep(.el-upload-dragger:hover) {
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, var(--file-dialog-soft-border));
  background: color-mix(
    in srgb,
    var(--file-upload-panel-surface) 86%,
    var(--file-dialog-raised-surface)
  );
}

:deep(.upload-form .el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

:deep(.upload-form .el-input-number),
:deep(.upload-form .el-select) {
  width: 100%;
}

:deep(.upload-form .el-input-number .el-input__wrapper),
:deep(.upload-form .el-select .el-select__wrapper) {
  border-radius: var(--radius-control);
  min-height: 36px;
}

@media (max-width: 768px) {
  .upload-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
