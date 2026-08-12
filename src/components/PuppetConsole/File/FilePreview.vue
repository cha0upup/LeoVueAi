<template>
  <el-dialog
    v-model="preViewVisible"
    :fullscreen="isFullscreen"
    :show-close="false"
    class="file-preview-dialog"
    destroy-on-close
    width="55vw"
    :before-close="handleBeforeClose"
    @closed="resetPreviewState"
  >
    <!-- 自定义头部 -->
    <template #header="{ titleId, titleClass }">
      <FilePreviewHeader
        v-model:font-size="fontSize"
        v-model:current-encoding="currentEncoding"
        v-model:line-ending="lineEnding"
        :title-id="titleId"
        :title-class="titleClass"
        :display-file-name="displayFileName"
        :file-type="fileType"
        :file-type-label="fileTypeLabel"
        :code-language="codeLanguage"
        :modified="isModified"
        :file-path="filePath"
        :shortened-file-path="shortenedFilePath"
        :text-preview="isTextPreview"
        :file-size="fileSize"
        :line-ending-label="lineEndingLabel"
        :line-count="editorLineCount"
        :char-count="editorCharCount"
        :large-file-mode="isLargeFileMode"
        :file-icon="getFileIcon()"
        :file-icon-class="getFileIconClass()"
        :refreshing="isRefreshing"
        :fullscreen="isFullscreen"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :encoding-options="encodingOptions"
        :line-ending-options="lineEndingOptions"
        :saving="isSaving"
        :encoding="isEncoding"
        :can-save="canSaveFile"
        :word-wrap="wordWrap"
        @action="handleHeaderAction"
        @encoding-change="changeDisplayEncoding"
        @line-ending-change="handleLineEndingChange"
      />
    </template>

    <!-- Preview Content Container -->
    <div
      v-loading="isPreviewLoading"
      class="file-content-container"
    >
      <ImagePreview
        v-if="fileType === 'image'"
        :image-src="fileContent"
      />
      <PdfPreview
        v-else-if="fileType === 'pdf'"
        :pdf-src="fileContent"
        :file-name="displayFileName"
      />
      <TextPreview
        v-else
        ref="textPreviewRef"
        :content="fileContent"
        :language="codeLanguage"
        :read-only="isLargeFileMode"
        :font-size="fontSize"
        :word-wrap="wordWrap"
        @content-change="handleContentChange"
        @stats-change="handleStatsChange"
        @undo-redo-state-change="handleUndoRedoStateChange"
      />
      <!-- 大文件模式加载指示器 -->
      <div
        v-if="isLargeFileMode"
        class="large-file-indicator"
      >
        <div class="large-file-progress">
          <el-progress
            :percentage="largeFileProgress"
            :stroke-width="4"
            :show-text="false"
          />
        </div>
        <span class="large-file-info">
          {{ formatFileSize(loadedOffset) }} / {{ formatFileSize(totalFileSize) }}
          <span
            v-if="isLoadingChunk"
            class="loading-dot"
          >加载中...</span>
          <span v-else-if="loadedOffset >= totalFileSize">（已加载完毕）</span>
          <span v-else>（只读模式，滚动加载更多）</span>
        </span>
      </div>
    </div>
  </el-dialog>

  <!-- 文件下载组件 -->
  <FileDownload
    ref="fileDownloadRef"
    :session-id="sessionId || ''"
  />
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { formatFilePath } from '@/utils/format.js'
import { editFileApi } from '@/services/api.js'
import FileDownload from '@/components/PuppetConsole/File/FileDownload.vue'
import FilePreviewHeader from './FilePreviewHeader.vue'
import ImagePreview from './preview/ImagePreview.vue'
import PdfPreview from './preview/PdfPreview.vue'
import TextPreview from './preview/TextPreview.vue'
import { showError, showInfo, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { useFileEncoding } from '@/composables/useFileEncoding.js'
import { useFileLoader } from '@/composables/useFileLoader.js'
import { useLargeFile } from '@/composables/useLargeFile.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import {
  FILE_PREVIEW_DEFAULT_FONT_SIZE,
  FILE_PREVIEW_DEFAULT_LINE_ENDING,
  FILE_PREVIEW_LINE_ENDING_OPTIONS,
  detectFileLineEnding,
  getPreviewDisplayName,
  getPreviewTypeLabel,
  getTextPreviewStats,
  isSamePreviewTarget,
  isTextFilePreview,
  normalizeFileLineEndings,
  resolvePreviewFileSize,
  shortenPreviewPath,
  splitPreviewDownloadPath
} from './filePreviewModel.js'

const iconMap = icons

// ── Composables ──
const {
  currentEncoding,
  originalEncoding,
  encodingOptions,
  decodeBase64ToString,
  detectEncoding,
  convertEncoding,
  resetEncoding
} = useFileEncoding()

const {
  fileContent,
  fileType,
  codeLanguage,
  originalContent,
  isModified,
  setFileType,
  loadFile,
  reloadWithEncoding,
  resetFileState
} = useFileLoader({ decodeBase64ToString, detectEncoding, currentEncoding, originalEncoding })

const {
  isLargeFileMode,
  totalFileSize,
  loadedOffset,
  isLoadingChunk,
  initLargeFileMode,
  setupScrollListener,
  resetLargeFile,
  formatFileSize
} = useLargeFile({
  decodeBase64ToString,
  currentEncoding,
  onChunkError: error => showError(`文件分片加载失败：${error?.message || '未知错误'}`)
})

// ── 组件状态 ──
const preViewVisible = ref(false)
const filePath = ref('')
const sessionId = ref('')
const previewFileMeta = ref({})
const fileDownloadRef = ref(null)
const textPreviewRef = ref(null)
const requestGuard = createLatestRequestGuard(['preview', 'save', 'encoding'])

const isFullscreen = ref(false)
const isPreviewLoading = ref(false)
const isSaving = ref(false)
const isEncoding = ref(false)
const isRefreshing = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const fontSize = ref(FILE_PREVIEW_DEFAULT_FONT_SIZE)
const fileSize = ref(0)
const editorLineCount = ref(0)
const editorCharCount = ref(0)
const lineEnding = ref(FILE_PREVIEW_DEFAULT_LINE_ENDING)
const originalLineEnding = ref(FILE_PREVIEW_DEFAULT_LINE_ENDING)
const activeDisplayEncoding = ref('utf-8')

const wordWrap = ref(true)

// ── 计算属性 ──
const displayFileName = computed(() => getPreviewDisplayName(filePath.value))

const fileTypeLabel = computed(() => getPreviewTypeLabel(fileType.value))

const isTextPreview = computed(() => isTextFilePreview(fileType.value))

const lineEndingOptions = FILE_PREVIEW_LINE_ENDING_OPTIONS

const lineEndingLabel = computed(() => {
  const matched = FILE_PREVIEW_LINE_ENDING_OPTIONS.find((option) => option.value === lineEnding.value)
  return matched?.label || lineEnding.value
})

const canSaveFile = computed(() =>
  isTextPreview.value &&
  isModified.value &&
  !isLargeFileMode.value &&
  !isSaving.value &&
  !isEncoding.value
)
const largeFileProgress = computed(() => {
  if (totalFileSize.value <= 0) return 0
  return Math.min(100, Math.round(loadedOffset.value / totalFileSize.value * 100))
})

const shortenedFilePath = computed(() => shortenPreviewPath(filePath.value))

// ── 方法 ──
const getFileIcon = () => {
  const typeMap = {
    image: iconMap.picture,
    pdf: 'mdi:file-pdf-box'
  }
  return typeMap[fileType.value] || iconMap.document
}

const getFileIconClass = () => {
  const classMap = {
    image: 'image-icon',
    pdf: 'pdf-icon'
  }
  return classMap[fileType.value] || 'text-icon'
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const setLineEndingFromContent = (content) => {
  lineEnding.value = detectFileLineEnding(content, filePath.value)
  originalLineEnding.value = lineEnding.value
}

const updateModifiedState = (content = getEditorContent()) => {
  isModified.value = content !== originalContent.value || lineEnding.value !== originalLineEnding.value
}

const updateStatsFromContent = (content) => {
  const stats = getTextPreviewStats(content)
  editorLineCount.value = stats.lineCount
  editorCharCount.value = stats.charCount
}

const syncPreviewMetadata = (responseData) => {
  fileSize.value = resolvePreviewFileSize(responseData, previewFileMeta.value)
}

const resetPreviewMetadata = () => {
  previewFileMeta.value = {}
  fileSize.value = 0
  editorLineCount.value = 0
  editorCharCount.value = 0
  lineEnding.value = FILE_PREVIEW_DEFAULT_LINE_ENDING
  originalLineEnding.value = FILE_PREVIEW_DEFAULT_LINE_ENDING
}

const copyFilePath = async () => {
  if (!filePath.value) return
  try {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable')
    await globalThis.navigator.clipboard.writeText(filePath.value)
    showSuccess(`已复制路径: ${filePath.value}`)
  } catch {
    showError('复制失败，请手动复制')
  }
}

const undo = () => {
  if (textPreviewRef.value) {
    textPreviewRef.value.undo()
    updateUndoRedoState()
  }
}

const redo = () => {
  if (textPreviewRef.value) {
    textPreviewRef.value.redo()
    updateUndoRedoState()
  }
}

const toggleSearch = () => {
  textPreviewRef.value?.toggleSearch()
}

const toggleReplace = () => {
  textPreviewRef.value?.toggleReplace()
}

const updateUndoRedoState = () => {
  if (textPreviewRef.value) {
    canUndo.value = textPreviewRef.value.canUndo.value
    canRedo.value = textPreviewRef.value.canRedo.value
  }
}

const handleContentChange = (newContent) => {
  fileContent.value = newContent
  updateModifiedState(newContent)
  updateStatsFromContent(newContent)
}

const handleUndoRedoStateChange = (state) => {
  canUndo.value = state.canUndo
  canRedo.value = state.canRedo
}

const handleStatsChange = (state) => {
  editorLineCount.value = Number(state?.lineCount) || 1
  editorCharCount.value = Number(state?.charCount) || 0
}

const handleLineEndingChange = () => {
  updateModifiedState()
}

const formatCode = () => {
  if (textPreviewRef.value) {
    textPreviewRef.value.formatCode()
  }
}

const getEditorContent = () => {
  return textPreviewRef.value?.getContent?.() ?? fileContent.value
}

const getEditorInstance = () => {
  return textPreviewRef.value?.getEditorInstance?.()
}

const currentPreviewTarget = () => ({
  sessionId: sessionId.value,
  filePath: filePath.value
})

const isCurrentPreviewTarget = (target) => isSamePreviewTarget(target, currentPreviewTarget())

const reloadPreviewEncoding = async (encoding, successMessage, sequence) => {
  const target = currentPreviewTarget()
  try {
    currentEncoding.value = encoding
    const result = await reloadWithEncoding(target.sessionId, target.filePath, previewFileMeta.value)
    if (
      !result ||
      !requestGuard.isCurrent('encoding', sequence) ||
      !isCurrentPreviewTarget(target)
    ) return false
    activeDisplayEncoding.value = encoding
    setLineEndingFromContent(fileContent.value)
    updateStatsFromContent(fileContent.value)
    showSuccess(successMessage)
    return true
  } catch (error) {
    if (
      requestGuard.isCurrent('encoding', sequence) &&
      isCurrentPreviewTarget(target)
    ) {
      currentEncoding.value = activeDisplayEncoding.value
      showError('编码切换失败：' + (error?.message || '未知错误'))
    }
    return false
  } finally {
    if (requestGuard.isCurrent('encoding', sequence) && isCurrentPreviewTarget(target)) {
      isEncoding.value = false
    }
  }
}

const changeDisplayEncoding = async () => {
  if (!textPreviewRef.value || isSaving.value || isEncoding.value) {
    currentEncoding.value = activeDisplayEncoding.value
    return
  }
  const requestedEncoding = currentEncoding.value
  const previousEncoding = activeDisplayEncoding.value
  const target = currentPreviewTarget()
  const sequence = requestGuard.next('encoding')
  isEncoding.value = true
  const confirmed = await confirmAction({
    title: '确认编码切换',
    message: `确定要使用 ${requestedEncoding.toUpperCase()} 编码重新解析文件内容吗？\n\n注意：这可能会改变文件的显示效果。`
  })
  if (
    !requestGuard.isCurrent('encoding', sequence) ||
    !isCurrentPreviewTarget(target)
  ) return
  if (!confirmed) {
    currentEncoding.value = previousEncoding
    isEncoding.value = false
    return
  }
  await reloadPreviewEncoding(
    requestedEncoding,
    `已切换到 ${requestedEncoding.toUpperCase()} 编码显示`,
    sequence
  )
}

const detectFileEncoding = async () => {
  if (!textPreviewRef.value || isSaving.value || isEncoding.value) return
  const detectedEncoding = detectEncoding(getEditorContent())
  if (detectedEncoding === activeDisplayEncoding.value) {
    showInfo(`当前编码 ${detectedEncoding.toUpperCase()} 可能正确`)
    return
  }

  const target = currentPreviewTarget()
  const sequence = requestGuard.next('encoding')
  isEncoding.value = true
  const confirmed = await confirmAction({
    title: '编码检测',
    message: `前端检测到文件编码可能为 ${detectedEncoding.toUpperCase()}，是否切换到检测到的编码？\n\n注意：前端检测可能不够准确。`,
    confirmButtonText: '切换'
  })
  if (
    !confirmed ||
    !requestGuard.isCurrent('encoding', sequence) ||
    !isCurrentPreviewTarget(target)
  ) {
    if (requestGuard.isCurrent('encoding', sequence) && isCurrentPreviewTarget(target)) {
      isEncoding.value = false
    }
    return
  }
  await reloadPreviewEncoding(
    detectedEncoding,
    `已切换到 ${detectedEncoding.toUpperCase()} 编码`,
    sequence
  )
}

const downloadFile = async () => {
  try {
    if (!fileDownloadRef.value) {
      showError('下载组件未初始化')
      return
    }
    const { fileName, directoryPath } = splitPreviewDownloadPath(filePath.value)
    await fileDownloadRef.value.openDialog(sessionId.value, directoryPath, fileName, 0)
  } catch (error) {
    showError('打开下载对话框失败: ' + (error?.message || '未知错误'))
  }
}

const refreshFile = async () => {
  const target = currentPreviewTarget()
  isRefreshing.value = true
  const success = await preView(target.sessionId, target.filePath, previewFileMeta.value)
  if (isCurrentPreviewTarget(target)) {
    isRefreshing.value = false
    if (success) showSuccess('文件刷新成功')
  }
}

const saveFile = async () => {
  if (!textPreviewRef.value || isLargeFileMode.value || isSaving.value || isEncoding.value) return

  const sequence = requestGuard.next('save')
  const target = currentPreviewTarget()
  const content = getEditorContent()
  const targetLineEnding = lineEnding.value
  const targetEncoding = currentEncoding.value
  const normalizedContent = normalizeFileLineEndings(content, targetLineEnding)
  isSaving.value = true
  try {
    let finalContent = normalizedContent
    if (targetEncoding !== originalEncoding.value) {
      try {
        finalContent = await convertEncoding(
          normalizedContent,
          originalEncoding.value,
          targetEncoding
        )
      } catch {
        if (requestGuard.isCurrent('save', sequence) && isCurrentPreviewTarget(target)) {
          showWarning('编码转换失败，将使用原始内容保存')
        }
      }
    }
    if (!requestGuard.isCurrent('save', sequence) || !isCurrentPreviewTarget(target)) return

    await editFileApi({
      sessionId: target.sessionId,
      path: target.filePath,
      content: finalContent,
      encoding: targetEncoding
    })
    if (!requestGuard.isCurrent('save', sequence) || !isCurrentPreviewTarget(target)) return

    showSuccess(`文件保存成功 (${targetEncoding.toUpperCase()} / ${targetLineEnding})`)
    fileContent.value = normalizedContent
    originalContent.value = normalizedContent
    originalEncoding.value = targetEncoding
    activeDisplayEncoding.value = targetEncoding
    originalLineEnding.value = targetLineEnding
    updateStatsFromContent(normalizedContent)
    isModified.value = false
  } catch (error) {
    if (requestGuard.isCurrent('save', sequence) && isCurrentPreviewTarget(target)) {
      showError(`文件保存失败：${error?.message || '未知错误'}`)
    }
  } finally {
    if (requestGuard.isCurrent('save', sequence) && isCurrentPreviewTarget(target)) {
      isSaving.value = false
    }
  }
}

const clearPreviewState = ({ clearTarget = true } = {}) => {
  requestGuard.invalidate(['preview', 'save', 'encoding'])
  isSaving.value = false
  isEncoding.value = false
  isRefreshing.value = false
  isPreviewLoading.value = false
  canUndo.value = false
  canRedo.value = false
  wordWrap.value = true
  resetPreviewMetadata()
  resetFileState()
  resetEncoding()
  resetLargeFile()
  activeDisplayEncoding.value = 'utf-8'
  if (clearTarget) {
    sessionId.value = ''
    filePath.value = ''
  }
}

const resetPreviewState = () => {
  isFullscreen.value = false
  clearPreviewState()
}

const preView = async (sessionIdParam, filePathParam, fileMetaParam = {}) => {
  const target = {
    sessionId: String(sessionIdParam || ''),
    filePath: formatFilePath(filePathParam || '')
  }
  if (!target.filePath || !target.sessionId) {
    showError('文件路径或实体ID缺失')
    return false
  }

  const intentSequence = requestGuard.next('preview')
  if (preViewVisible.value && isModified.value) {
    const confirmed = await confirmAction({
      title: '确认切换文件',
      message: '当前文件已修改但未保存，确定要打开其他文件吗？',
      confirmButtonText: '继续打开'
    })
    if (!confirmed || !requestGuard.isCurrent('preview', intentSequence)) return false
  }

  clearPreviewState({ clearTarget: false })
  const sequence = requestGuard.next('preview')
  sessionId.value = target.sessionId
  filePath.value = target.filePath
  previewFileMeta.value = fileMetaParam || {}
  preViewVisible.value = true
  isPreviewLoading.value = true
  const isCurrent = () =>
    requestGuard.isCurrent('preview', sequence) && isCurrentPreviewTarget(target)

  try {
    const result = await loadFile(target.sessionId, target.filePath, previewFileMeta.value)
    if (!result || !isCurrent()) return false
    syncPreviewMetadata(result.responseData)

    if (result.truncated) {
      setFileType(target.filePath)
      if (fileType.value !== 'text') {
        showError('大文件仅支持文本预览')
        return false
      }

      const text = await initLargeFileMode(result.responseData, target.sessionId, target.filePath)
      if (text === null || !isCurrent()) return false
      fileContent.value = text
      originalContent.value = text
      setLineEndingFromContent(text)
      updateStatsFromContent(text)
      isModified.value = false

      const detectedEncoding = detectEncoding(text)
      currentEncoding.value = detectedEncoding
      originalEncoding.value = detectedEncoding
      activeDisplayEncoding.value = detectedEncoding

      await nextTick()
      if (!isCurrent()) return false
      await initMonacoEditor()
      await nextTick()
      if (!isCurrent()) return false
      setupScrollListener(getEditorInstance, target.sessionId, target.filePath)
      showInfo(`大文件模式：文件大小 ${formatFileSize(totalFileSize.value)}，按需加载中`)
      return true
    }

    if (fileType.value === 'text') {
      activeDisplayEncoding.value = currentEncoding.value
      setLineEndingFromContent(fileContent.value)
      updateStatsFromContent(fileContent.value)
      await nextTick()
      if (!isCurrent()) return false
      await initMonacoEditor()
    }
    return isCurrent()
  } catch (error) {
    if (isCurrent()) showError(`文件加载失败：${error?.message || '未知错误'}`)
    return false
  } finally {
    if (isCurrent()) isPreviewLoading.value = false
  }
}

const confirmClose = async () => {
  if (!isModified.value) return true
  return confirmAction({
    title: '确认关闭',
    message: '文件已修改但未保存，确定要关闭吗？',
    confirmButtonText: '关闭'
  })
}

const handleBeforeClose = async (done) => {
  if (await confirmClose()) done()
}

const handleClose = async () => {
  if (await confirmClose()) preViewVisible.value = false
}

const handleHeaderAction = (action) => {
  const handlers = {
    'copy-path': copyFilePath,
    refresh: refreshFile,
    fullscreen: toggleFullscreen,
    close: handleClose,
    undo,
    redo,
    search: toggleSearch,
    replace: toggleReplace,
    format: formatCode,
    'detect-encoding': detectFileEncoding,
    'word-wrap': toggleWordWrap,
    download: downloadFile,
    save: saveFile
  }
  handlers[action]?.()
}

const initMonacoEditor = async () => {
  if (textPreviewRef.value) {
    await nextTick()
    textPreviewRef.value.initEditor()
  }
}

const toggleWordWrap = () => {
  wordWrap.value = !wordWrap.value
}

const handleWindowKeydown = (event) => {
  if (!preViewVisible.value || !isTextPreview.value) return

  const isCommandKey = event.metaKey || event.ctrlKey
  const key = String(event.key || '').toLowerCase()

  if (isCommandKey && key === 's') {
    event.preventDefault()
    if (canSaveFile.value) {
      saveFile()
    }
    return
  }

  if (isCommandKey && key === 'f') {
    event.preventDefault()
    toggleSearch()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  resetPreviewState()
})

// 暴露方法给父组件
defineExpose({
  preView
})
</script>

<style scoped>
.file-preview-dialog {
  --preview-panel-surface: color-mix(
    in srgb,
    var(--app-dialog-background) 94%,
    var(--el-bg-color-overlay)
  );
  --preview-toolbar-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --preview-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --preview-soft-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
  animation: dialogFadeIn 0.28s ease-out;
}

:global(html:not(.dark) .file-preview-dialog),
:global(html[data-theme='light'] .file-preview-dialog) {
  --preview-panel-surface: var(--app-dialog-background);
  --preview-toolbar-surface: #f2f2f2;
  --preview-muted-surface: #f2f2f2;
  --preview-soft-border: color-mix(in srgb, var(--el-border-color) 74%, transparent);
}

:global(html.dark .file-preview-dialog),
:global(html[data-theme='dark'] .file-preview-dialog) {
  --preview-panel-surface: color-mix(
    in srgb,
    var(--app-dialog-background) 88%,
    var(--el-bg-color-overlay)
  );
  --preview-toolbar-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --preview-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --preview-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

:global(.el-dialog.file-preview-dialog) {
  width: 62vw !important;
  max-width: 1180px !important;
  min-width: 560px !important;
  padding: 0 !important;
  border-radius: var(--radius-overlay);
  overflow: hidden;
  border: 1px solid var(--preview-soft-border);
  background: var(--preview-panel-surface);
  box-shadow: var(--shadow-overlay);
}

:global(.el-dialog.file-preview-dialog > .el-dialog__header) {
  margin-right: 0;
  padding: 0 !important;
}

:global(.el-dialog.file-preview-dialog > .el-dialog__body) {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.file-content-container {
  height: calc(70vh - 150px);
  min-height: min(48vh, 520px);
  max-height: calc(86vh - 220px);
  overflow: hidden;
  position: relative;
  border-radius: 0 0 12px 12px;
  background: var(--preview-muted-surface);
  border-top: 1px solid var(--preview-soft-border);
}

@media (max-height: 800px) {
  .file-content-container {
    height: calc(66vh - 156px);
    min-height: min(42vh, 360px);
  }
}

@media (min-height: 1080px) {
  .file-content-container {
    height: calc(72vh - 196px);
    min-height: min(52vh, 560px);
  }
}

@media (max-width: 768px) {
  :global(.el-dialog.file-preview-dialog) {
    width: 90vw !important;
    min-width: 90vw !important;
    max-width: 90vw !important;
  }

  .file-content-container {
    height: calc(72vh - 156px);
    min-height: min(52vh, 320px);
  }
}

:global(.el-dialog.file-preview-dialog.is-fullscreen) {
  border-radius: 0;
}

:global(.el-dialog.file-preview-dialog.is-fullscreen) .dialog-header {
  border-radius: 0;
}

@keyframes dialogFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.large-file-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--el-bg-color-page);
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.large-file-progress {
  width: 120px;
  flex-shrink: 0;
}

.large-file-info {
  white-space: nowrap;
}

.loading-dot {
  color: var(--el-color-primary);
}
</style>
