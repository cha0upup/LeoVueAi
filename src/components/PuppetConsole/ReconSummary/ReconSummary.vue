<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="recon-page">
    <div class="recon-panel">
      <!-- ── Toolbar ── -->
      <div class="recon-toolbar">
        <div class="toolbar-left">
          <span
            v-if="hasSummary"
            class="status-badge status-has"
          >
            <Icon
              icon="mdi:check-circle-outline"
              class="status-icon"
            />
            已有摘要
          </span>
          <span
            v-else
            class="status-badge status-empty"
          >
            <Icon
              icon="mdi:information-outline"
              class="status-icon"
            />
            暂无摘要
          </span>
          <!-- 摘要过长提示 -->
          <el-tooltip
            v-if="summaryNeedsOrganize && !isEditing"
            content="摘要内容较多，建议 AI 整理去重"
            placement="bottom"
            :show-after="300"
          >
            <span
              class="status-badge status-organize-hint"
              style="cursor:pointer"
              @click="handleOrganize"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                class="status-icon"
              />
              建议整理
            </span>
          </el-tooltip>
          <span class="toolbar-hint">自动注入 AI 上下文 · 跨新建会话保留</span>
        </div>

        <div class="toolbar-actions">
          <!-- 预览态 -->
          <template v-if="!isEditing">
            <el-button
              size="small"
              :loading="loading"
              text
              @click="handleRefresh"
            >
              <Icon icon="mdi:refresh" />
              刷新
            </el-button>
            <el-button
              size="small"
              :loading="organizing"
              :disabled="!hasSummary || loading"
              @click="handleOrganize"
            >
              <Icon icon="mdi:auto-fix" />
              AI整理
            </el-button>
            <el-button
              type="primary"
              plain
              size="small"
              :disabled="loading"
              @click="startEdit"
            >
              <Icon icon="mdi:pencil-outline" />
              编辑
            </el-button>
            <el-button
              size="small"
              :loading="exportingReport"
              @click="handleExportReport"
            >
              <Icon icon="mdi:file-export-outline" />
              导出报告
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :disabled="!hasSummary || loading"
              @click="confirmClear"
            >
              <Icon icon="mdi:trash-can-outline" />
              清空
            </el-button>
          </template>

          <!-- 编辑态 -->
          <template v-else>
            <span
              v-if="isDirty"
              class="dirty-indicator"
              title="有未保存的修改"
            >●</span>
            <span class="char-count">{{ editContent.length }} 字符</span>
            <el-button
              size="small"
              :disabled="saving"
              @click="cancelEdit"
            >
              取消
            </el-button>
            <el-button
              size="small"
              type="primary"
              :loading="saving"
              :disabled="!isDirty"
              @click="handleSave"
            >
              <Icon icon="mdi:content-save-outline" />
              保存
            </el-button>
          </template>
        </div>
      </div>

      <!-- ── Loading ── -->
      <div
        v-if="loading && !isEditing"
        class="recon-state"
      >
        <el-skeleton
          :rows="8"
          animated
        />
      </div>

      <!-- ── Editor ── -->
      <div
        v-else-if="isEditing"
        class="recon-editor-wrap"
      >
        <textarea
          ref="editorRef"
          v-model="editContent"
          class="recon-editor"
          placeholder="在此输入侦察摘要（支持 Markdown）

例如：
## 目标概览
- OS: Ubuntu 22.04 / CentOS 7
- 中间件: Tomcat 9.0.x / Java OpenJDK 11

## 已发现凭据线索
- JDBC: jdbc:mysql://db-internal:3306/app
- Redis: 127.0.0.1:6379（无密码）

## 内网存活主机
- 10.0.0.0/24 发现 12 台存活"
          spellcheck="false"
        />
        <div class="editor-tip">
          Ctrl+S 保存 · Esc 取消
        </div>
      </div>

      <!-- ── Empty state ── -->
      <div
        v-else-if="!hasSummary"
        class="recon-empty"
      >
        <div class="empty-icon-wrap">
          <Icon
            icon="mdi:text-box-search-outline"
            class="empty-icon"
          />
        </div>
        <p class="empty-title">
          暂无侦察摘要
        </p>
        <p class="empty-desc">
          侦察摘要记录目标节点的关键情报，AI 对话时会自动引用。<br>可通过 AI 助理执行侦察后自动积累，或在此手动编写。
        </p>
        <el-button
          type="primary"
          plain
          size="small"
          @click="startEdit"
        >
          <Icon icon="mdi:pencil-outline" />
          开始编写
        </el-button>
      </div>

      <!-- ── Preview ── -->
      <div
        v-else
        class="recon-preview"
      >
        <div
          class="recon-md"
          v-html="renderedSummary"
        />
      </div>

      <!-- ── Append panel（仅预览态且已有摘要时显示）── -->
      <div
        v-if="!isEditing && hasSummary"
        class="recon-append-panel"
      >
        <div class="append-label">
          <Icon
            icon="mdi:plus-circle-outline"
            class="append-label-icon"
          />
          追加内容
        </div>
        <div class="append-body">
          <el-input
            v-model="appendContent"
            type="textarea"
            :rows="2"
            placeholder="追加到摘要末尾（支持 Markdown）"
            resize="none"
          />
          <el-button
            type="primary"
            size="small"
            :loading="appending"
            :disabled="!appendContent.trim()"
            @click="handleAppend"
          >
            追加
          </el-button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── AI整理对比弹窗 ── -->
  <el-dialog
    v-model="organizeDialogVisible"
    title="AI 整理预览"
    width="860px"
    :close-on-click-modal="false"
    class="organize-dialog"
  >
    <div class="organize-diff">
      <div class="diff-pane diff-pane-before">
        <div class="diff-pane-header">
          <Icon
            icon="mdi:file-document-outline"
            class="diff-pane-icon"
          />
          原始摘要
        </div>
        <div
          class="diff-pane-body recon-md"
          v-html="renderedSummary"
        />
      </div>
      <div class="diff-divider">
        <Icon
          icon="mdi:arrow-right-bold"
          class="diff-arrow"
        />
      </div>
      <div class="diff-pane diff-pane-after">
        <div class="diff-pane-header diff-pane-header-after">
          <Icon
            icon="mdi:auto-fix"
            class="diff-pane-icon"
          />
          AI 整理后
        </div>
        <div
          class="diff-pane-body recon-md"
          v-html="renderedOrganized"
        />
      </div>
    </div>
    <template #footer>
      <div class="organize-dialog-footer">
        <span class="organize-dialog-hint">确认后将用整理结果替换当前摘要，此操作不可撤销。</span>
        <div class="organize-dialog-actions">
          <el-button @click="organizeDialogVisible = false">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            @click="confirmOrganize"
          >
            <Icon icon="mdi:content-save-outline" />
            确认替换
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { Icon } from '@iconify/vue'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { renderAssistantMarkdown } from '@/utils/ai.js'
import { emitAppEvent, useAppEvent } from '@/composables/useAppEvent.js'
import {
  getReconSummaryApi,
  setReconSummaryApi,
  appendReconSummaryApi,
  clearReconSummaryApi,
  organizeReconSummaryApi,
  generateReconReportApi
} from '@/services/api.js'

const props = defineProps({
  sessionId: { type: String, required: true }
})

// ─── State ────────────────────────────────────────────────────────────────────
const summary       = ref('')
const loading       = ref(false)
const saving        = ref(false)
const appending     = ref(false)
const organizing    = ref(false)
const isEditing     = ref(false)
const editContent   = ref('')
const appendContent = ref('')
const editorRef     = ref(null)

// AI整理对话框
const organizeDialogVisible = ref(false)
const organizedContent      = ref('')

const ORGANIZE_THRESHOLD = 3000

const exportingReport = ref(false)

// ─── Computed ─────────────────────────────────────────────────────────────────
const hasSummary        = computed(() => summary.value.trim().length > 0)
const isDirty           = computed(() => editContent.value !== summary.value)
const renderedSummary   = computed(() => renderAssistantMarkdown(summary.value))
const renderedOrganized = computed(() => renderAssistantMarkdown(organizedContent.value))
const summaryNeedsOrganize = computed(() => summary.value.length >= ORGANIZE_THRESHOLD)

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchSummary() {
  if (!props.sessionId) return
  loading.value = true
  try {
    const res = await getReconSummaryApi({ sessionId: props.sessionId })
    summary.value = res.data?.reconSummary || ''
  } catch {
    showError('加载侦察摘要失败')
  } finally {
    loading.value = false
  }
}

// ─── Edit ─────────────────────────────────────────────────────────────────────
function startEdit() {
  editContent.value = summary.value
  isEditing.value = true
  nextTick(() => editorRef.value?.focus())
}

function cancelEdit() {
  if (isDirty.value) {
    confirmAction({
      title: '放弃编辑',
      message: '有未保存的内容，确认放弃？',
      confirmButtonText: '放弃',
      cancelButtonText: '继续编辑'
    }).then((confirmed) => {
      if (confirmed) isEditing.value = false
    })
  } else {
    isEditing.value = false
  }
}

async function handleSave() {
  if (!props.sessionId || !isDirty.value) return
  saving.value = true
  try {
    const res = await setReconSummaryApi({
      sessionId: props.sessionId,
      reconSummary: editContent.value
    })
    summary.value = res.data?.reconSummary ?? editContent.value
    isEditing.value = false
    showSuccess('侦察摘要已保存')
    emitAppEvent('recon-summary-updated', { sessionId: props.sessionId, exists: !!summary.value.trim() })
  } catch {
    showError('保存失败')
  } finally {
    saving.value = false
  }
}

// ─── Append ───────────────────────────────────────────────────────────────────
async function handleAppend() {
  if (!appendContent.value.trim() || !props.sessionId) return
  appending.value = true
  try {
    const res = await appendReconSummaryApi({
      sessionId: props.sessionId,
      content: appendContent.value.trim()
    })
    summary.value = res.data?.reconSummary || ''
    appendContent.value = ''
    showSuccess('内容已追加')
    emitAppEvent('recon-summary-updated', { sessionId: props.sessionId, exists: !!summary.value.trim() })
  } catch {
    showError('追加失败')
  } finally {
    appending.value = false
  }
}

// ─── Clear ────────────────────────────────────────────────────────────────────
async function confirmClear() {
  if (!hasSummary.value) return
  const confirmed = await confirmAction({
    title: '清空侦察摘要',
    message: '清空后无法恢复，确认清空当前侦察摘要？',
    confirmButtonText: '确认清空'
  })
  if (!confirmed) return
  try {
    await clearReconSummaryApi({ sessionId: props.sessionId })
    summary.value = ''
    showSuccess('摘要已清空')
    emitAppEvent('recon-summary-updated', { sessionId: props.sessionId, exists: false })
  } catch {
    showError('清空失败')
  }
}

async function handleRefresh() {
  await fetchSummary()
  showSuccess('已刷新')
}

// ─── AI Organize ──────────────────────────────────────────────────────────────
async function handleOrganize() {
  if (!hasSummary.value || organizing.value) return
  organizing.value = true
  try {
    const res = await organizeReconSummaryApi({ sessionId: props.sessionId })
    organizedContent.value = res.data?.organizedSummary || ''
    if (!organizedContent.value.trim()) {
      showError('AI 返回内容为空')
      return
    }
    organizeDialogVisible.value = true
  } catch {
    showError('AI 整理失败')
  } finally {
    organizing.value = false
  }
}

async function handleExportReport() {
  if (exportingReport.value) return
  exportingReport.value = true
  try {
    const res = await generateReconReportApi({ sessionId: props.sessionId })
    const report = res.data?.report
    const filename = res.data?.filename || 'recon-report.md'
    if (!report) {
      showError('报告内容为空')
      return
    }
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showSuccess('报告已导出')
  } catch {
    showError('导出报告失败')
  } finally {
    exportingReport.value = false
  }
}

async function confirmOrganize() {
  if (!organizedContent.value.trim()) return
  saving.value = true
  try {
    const res = await setReconSummaryApi({
      sessionId: props.sessionId,
      reconSummary: organizedContent.value
    })
    summary.value = res.data?.reconSummary ?? organizedContent.value
    organizeDialogVisible.value = false
    organizedContent.value = ''
    showSuccess('摘要已更新为整理版本')
    emitAppEvent('recon-summary-updated', { sessionId: props.sessionId, exists: !!summary.value.trim() })
  } catch {
    showError('保存失败')
  } finally {
    saving.value = false
  }
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function onKeydown(e) {
  if (!isEditing.value) return
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (isDirty.value) handleSave()
  }
  if (e.key === 'Escape') {
    cancelEdit()
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  fetchSummary()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

watch(
  () => props.sessionId,
  (val, old) => {
    if (!val || val === old) return
    if (isEditing.value) isEditing.value = false
    fetchSummary()
  }
)

// Refresh when another component updates the summary
useAppEvent('recon-summary-updated', ({ sessionId }) => {
  if (sessionId !== props.sessionId) return
  fetchSummary()
})
</script>

<style scoped>
.recon-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--el-bg-color);
}

.recon-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ─── Toolbar ─────────────────────────────────────────────────────────────── */
.recon-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  min-height: 44px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-has {
  background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
  color: var(--el-color-success);
  border: 1px solid color-mix(in srgb, var(--el-color-success) 25%, transparent);
}

.status-empty {
  background: color-mix(in srgb, var(--el-text-color-secondary) 8%, transparent);
  color: var(--el-text-color-secondary);
  border: 1px solid color-mix(in srgb, var(--el-text-color-secondary) 15%, transparent);
}

.status-digest-fresh {
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  color: var(--el-color-primary);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 25%, transparent);
}

.status-digest-stale {
  background: color-mix(in srgb, var(--el-color-warning) 10%, transparent);
  color: var(--el-color-warning);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 25%, transparent);
}

.status-organize-hint {
  background: color-mix(in srgb, var(--el-color-warning) 10%, transparent);
  color: var(--el-color-warning-dark-2);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 30%, transparent);
  transition: opacity 0.15s;
}

.status-organize-hint:hover {
  opacity: 0.8;
}

.status-icon {
  font-size: 13px;
}

.toolbar-hint {
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dirty-indicator {
  color: var(--el-color-warning);
  font-size: 14px;
  line-height: 1;
}

.char-count {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

/* ─── Loading ─────────────────────────────────────────────────────────────── */
.recon-state {
  flex: 1;
  padding: 20px;
  overflow: hidden;
}

/* ─── Editor ──────────────────────────────────────────────────────────────── */
.recon-editor-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.recon-editor {
  flex: 1;
  width: 100%;
  padding: 16px;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.75;
  border: none;
  outline: none;
  resize: none;
  box-sizing: border-box;
  transition: background 0.15s;
}

.recon-editor:focus {
  background: color-mix(in srgb, var(--el-color-primary) 3%, var(--el-bg-color-page));
}

.editor-tip {
  padding: 5px 14px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  border-top: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */
.recon-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 24px;
  text-align: center;
}

.empty-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  font-size: 28px;
  color: color-mix(in srgb, var(--el-color-primary) 70%, transparent);
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.empty-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
  max-width: 360px;
}

/* ─── Preview ─────────────────────────────────────────────────────────────── */
.recon-preview {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.recon-md {
  max-width: 860px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.recon-md :deep(h1),
.recon-md :deep(h2),
.recon-md :deep(h3) {
  color: var(--el-text-color-primary);
  margin-top: 1.4em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.recon-md :deep(h2) {
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 6px;
}

.recon-md :deep(code) {
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.recon-md :deep(pre) {
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  font-size: 12.5px;
}

.recon-md :deep(pre code) {
  background: transparent;
  padding: 0;
}

.recon-md :deep(blockquote) {
  border-left: 3px solid var(--el-color-warning);
  padding-left: 14px;
  margin-left: 0;
  color: var(--el-text-color-secondary);
}

.recon-md :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.recon-md :deep(th),
.recon-md :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 6px 12px;
  text-align: left;
}

.recon-md :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.recon-md :deep(li) {
  margin-bottom: 4px;
}

/* ─── Append panel ────────────────────────────────────────────────────────── */
.recon-append-panel {
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 10px 14px;
  flex-shrink: 0;
  background: var(--el-bg-color-page);
}

.append-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.append-label-icon {
  font-size: 14px;
}

.append-body {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.append-body :deep(.el-textarea) {
  flex: 1;
}

.append-body :deep(.el-textarea__inner) {
  font-size: 13px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}

/* ─── AI整理对话框 ───────────────────────────────────────────────────────────── */
.organize-dialog :deep(.el-dialog__body) {
  padding: 0;
  overflow: hidden;
}

.organize-diff {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  max-height: 60vh;
  overflow: hidden;
}

.diff-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.diff-pane-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  background: var(--el-bg-color-page);
}

.diff-pane-header-after {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 4%, var(--el-bg-color-page));
}

.diff-pane-icon {
  font-size: 14px;
}

.diff-pane-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 13px;
  line-height: 1.8;
}

.diff-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  background: var(--el-bg-color-page);
  border-left: 1px solid var(--el-border-color-lighter);
  border-right: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}

.diff-arrow {
  font-size: 18px;
  color: var(--el-color-primary);
  opacity: 0.6;
}

.organize-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.organize-dialog-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.organize-dialog-actions {
  display: flex;
  gap: 8px;
}
</style>
