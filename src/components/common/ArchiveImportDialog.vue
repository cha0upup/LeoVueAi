<template>
  <el-dialog
    v-model="visible"
    :title="title"
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
        :accept="`${extension},.zip`"
        drag
        class="archive-uploader"
      >
        <el-icon class="el-icon--upload">
          <Icon :icon="iconMap.uploadFilled" />
        </el-icon>
        <div class="el-upload__text">
          将 {{ extension }} 或 .zip 拖到此处，或<em>点击选择</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            {{ uploadTip }}
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
            <el-radio-button
              v-if="allowRename"
              value="rename"
            >
              重命名导入
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="form-tip">
          {{ conflictTip }}
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
          v-if="allowRename && counts.renamed"
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
          :label="nameLabel"
          :prop="nameField"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          :label="idLabel"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <code>{{ row[idField] || '—' }}</code>
          </template>
        </el-table-column>
        <el-table-column
          label="结果"
          :min-width="resultMinWidth"
        >
          <template #default="{ row }">
            <span :class="resultClass(row.status)">{{ statusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="说明"
          prop="message"
          :min-width="messageMinWidth"
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
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatFileSize } from '@/utils/format.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { useArchiveImport } from '@/composables/useArchiveImport.js'

const iconMap = icons
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  extension: { type: String, required: true },
  uploadTip: { type: String, required: true },
  conflictTip: { type: String, required: true },
  allowRename: { type: Boolean, default: false },
  nameLabel: { type: String, default: '名称' },
  nameField: { type: String, required: true },
  idLabel: { type: String, required: true },
  idField: { type: String, required: true },
  resultMinWidth: { type: Number, default: 100 },
  messageMinWidth: { type: Number, default: 180 },
  request: { type: Function, required: true }
})
const emit = defineEmits(['update:modelValue', 'imported'])
const visible = useDialogVisible(props, emit)

const {
  uploadRef, selectedFile, conflictPolicy, submitting, step, results,
  counts, statusText, resultClass, handleFileChange, handleFileRemove, submit,
  reset: handleClosed
} = useArchiveImport({
  request: (formData) => props.request(formData),
  onImported: (results) => emit('imported', { results })
})

const handleClose = () => {
  if (submitting.value) return
  visible.value = false
}
</script>

<style scoped src="@/styles/archive-import-dialog-shared.css" />
