<template>
  <el-dialog
    v-model="dialogVisible"
    title="解压文件"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
    class="file-decompress-dialog file-dialog-shell"
    append-to-body
    @close="handleClose"
  >
    <div class="decompress-content file-dialog-content">
      <FileOperationSummary
        :name="fileName"
        :path="filePath"
        :icon="iconMap.decompress"
        :badges="summaryBadges"
      />

      <div class="decompress-config">
        <div class="copy-strategy">
          <div class="strategy-pill">
            <span class="strategy-label">格式</span>
            <span class="strategy-value">{{ form.format.toUpperCase() }}</span>
          </div>
          <div class="strategy-pill">
            <span class="strategy-label">落点</span>
            <span class="strategy-value">解压到指定目录</span>
          </div>
        </div>

        <div class="target-strip">
          <span class="target-label">输出目录</span>
          <span class="target-path">{{ form.targetPath }}</span>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="100px"
        >
          <el-form-item
            label="解压格式"
            prop="format"
          >
            <el-select
              v-model="form.format"
              placeholder="选择解压格式"
              size="large"
              style="width: 100%"
            >
              <el-option
                v-for="format in COMPRESS_FORMATS"
                :key="format.value"
                :label="format.label"
                :value="format.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="目标路径"
            prop="targetPath"
          >
            <el-input
              v-model="form.targetPath"
              placeholder="请输入解压目标路径"
              clearable
              size="large"
            />
          </el-form-item>
        </el-form>

        <div class="dialog-footer file-dialog-footer decompress-actions">
          <el-button
            :disabled="decompressing"
            size="large"
            @click="handleClose"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="decompressing"
            size="large"
            class="decompress-btn"
            @click="handleDecompress"
          >
            <el-icon><Icon :icon="iconMap.files" /></el-icon>
            {{ decompressing ? '解压中...' : '开始解压' }}
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { formatFilePath } from '@/utils/format.js'
import { decompressFileApi } from '@/services/api.js'
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
const decompressing = ref(false)
const formRef = ref(null)

// 表单数据
const form = reactive({
  format: 'zip',
  targetPath: ''
})

// 计算属性
const fileName = computed(() => {
  return props.file.name || '未知文件'
})

const filePath = computed(() => {
  return joinPath(`${props.disk}${props.currentPath}`, props.file.name)
})

// 压缩格式选项
const COMPRESS_FORMATS = [
  { label: 'ZIP', value: 'zip' },
  { label: 'TAR.GZ', value: 'tar.gz' },
  { label: 'TAR', value: 'tar' },
  { label: 'GZIP', value: 'gzip' }
]

// 压缩格式映射
const FORMAT_MAP = {
  '.tar.gz': 'tar.gz',
  '.tgz': 'tar.gz',
  '.tar': 'tar',
  '.zip': 'zip',
  '.gzip': 'gzip',
  '.gz': 'gzip'
}

// 自动检测文件格式
const detectFormat = (filename) => {
  const lowerName = String(filename || '').toLowerCase()
  const matched = Object.keys(FORMAT_MAP).find((ext) => lowerName.endsWith(ext))
  return matched ? FORMAT_MAP[matched] : 'zip'
}

const stripArchiveExtension = (filename) => (
  String(filename || 'archive')
    .replace(/\.tar\.gz$/i, '')
    .replace(/\.tgz$/i, '')
    .replace(/\.(zip|tar|gzip|gz)$/i, '')
)

const normalizeDirectoryPath = (path) => {
  const formatted = formatFilePath(path || '/').replace(/\/\.$/, '')
  return formatted || '/'
}

const joinPath = (base, name) => {
  const normalizedBase = normalizeDirectoryPath(base)
  if (normalizedBase === '/') return formatFilePath(`/${name}`)
  return formatFilePath(`${normalizedBase}${normalizedBase.endsWith('/') ? '' : '/'}${name}`)
}

const activeFormatLabel = computed(() => (
  COMPRESS_FORMATS.find((format) => format.value === form.format)?.label || form.format.toUpperCase()
))

const summaryBadges = computed(() => [
  { label: activeFormatLabel.value, type: 'info' },
  { label: '解压到目录', type: 'primary' }
])

// 路径验证规则（仅限制真正危险的字符，允许盘符冒号和路径分隔符）
const PATH_PATTERN = /^[^*?"<>|]+$/
const PATH_ERROR_MSG = '路径不能包含特殊字符 * ? " < > |'

// 表单验证规则
const rules = {
  targetPath: [
    { required: true, message: '请输入解压目标路径', trigger: 'blur' },
    { pattern: PATH_PATTERN, message: PATH_ERROR_MSG, trigger: 'blur' }
  ]
}

// 方法
const openDialog = () => {
  dialogVisible.value = true
  resetForm()
}

const handleClose = () => {
  if (decompressing.value) return // 解压过程中不允许关闭

  dialogVisible.value = false
  emit('close')
}

const resetForm = () => {
  form.format = detectFormat(props.file.name)
  const baseDir = normalizeDirectoryPath(`${props.disk}${props.currentPath}`)
  form.targetPath = joinPath(baseDir, stripArchiveExtension(props.file.name))
  formRef.value?.clearValidate()
}

const handleDecompress = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  decompressing.value = true
  showInfo('正在解压...')

  try {
    // 规范化目标路径，确保 Windows 下自动补充盘符和分隔符
    const targetPath = formatFilePath(form.targetPath)

    await decompressFileApi({
      sessionId: props.sessionId,
      src: filePath.value,
      des: targetPath,
      format: form.format
    })
    showSuccess('解压成功')
    dialogVisible.value = false
    emit('refresh')
    emit('close')
  } catch (error) {
    showError(error.message || '解压失败，请重试')
  } finally {
    decompressing.value = false
  }
}

// 暴露方法
defineExpose({
  openDialog
})
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-decompress-dialog {
  --file-dialog-muted-surface: var(--app-control-background-soft);
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

/* 解压配置 */
.decompress-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.copy-strategy {
  display: flex;
  gap: 10px;
}

.strategy-pill {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--file-dialog-muted-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
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

.target-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 10px;
  background: var(--file-dialog-muted-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
}

.target-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.target-path {
  min-width: 0;
  word-break: break-all;
  color: var(--el-text-color-primary);
}

/* 对话框底部 */
.decompress-btn {
  min-width: 110px;
}

.decompress-btn .el-icon {
  margin-right: 4px;
}

.decompress-actions {
  margin-top: 18px;
}

.file-decompress-dialog :deep(.el-dialog__footer) {
  display: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .decompress-config {
    gap: 12px;
  }

  .copy-strategy,
  .decompress-actions,
  .target-strip {
    flex-direction: column;
    align-items: flex-start;
  }

  .decompress-btn {
    min-width: auto;
  }
}
</style>
