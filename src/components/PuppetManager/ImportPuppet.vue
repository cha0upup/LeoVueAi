<template>
  <el-dialog
    v-model="ImportPuppetDialog"
    width="900px"
    top="4vh"
    draggable
    class="puppet-dialog import-puppet-dialog"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-title-row">
          <el-icon class="intro-icon">
            <Icon :icon="iconMap.upload" />
          </el-icon>
          <div>
            <h3>导入主机配置</h3>
          </div>
        </div>
      </div>
    </template>

    <div class="host-form import-content">
      <!-- 导入步骤指示器 -->
      <div class="step-indicator">
        <div
          class="step-item"
          :class="{ active: currentStep === 1, completed: currentStep > 1 }"
        >
          <div class="step-number">
            1
          </div>
          <div class="step-text">
            上传配置
          </div>
        </div>
        <div
          class="step-line"
          :class="{ completed: currentStep > 1 }"
        />
        <div
          class="step-item"
          :class="{ active: currentStep === 2 }"
        >
          <div class="step-number">
            2
          </div>
          <div class="step-text">
            确认信息
          </div>
        </div>
      </div>

      <!-- 步骤1：导入方式切换 -->
      <div
        v-show="currentStep === 1"
        class="import-section"
      >
        <div class="import-tabs">
          <el-radio-group
            v-model="importType"
            class="import-type-switch"
          >
            <el-radio-button value="paste">
              <el-icon><Icon :icon="iconMap.document" /></el-icon>
              粘贴配置内容
            </el-radio-button>
            <el-radio-button value="upload">
              <el-icon><Icon :icon="iconMap.upload" /></el-icon>
              上传文件
            </el-radio-button>
          </el-radio-group>
        </div>

        <!-- 粘贴配置内容 -->
        <div
          v-show="importType === 'paste'"
          class="text-input-section"
        >
          <div class="section-heading">
            <div>
              <strong>配置内容</strong>
            </div>
          </div>
          <el-input
            v-model="fileContent"
            type="textarea"
            :autosize="{ minRows: 8, maxRows: 14 }"
            placeholder="请粘贴 Base64 编码的配置文件内容"
            class="config-textarea"
          />
        </div>

        <!-- 上传文件 -->
        <div
          v-show="importType === 'upload'"
          class="upload-area"
          :class="{ 'drag-over': isDragOver }"
          @drop.prevent="handleDrop"
          @dragover.prevent
          @dragenter.prevent="isDragOver = true"
          @dragleave.prevent="handleDragLeave"
        >
          <div class="upload-content">
            <el-icon class="upload-icon">
              <Icon :icon="iconMap.upload" />
            </el-icon>
            <h3 class="upload-title">
              拖拽配置文件到此处
            </h3>
            <p class="upload-desc">
              或点击选择文件
            </p>
            <el-button
              type="primary"
              @click="selectFile"
            >
              <el-icon><Icon :icon="iconMap.folderOpened" /></el-icon>
              选择文件
            </el-button>
            <input
              ref="fileInput"
              type="file"
              accept=".json,.txt"
              style="display: none"
              @change="handleFileSelect"
            >
          </div>
        </div>
      </div>

      <!-- 步骤2：配置确认表单 -->
      <div
        v-show="currentStep === 2"
        class="form-section import-confirm-section"
      >
        <div class="batch-list-header">
          <el-checkbox
            :model-value="batchAllSelected"
            :indeterminate="batchIndeterminate"
            @change="toggleSelectAll"
          >
            选择全部目标主机
          </el-checkbox>
          <span class="batch-selection-summary">
            {{ batchSelectionSummary }}
          </span>
        </div>
        <div class="batch-list">
          <div
            v-for="(item, index) in batchPuppets"
            :key="item.__transferId"
            class="batch-list-item"
            :class="{ selected: batchSelectedIndices.has(index) }"
          >
            <el-checkbox
              :model-value="isBatchItemChecked(item, index)"
              :disabled="!isSelectableTargetItem(item)"
              @change="toggleBatchItem(index)"
            />
            <span class="batch-item-level">{{ item.__depth + 1 }}</span>
            <div class="batch-item-info">
              <span class="batch-item-name">{{ item.puppetName || '未命名主机' }}</span>
              <span class="batch-item-link">{{ item.connLink || '无连接地址' }}</span>
            </div>
            <el-tag
              size="small"
              :type="isDependencyItem(item) ? 'info' : 'primary'"
              effect="light"
            >
              {{ isDependencyItem(item) ? '祖先依赖' : '目标主机' }}
            </el-tag>
            <span class="batch-item-proto">{{ item.type || 'java' }} / {{ item.protocol || '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-actions">
        <el-button
          class="cancel-btn"
          @click="close"
        >
          <el-icon><Icon :icon="iconMap.close" /></el-icon>
          取消
        </el-button>
        <el-button
          v-if="currentStep === 1"
          type="primary"
          class="submit-btn"
          :disabled="!fileContent.trim()"
          @click="parseContent"
        >
          <el-icon><Icon :icon="iconMap.codeGenerator" /></el-icon>
          解析配置
        </el-button>
        <el-button
          v-if="currentStep === 1 && fileContent.trim()"
          class="cancel-btn"
          @click="clearContent"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          清空
        </el-button>
        <el-button
          v-if="currentStep === 2"
          type="primary"
          :loading="isSubmitting"
          :disabled="batchSelectedIndices.size === 0"
          class="submit-btn"
          @click="handleBatchSubmit"
        >
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          {{ isSubmitting ? '导入中...' : batchSubmitLabel }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'

import { icons } from '@/utils/icons.js'
import { createDefaultPuppet } from '@/utils/constants.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { addPuppetApi } from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { usePuppetImportBatch } from '@/composables/usePuppetImportBatch.js'
import { decodePuppetTransferPayload, parsePuppetTransferPayload } from '@/utils/puppetTransfer.js'

const emit = defineEmits(['refresh'])
const props = defineProps({
  projectId: { type: String, default: '' }
})

// 使用对话框工具
const dialog = useDialog()
const ImportPuppetDialog = dialog.visible

const iconMap = icons
const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024

const fileContent = ref('')
const currentStep = ref(1)
const importType = ref('paste')
const isDragOver = ref(false)
const isSubmitting = ref(false)

const {
  batchPuppets,
  batchSelectedIndices,
  batchAllSelected,
  batchIndeterminate,
  batchSelectionSummary,
  batchSubmitLabel,
  selectedBatchPuppets,
  isDependencyItem,
  isSelectableTargetItem,
  isBatchItemChecked,
  toggleSelectAll,
  toggleBatchItem,
  loadBundle,
  resetBatch
} = usePuppetImportBatch()

const fileInput = ref(null)
let activeFileReader = null
let fileReadSequence = 0

const canProceed = computed(() => fileContent.value.trim().length > 0)

const normalizeImportedPuppet = (config = {}) => {
  const source = config && typeof config === 'object' ? config : {}
  return createDefaultPuppet({
    ...source,
    type: source.type || 'java'
  })
}

const getTransferDepth = (record, byId) => {
  let depth = 0
  let current = record
  const visited = new Set()
  while (current?.parentTransferId) {
    if (visited.has(current.transferId)) break
    visited.add(current.transferId)
    current = byId.get(current.parentTransferId)
    if (current) depth += 1
  }
  return depth
}

const selectFile = () => {
  if (fileInput.value) fileInput.value.value = ''
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files?.[0]
  if (file) readFile(file)
}

const handleDrop = (event) => {
  isDragOver.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    readFile(files[0])
  }
}

const handleDragLeave = (event) => {
  if (event.currentTarget?.contains(event.relatedTarget)) return
  isDragOver.value = false
}

const cancelFileRead = () => {
  fileReadSequence += 1
  if (activeFileReader?.readyState === FileReader.LOADING) activeFileReader.abort()
  activeFileReader = null
}

const readFile = (file) => {
  if (!file) return
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    showWarning('配置文件超过 10 MB，请拆分后再导入')
    return
  }

  cancelFileRead()
  const requestId = fileReadSequence
  const reader = new FileReader()
  activeFileReader = reader
  reader.onload = (e) => {
    if (requestId !== fileReadSequence) return
    fileContent.value = String(e.target?.result || '')
    activeFileReader = null
  }
  reader.onerror = () => {
    if (requestId !== fileReadSequence) return
    activeFileReader = null
    showError('读取配置文件失败，请重新选择文件')
  }
  reader.readAsText(file)
}

const parseContent = () => {
  if (!fileContent.value.trim()) {
    showError('请输入有效的配置内容')
    return
  }
  try {
    const parsed = decodePuppetTransferPayload(fileContent.value)
    const transfer = parsePuppetTransferPayload(parsed)

    const byId = new Map(transfer.records.map((record) => [record.transferId, record]))
    const importedPuppets = transfer.records.map((record) => ({
      ...normalizeImportedPuppet({
        ...record.config,
        parentPuppetId: record.parentTransferId || 'root'
      }),
      __transferId: record.transferId,
      __parentTransferId: record.parentTransferId,
      __depth: getTransferDepth(record, byId)
    }))
    loadBundle(importedPuppets, transfer.targetIds)
    nextStep()
    showSuccess(
      `配置包解析成功：${transfer.targetIds.size} 台目标主机，${importedPuppets.length - transfer.targetIds.size} 台祖先依赖`
    )
  } catch (error) {
    showError(error?.message || '解析配置失败，请确保文件格式正确')
  }
}

const clearContent = () => {
  cancelFileRead()
  fileContent.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

const nextStep = () => {
  if (canProceed.value) {
    currentStep.value = 2
  }
}

const handleBatchSubmit = async () => {
  if (isSubmitting.value) return
  const targets = selectedBatchPuppets.value
  if (!targets.length) return

  isSubmitting.value = true
  try {
    const importedIdMap = new Map()
    let successCount = 0
    let failCount = 0

    for (const item of targets) {
      const parentTransferId = item.__parentTransferId
      if (parentTransferId && !importedIdMap.has(parentTransferId)) {
        failCount += 1
        continue
      }
      const transferId = item.__transferId
      const config = { ...item }
      delete config.__transferId
      delete config.__parentTransferId
      delete config.__depth
      try {
        const response = await addPuppetApi(
          {
            ...config,
            parentPuppetId: parentTransferId ? importedIdMap.get(parentTransferId) : 'root'
          },
          { projectId: props.projectId }
        )
        const newPuppetId = response.data?.puppetId
        if (!newPuppetId) throw new Error('服务端未返回新主机 ID')
        importedIdMap.set(transferId, newPuppetId)
        successCount += 1
      } catch {
        failCount += 1
      }
    }

    if (failCount === 0) {
      showSuccess(`主机配置包导入成功，共创建 ${successCount} 台主机并恢复完整层级`)
    } else if (successCount > 0) {
      showWarning(`部分导入成功：${successCount} 台成功，${failCount} 台失败或因父节点失败而跳过`)
    } else {
      showError('配置包导入失败，未创建任何主机')
      return
    }
    refresh()
    close()
  } finally {
    isSubmitting.value = false
  }
}

const close = () => {
  dialog.close()
  resetForm()
}

const resetForm = () => {
  currentStep.value = 1
  importType.value = 'paste'
  cancelFileRead()
  fileContent.value = ''
  isDragOver.value = false
  resetBatch()
}

const refresh = () => {
  emit('refresh')
}

const openImportPuppet = () => {
  dialog.open()
}

defineExpose({
  openImportPuppet,
  close
})
</script>

<style scoped>
@import '@/styles/puppet-form-dialog-shared.css';

/* 步骤指示器 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  padding: 10px 0 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 45%, transparent);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-border-color);
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: all 0.3s ease;
}

.step-item.active .step-number {
  background: var(--el-color-primary);
  color: white;
}

.step-item.completed .step-number {
  background: var(--el-color-success);
  color: white;
}

.step-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.step-line {
  width: 60px;
  height: 2px;
  background: var(--el-border-color);
  margin: 0 16px;
  transition: all 0.3s ease;
}

.step-line.completed {
  background: var(--el-color-success);
}

/* 导入区域 */
.import-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.import-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.import-type-switch {
  width: 100%;
  display: flex;
  gap: 0;
}

.import-type-switch :deep(.el-radio-button) {
  flex: 1;
}

.import-type-switch :deep(.el-radio-button__inner) {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
}

/* 上传区域 */
.upload-area {
  border: 2px dashed var(--el-border-color);
  border-radius: var(--radius-container);
  padding: var(--el-spacing-extra-large);
  text-align: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--dialog-surface-muted);
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 14%, var(--dialog-surface-muted));
  box-shadow: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.upload-icon {
  font-size: clamp(2.5rem, 3vw, 3rem); /* 40px - 48px，基于视口宽度自适应 */
  color: var(--el-color-primary);
}

.upload-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.upload-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

/* 文本输入区域 */
.text-input-section {
  min-width: 0;
}

.config-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

/* 滚动条样式 */
/* 批量导入列表 */
.batch-list-header {
  padding: 10px 14px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  margin-bottom: 6px;
}

.batch-selection-summary {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
  padding: 4px 2px 8px;
}

.batch-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  background: var(--dialog-surface-muted);
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.batch-list-item.selected {
  border-color: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 5%, var(--dialog-surface-muted));
}

.batch-item-level {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-tag);
  background: var(--app-control-background-soft);
  color: var(--el-text-color-secondary);
  font-family: var(--font-family-code);
  font-size: 10px;
}

.batch-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.batch-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-item-link {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-item-proto {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
}

.form-section::-webkit-scrollbar {
  width: 6px;
}

.form-section::-webkit-scrollbar-track {
  background: var(--el-border-color-extra-light);
  border-radius: var(--el-border-radius-small);
}

.form-section::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: var(--el-border-radius-small);
}

.form-section::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-secondary);
}
</style>
