<template>
  <el-dialog
    v-model="visible"
    title="导入伪装"
    width="640px"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    @close="handleClose"
    @closed="handleClosed"
  >
    <!-- 步骤 1：选文件 -->
    <div
      v-if="step === 'pick'"
      class="import-step"
    >
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        :limit="1"
        accept=".disguise,.zip"
        drag
        class="disguise-uploader"
      >
        <el-icon class="el-icon--upload">
          <Icon :icon="iconMap.uploadFilled" />
        </el-icon>
        <div class="el-upload__text">
          将 .disguise 或 .zip 拖到此处，或<em>点击选择</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持单个 .disguise 文件或 .zip（内含若干 .disguise）
          </div>
        </template>
      </el-upload>

      <div
        v-if="selectedFile"
        class="file-info"
      >
        <div class="file-info-row">
          <span class="file-label">文件名：</span>
          <span class="file-value">{{ selectedFile.name }}</span>
        </div>
        <div class="file-info-row">
          <span class="file-label">大小：</span>
          <span class="file-value">{{ formatFileSize(selectedFile.size) }}</span>
        </div>
      </div>

      <div class="form-section">
        <div class="form-row">
          <span class="form-label">冲突策略</span>
          <el-radio-group
            v-model="conflictPolicy"
            size="small"
          >
            <el-radio-button value="skip">
              跳过已存在
            </el-radio-button>
            <el-radio-button value="overwrite">
              覆盖
            </el-radio-button>
            <el-radio-button value="rename">
              重命名导入
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="form-tip">
          disguiseId 由名称 + 版本号派生，同 ID 视为冲突。
          重命名会在 ID 后追加时间戳。
        </div>
      </div>
    </div>

    <!-- 步骤 2：结果 -->
    <div
      v-else
      class="import-step"
    >
      <div class="result-summary">
        <el-tag
          type="success"
          size="default"
        >
          已导入 {{ counts.imported }}
        </el-tag>
        <el-tag
          v-if="counts.overwritten"
          type="primary"
          size="default"
        >
          已覆盖 {{ counts.overwritten }}
        </el-tag>
        <el-tag
          v-if="counts.renamed"
          type="warning"
          size="default"
        >
          已重命名 {{ counts.renamed }}
        </el-tag>
        <el-tag
          v-if="counts.skipped"
          size="default"
        >
          已跳过 {{ counts.skipped }}
        </el-tag>
        <el-tag
          v-if="counts.failed"
          type="danger"
          size="default"
        >
          失败 {{ counts.failed }}
        </el-tag>
      </div>

      <el-table
        :data="results"
        size="small"
        border
        max-height="360"
        class="result-table"
      >
        <el-table-column
          label="名称"
          prop="disguiseName"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          label="伪装 ID"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <code>{{ row.disguiseId || '—' }}</code>
          </template>
        </el-table-column>
        <el-table-column
          label="结果"
          min-width="100"
        >
          <template #default="{ row }">
            <span :class="resultClass(row.status)">{{ statusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="说明"
          prop="message"
          min-width="180"
          show-overflow-tooltip
        />
      </el-table>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <template v-if="step === 'pick'">
          <el-button @click="handleClose">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="!selectedFile"
            @click="submit"
          >
            导入
          </el-button>
        </template>
        <template v-else>
          <el-button
            type="primary"
            @click="handleClose"
          >
            完成
          </el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFileSize } from '@/utils/format.js'
import { handleError } from '@/utils/errorHandler.js'
import { importDisguisesApi } from '@/services/api.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'

const iconMap = icons

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'imported'])

const visible = useDialogVisible(props, emit)

const uploadRef      = ref(null)
const selectedFile   = ref(null)
const conflictPolicy = ref('skip')
const submitting     = ref(false)
const step           = ref('pick')   // 'pick' | 'result'
const results        = ref([])

// ── 上传处理 ──────────────────────────────────────────────────────────────
const handleFileChange = (file) => {
  selectedFile.value = file.raw
}

const handleFileRemove = () => {
  selectedFile.value = null
}

// ── 提交 ──────────────────────────────────────────────────────────────────
const submit = async () => {
  if (!selectedFile.value) return
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    fd.append('conflictPolicy', conflictPolicy.value)
    const res = await importDisguisesApi(fd)
    results.value = res.data?.results || []
    step.value = 'result'
    emit('imported', { results: results.value })
  } catch (e) {
    handleError(e, { defaultMessage: '导入失败' })
  } finally {
    submitting.value = false
  }
}

// ── 统计 ──────────────────────────────────────────────────────────────────
const counts = computed(() => {
  const c = { imported: 0, overwritten: 0, renamed: 0, skipped: 0, failed: 0 }
  for (const r of results.value) {
    if (c[r.status] !== undefined) c[r.status] += 1
  }
  return c
})

// ── UI 辅助 ───────────────────────────────────────────────────────────────
const statusText = (status) => ({
  imported:    '已导入',
  overwritten: '已覆盖',
  renamed:     '已重命名',
  skipped:     '已跳过',
  failed:      '失败'
}[status] || status)

const resultClass = (status) => ({
  'result-imported':    status === 'imported',
  'result-overwritten': status === 'overwritten',
  'result-renamed':     status === 'renamed',
  'result-skipped':     status === 'skipped',
  'result-failed':      status === 'failed'
})

const handleClose = () => {
  if (submitting.value) return
  visible.value = false
}

const handleClosed = () => {
  selectedFile.value = null
  conflictPolicy.value = 'skip'
  step.value = 'pick'
  results.value = []
  uploadRef.value?.clearFiles?.()
}
</script>

<style scoped>
.import-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.disguise-uploader :deep(.el-upload-dragger) {
  padding: 32px 24px;
}

.file-info {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
}

.file-info-row {
  display: flex;
  gap: 6px;
  font-size: 13px;
  margin: 2px 0;
}

.file-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.file-value {
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-label {
  width: 84px;
  font-size: 13px;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  padding-left: 96px;
}

.result-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.result-table {
  width: 100%;
}

.result-table code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.result-imported    { color: var(--el-color-success);        font-weight: 600; }
.result-overwritten { color: var(--el-color-primary);        font-weight: 600; }
.result-renamed     { color: var(--el-color-warning);        font-weight: 600; }
.result-skipped     { color: var(--el-text-color-secondary);                   }
.result-failed      { color: var(--el-color-danger);         font-weight: 600; }
</style>
