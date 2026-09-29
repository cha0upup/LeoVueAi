<template>
  <el-dialog
    v-model="visible"
    title="导入 Skill"
    width="640px"
    :close-on-click-modal="false"
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
        accept=".skill,.zip"
        drag
        class="archive-uploader"
      >
        <el-icon class="el-icon--upload">
          <Icon :icon="iconMap.uploadFilled" />
        </el-icon>
        <div class="el-upload__text">
          将 .skill 或 .zip 拖到此处，或<em>点击选择</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            必须同时包含 SKILL.md 与 manifest.yaml；导入后统一进入 draft + disabled
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
          <span class="form-label">目标 scope</span>
          <el-radio-group
            v-model="targetScope"
            size="small"
          >
            <el-radio-button value="puppet-node">
              puppet-node
            </el-radio-button>
            <el-radio-button value="platform">
              platform
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="form-row">
          <span class="form-label">名称<span class="form-hint">（仅单 skill 导入时使用）</span></span>
          <el-input
            v-model="defaultName"
            placeholder="若 zip 内是单个 skill，目标 skill 名"
            clearable
          />
        </div>
        <div class="form-row">
          <span class="form-label">冲突策略</span>
          <el-radio-group
            v-model="conflictPolicy"
            size="small"
          >
            <el-radio-button value="overwrite">
              覆盖
            </el-radio-button>
            <el-radio-button value="skip">
              跳过
            </el-radio-button>
          </el-radio-group>
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
          成功 {{ counts.imported }}
        </el-tag>
        <el-tag
          type="info"
          size="default"
        >
          覆盖 {{ counts.overwritten }}
        </el-tag>
        <el-tag size="default">
          跳过 {{ counts.skipped }}
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
        class="result-table"
      >
        <el-table-column
          prop="originalName"
          label="原名"
          min-width="160"
        />
        <el-table-column
          label="结果"
          min-width="160"
        >
          <template #default="{ row }">
            <span :class="resultClass(row.status)">{{ statusText(row.status) }}</span>
            <span
              v-if="row.finalName && row.finalName !== row.originalName"
              class="result-rename"
            >→ {{ row.finalName }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="message"
          label="说明"
          min-width="200"
        />
      </el-table>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="step === 'pick'"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          v-if="step === 'pick'"
          type="primary"
          :loading="submitting"
          :disabled="!selectedFile"
          @click="submit"
        >
          导入
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="handleClose"
        >
          完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFileSize } from '@/utils/format.js'
import { importSkillsApi } from '@/services/api.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { useArchiveImport } from '@/composables/useArchiveImport.js'

const iconMap = icons

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  defaultScope: { type: String, default: 'puppet-node' }
})

const emit = defineEmits(['update:modelValue', 'imported'])

const visible = useDialogVisible(props, emit)

const targetScope = ref(props.defaultScope)
const defaultName = ref('')

const {
  uploadRef, selectedFile, conflictPolicy, submitting, step, results,
  counts, statusText, resultClass, handleFileRemove, submit, reset,
  handleFileChange: selectFile
} = useArchiveImport({
  request: (formData) => {
    formData.append('scope', targetScope.value)
    if (defaultName.value.trim()) formData.append('defaultName', defaultName.value.trim())
    return importSkillsApi(formData)
  },
  onImported: (results, formData) => {
    emit('imported', { scope: formData.get('scope'), results })
  }
})

watch(
  () => props.defaultScope,
  (v) => {
    if (step.value === 'pick') targetScope.value = v
  }
)

const handleFileChange = (file) => {
  selectFile(file)
  // 自动用文件名（去后缀）作为 defaultName，方便单 skill 导入
  if (!defaultName.value) {
    const base = file.name.replace(/\.(skill|zip)$/i, '')
    if (/^[a-z0-9][a-z0-9-]{0,63}$/.test(base)) defaultName.value = base
  }
}

const handleClose = () => {
  visible.value = false
}

const handleClosed = () => {
  reset()
  defaultName.value = ''
}
</script>

<style scoped src="@/styles/archive-import-dialog-shared.css" />

<style scoped>
.file-label {
  flex-shrink: 1;
}

.file-value {
  word-break: inherit;
}

.form-section {
  gap: 12px;
}

.form-label {
  width: 96px;
}

.form-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-left: 4px;
}

.result-rename {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
