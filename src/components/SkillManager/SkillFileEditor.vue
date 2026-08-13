<template>
  <div
    class="skill-file-editor"
    :class="{ 'is-empty': !filePath }"
  >
    <div
      v-if="!filePath"
      class="editor-empty"
    >
      <EmptyState
        workbench
        title="选择一个文件"
        description="从左侧文件树选择文件后，可以在这里查看、编辑或下载内容。"
        :icon="iconMap.document"
      />
    </div>

    <template v-else>
      <div class="editor-header">
        <div class="header-left">
          <nav
            class="breadcrumb"
            :title="filePath"
          >
            <template
              v-for="(seg, idx) in pathSegments"
              :key="idx"
            >
              <span
                v-if="idx > 0"
                class="breadcrumb-sep"
              >/</span>
              <span
                class="breadcrumb-seg"
                :class="{ 'is-last': idx === pathSegments.length - 1 }"
              >{{ seg }}</span>
            </template>
          </nav>
          <span
            v-if="isDirty"
            class="dirty-tag"
          >未保存</span>
          <span
            v-if="readOnly && encoding === 'text'"
            class="readonly-tag"
          >只读</span>
        </div>
        <div class="header-right">
          <el-button
            v-if="encoding === 'text' && !readOnly"
            type="primary"
            size="small"
            :loading="saving"
            :disabled="!isDirty"
            @click="handleSave"
          >
            <el-icon><Icon :icon="iconMap.save" /></el-icon>
            保存
          </el-button>
          <el-button
            v-if="encoding === 'base64'"
            size="small"
            @click="handleDownload"
          >
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            下载
          </el-button>
        </div>
      </div>

      <div
        v-if="loading"
        class="editor-loading"
      >
        <el-skeleton
          :rows="10"
          animated
        />
      </div>

      <!-- 文本编辑（Monaco） -->
      <div
        v-else-if="encoding === 'text'"
        ref="monacoContainer"
        class="monaco-host"
      />

      <!-- 图片预览 -->
      <div
        v-else-if="isImage"
        class="binary-preview"
      >
        <img
          :src="dataUrl"
          :alt="filePath"
          class="preview-img"
        >
      </div>

      <!-- 其他二进制：信息卡 -->
      <div
        v-else
        class="binary-preview"
      >
        <el-icon class="binary-icon">
          <Icon :icon="iconMap.document" />
        </el-icon>
        <div class="binary-info">
          <div class="binary-name">
            {{ filePath }}
          </div>
          <div class="binary-size">
            {{ formatBytes(fileSize) }} · 二进制文件
          </div>
          <el-button
            size="small"
            @click="handleDownload"
          >
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            下载
          </el-button>
        </div>
      </div>

      <!-- 状态栏 -->
      <div
        v-if="!loading"
        class="editor-statusbar"
      >
        <span class="status-item">
          <span class="status-label">大小</span>
          <span class="status-value">{{ formatBytes(fileSize) }}</span>
        </span>
        <span
          v-if="encoding === 'text'"
          class="status-item"
        >
          <span class="status-label">语言</span>
          <span class="status-value">{{ detectedLanguage }}</span>
        </span>
        <span class="status-item">
          <span class="status-label">编码</span>
          <span class="status-value">{{ encoding === 'text' ? 'UTF-8' : 'Base64' }}</span>
        </span>
        <span
          v-if="encoding === 'text' && cursorInfo"
          class="status-item status-item--right"
        >
          <span class="status-label">行</span>
          <span class="status-value">{{ cursorInfo.line }}:{{ cursorInfo.col }}</span>
        </span>
        <span
          v-if="encoding === 'text' && totalLines"
          class="status-item"
        >
          <span class="status-label">总行</span>
          <span class="status-value">{{ totalLines }}</span>
        </span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRaw, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { monaco } from '@/utils/monaco.js'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { saveSkillFileApi } from '@/services/api.js'
import { useTheme } from '@/stores/theme'
import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { formatFileSize as formatBytes } from '@/utils/format.js'

const iconMap = icons
const themeStore = useTheme()

const props = defineProps({
  scope: { type: String, required: true },
  skillName: { type: String, default: '' },
  filePath: { type: String, default: '' },
  fileContent: { type: String, default: '' },
  encoding: { type: String, default: 'text' },
  fileSize: { type: Number, default: 0 },
  readOnly: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['saved', 'dirty-change'])

const monacoContainer = ref(null)
const editor = shallowRef(null)
const { disposeEditorInstance } = useMonacoEditorInstance()
const saving = ref(false)
const isDirty = ref(false)
const original = ref('')
const cursorInfo = ref(null)
const totalLines = ref(0)

// 路径分段，供面包屑展示
const pathSegments = computed(() => (props.filePath || '').split('/').filter(Boolean))
const detectedLanguage = computed(() => detectLanguage(props.filePath))

// ── 语言推断 ──────────────────────────────────────────
const languageByExt = {
  md: 'markdown', markdown: 'markdown',
  py: 'python',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  vue: 'html',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini', ini: 'ini', conf: 'ini', properties: 'ini', env: 'ini',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', bat: 'bat', cmd: 'bat',
  sql: 'sql',
  html: 'html', htm: 'html', xml: 'xml',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  java: 'java', kt: 'kotlin',
  go: 'go', rs: 'rust',
  c: 'c', cc: 'cpp', cpp: 'cpp', h: 'cpp', hpp: 'cpp',
  rb: 'ruby', swift: 'swift',
  graphql: 'graphql', proto: 'proto',
  log: 'log', csv: 'plaintext', tsv: 'plaintext'
}

function detectLanguage(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  return languageByExt[ext] || 'plaintext'
}

const isImage = computed(() => /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(props.filePath))

const dataUrl = computed(() => {
  if (props.encoding !== 'base64') return ''
  const ext = (props.filePath.split('.').pop() || '').toLowerCase()
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon' }
  const mime = mimeMap[ext] || 'application/octet-stream'
  return `data:${mime};base64,${props.fileContent}`
})

// ── Monaco 生命周期 ───────────────────────────────────
const monacoTheme = computed(() => themeStore.currentTheme.value === 'dark' ? 'vs-dark' : 'vs')

const destroyEditor = () => {
  disposeEditorInstance(editor, { disposeModel: true })
}

const syncReadOnlyAccessibility = () => {
  const host = monacoContainer.value
  if (!host) return
  const value = String(props.readOnly)
  host.setAttribute('aria-label', props.readOnly ? 'Skill 文件只读预览' : 'Skill 文件编辑器')
  host.setAttribute('aria-readonly', value)
  const editorRoot = host.querySelector('.monaco-editor')
  if (editorRoot) editorRoot.setAttribute('aria-readonly', value)
  const inputArea = host.querySelector('textarea.inputarea')
  if (inputArea) {
    inputArea.readOnly = props.readOnly
    inputArea.setAttribute('aria-readonly', value)
  }
}

watch(
  () => [props.filePath, props.fileContent, props.encoding, props.loading, props.readOnly],
  async () => {
    if (props.encoding !== 'text' || !props.filePath || props.loading) {
      destroyEditor()
      return
    }
    await nextTick()
    if (!monacoContainer.value) return
    if (editor.value) {
      const inst = toRaw(editor.value)
      inst.updateOptions({ readOnly: props.readOnly })
      const model = inst.getModel()
      const lang = detectLanguage(props.filePath)
      if (model) {
        monaco.editor.setModelLanguage(model, lang)
        if (model.getValue() !== props.fileContent) {
          inst.setValue(props.fileContent)
        }
      }
    } else {
      const opts = createMonacoEditorOptions({
        value: props.fileContent,
        language: detectLanguage(props.filePath),
        theme: monacoTheme.value,
        wordWrap: 'on',
        minimapEnabled: false,
        readOnly: props.readOnly
      })
      editor.value = monaco.editor.create(monacoContainer.value, opts)
      const inst = toRaw(editor.value)
      inst.onDidChangeModelContent(() => {
        const dirty = inst.getValue() !== original.value
        if (dirty !== isDirty.value) {
          isDirty.value = dirty
          emit('dirty-change', dirty)
        }
        const m = inst.getModel()
        totalLines.value = m ? m.getLineCount() : 0
      })
      inst.onDidChangeCursorPosition((e) => {
        cursorInfo.value = { line: e.position.lineNumber, col: e.position.column }
      })
      inst.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave())
    }
    syncReadOnlyAccessibility()
    original.value = props.fileContent
    if (isDirty.value) {
      isDirty.value = false
      emit('dirty-change', false)
    }
    // 更新状态栏初始值
    const inst = toRaw(editor.value)
    if (inst) {
      const m = inst.getModel()
      totalLines.value = m ? m.getLineCount() : 0
      const pos = inst.getPosition()
      if (pos) cursorInfo.value = { line: pos.lineNumber, col: pos.column }
    }
  },
  { immediate: true }
)

watch(monacoTheme, (t) => {
  if (editor.value) monaco.editor.setTheme(t)
})

onBeforeUnmount(destroyEditor)

// ── 保存 ──────────────────────────────────────────────
const handleSave = async () => {
  if (props.readOnly || props.encoding !== 'text' || !editor.value || saving.value) return
  const content = toRaw(editor.value).getValue()
  saving.value = true
  try {
    await saveSkillFileApi({
      scope: props.scope,
      name: props.skillName,
      path: props.filePath,
      content,
      encoding: 'text'
    })
    original.value = content
    isDirty.value = false
    emit('dirty-change', false)
    emit('saved', { path: props.filePath, content })
    showSuccess('已保存')
  } catch (e) {
    showError(e?.response?.data?.msg || e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ── 下载 ──────────────────────────────────────────────
const handleDownload = () => {
  let blob
  if (props.encoding === 'text') {
    blob = new Blob([props.fileContent], { type: 'text/plain;charset=utf-8' })
  } else {
    const bin = atob(props.fileContent)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    blob = new Blob([bytes], { type: 'application/octet-stream' })
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = props.filePath.split('/').pop()
  a.click()
  URL.revokeObjectURL(url)
}

defineExpose({
  hasUnsavedChanges: () => isDirty.value,
  save: handleSave
})
</script>

<style scoped>
.skill-file-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--app-card-background);
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--app-control-background-soft);
  flex-shrink: 0;
}

.header-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.breadcrumb {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.breadcrumb-seg {
  color: var(--el-text-color-secondary);
}

.breadcrumb-seg.is-last {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.breadcrumb-sep {
  margin: 0 4px;
  color: var(--el-text-color-disabled);
}

.dirty-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  flex-shrink: 0;
}

.readonly-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--el-color-info);
  background: var(--el-color-info-light-9);
  flex-shrink: 0;
}

.header-right {
  display: inline-flex;
  gap: 6px;
  flex-shrink: 0;
}

.header-right :deep(.el-button:focus-visible) {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.editor-loading {
  flex: 1;
  padding: 16px;
}

.monaco-host {
  flex: 1;
  min-height: 0;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 14px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
  border-top: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
  min-height: 22px;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-item--right {
  margin-left: auto;
}

.status-label {
  color: var(--el-text-color-disabled);
}

.status-value {
  color: var(--el-text-color-secondary);
}

.binary-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
  background: repeating-conic-gradient(var(--el-fill-color-light) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}

.binary-icon {
  font-size: 48px;
  color: var(--el-text-color-secondary);
}

.binary-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.binary-name {
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--el-text-color-primary);
}

.binary-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
