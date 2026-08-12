<template>
  <el-dialog
    v-model="visible"
    title="打包目录"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    align-center
    append-to-body
    class="file-pack-dialog file-dialog-shell"
    @close="handleClose"
  >
    <div class="pack-shell file-dialog-content">
      <FileOperationSummary
        :name="sourceName"
        :path="normalizedSourcePath"
        :icon="iconMap.folder"
        :badges="summaryBadges"
      />

      <div class="pack-config">
        <el-form
          label-position="top"
          size="default"
          class="pack-form"
          @submit.prevent="doPack"
        >
          <el-form-item label="保存路径">
            <el-input
              v-model="destPath"
              placeholder="留空则保存到系统临时目录"
              clearable
              size="large"
              @keyup.enter="doPack"
            >
              <template #prefix>
                <el-icon><Icon :icon="iconMap.folder" /></el-icon>
              </template>
            </el-input>
            <div class="path-preview">
              <el-icon><Icon :icon="iconMap.location" /></el-icon>
              <span>{{ outputPreview }}</span>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div
        v-if="resultData"
        class="result-card"
      >
        <div class="result-row">
          <span class="result-label">归档路径</span>
          <span class="mono result-value">{{ resultData.archivePath }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">文件大小</span>
          <span class="result-value">{{ formatSize(resultData.archiveSize) }}</span>
        </div>
        <div class="result-hint">
          可在文件管理器中找到该文件并下载
        </div>
      </div>

      <div
        v-if="errorMsg"
        class="error-msg"
      >
        {{ errorMsg }}
      </div>

      <div class="dialog-footer file-dialog-footer pack-actions">
        <el-button
          :disabled="loading"
          @click="visible = false"
        >
          关闭
        </el-button>
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!!resultData"
          class="pack-btn"
          @click="doPack"
        >
          <el-icon v-if="!loading">
            <Icon :icon="iconMap.compress" />
          </el-icon>
          {{ loading ? '打包中...' : '开始打包' }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { filePackApi } from '@/services/api/puppet-files.js'
import { showSuccess } from '@/utils/messageUtils.js'
import { formatFilePath, formatFileSize as formatSize } from '@/utils/format.js'
import FileOperationSummary from '@/components/PuppetConsole/File/FileOperationSummary.vue'

const iconMap = icons

const props = defineProps({
  sessionId: { type: String, required: true }
})

const visible    = ref(false)
const loading    = ref(false)
const sourcePath = ref('')
const destPath   = ref('')
const resultData = ref(null)
const errorMsg   = ref('')

const normalizeDisplayPath = (path) => formatFilePath(path || '/').replace(/\/\.$/, '') || '/'

const normalizedSourcePath = computed(() => normalizeDisplayPath(sourcePath.value))

const sourceName = computed(() => {
  const parts = normalizedSourcePath.value.split('/').filter(Boolean)
  return parts.at(-1) || '根目录'
})

const outputPreview = computed(() => {
  const target = destPath.value.trim()
  return target ? formatFilePath(target) : '系统临时目录'
})

const summaryBadges = computed(() => [
  { label: 'TAR.GZ', type: 'info' },
  { label: resultData.value ? '已完成' : '待打包', type: resultData.value ? 'success' : 'primary' }
])

function openDialog(path) {
  sourcePath.value = path || '/'
  destPath.value   = ''
  resultData.value = null
  errorMsg.value   = ''
  visible.value    = true
}

async function doPack() {
  loading.value  = true
  errorMsg.value = ''
  try {
    const res = await filePackApi({
      sessionId: props.sessionId,
      path:      sourcePath.value,
      destPath:  destPath.value || undefined
    })
    const data = res.data
    if (data?.archivePath) {
      resultData.value = data
      showSuccess('打包成功')
    } else {
      errorMsg.value = data?.msg || '打包失败'
    }
  } catch (e) {
    errorMsg.value = e?.response?.data?.msg || e.message || '请求失败'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  resultData.value = null
  errorMsg.value   = ''
}

defineExpose({ openDialog })
</script>

<style scoped>
@import '@/styles/file-operation-dialog-shared.css';

.file-pack-dialog {
  --file-pack-panel-surface: color-mix(in srgb, var(--app-control-background-soft) 86%, var(--el-bg-color));
  --file-pack-raised-surface: color-mix(in srgb, var(--el-bg-color-overlay) 92%, var(--app-control-background-soft));
  --file-dialog-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

:global(html:not(.dark) .file-pack-dialog),
:global(html[data-theme='light'] .file-pack-dialog) {
  --file-pack-panel-surface: #f7f9fc;
  --file-pack-raised-surface: #ffffff;
  --file-dialog-soft-border: rgba(30, 41, 59, 0.1);
}

.pack-shell {
  padding: 0;
}

.pack-config {
  padding: 12px;
  border-radius: 12px;
  background: var(--file-pack-panel-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
}

.pack-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.pack-form :deep(.el-form-item__label) {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.pack-form :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: 10px;
}

.path-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 9px;
  background: var(--file-pack-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-dialog-soft-border) 88%, transparent);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.path-preview .el-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
}

.path-preview span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-card {
  background: color-mix(in srgb, var(--el-color-success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-success) 20%, transparent);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.result-label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  width: 60px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-value {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.result-hint {
  font-size: 11px;
  color: var(--el-color-success);
  margin-top: 2px;
}

.error-msg {
  display: flex;
  align-items: center;
  color: var(--el-color-danger);
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--file-pack-raised-surface));
  border: 1px solid color-mix(in srgb, var(--el-color-danger) 18%, transparent);
}

.pack-actions {
  margin-top: 0;
  padding-top: 2px;
  align-items: center;
}

.pack-btn {
  min-width: 100px;
}

.pack-btn .el-icon {
  margin-right: 4px;
}

.file-pack-dialog :deep(.el-dialog__footer) {
  display: none;
}

@media (max-width: 768px) {
  .file-pack-dialog {
    width: 92vw !important;
  }

  .pack-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .pack-actions .el-button {
    width: 100%;
  }

  .path-preview span {
    white-space: normal;
    word-break: break-all;
  }
}
</style>
