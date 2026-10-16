<template>
  <el-dialog
    v-model="visible"
    title="成果预览"
    width="min(920px, calc(100vw - 32px))"
    destroy-on-close
    class="preview-dialog"
    @opened="initEditor"
    @closed="disposeEditor"
  >
    <div class="preview-meta">
      <el-tag
        size="small"
        type="info"
        effect="plain"
      >
        文件：{{ data.path || '-' }}
      </el-tag>
      <el-tag
        size="small"
        effect="plain"
      >
        语言：{{ previewLanguage }}
      </el-tag>
      <el-tag
        size="small"
        effect="plain"
      >
        总大小：{{ formatFileSize(data.size || 0) }}
      </el-tag>
      <el-tag
        size="small"
        effect="plain"
      >
        预览字节：{{ data.previewSize || 0 }}
      </el-tag>
      <el-tag
        size="small"
        :type="data.truncated ? 'warning' : 'success'"
        effect="plain"
      >
        {{ data.truncated ? '内容已截断' : '完整内容' }}
      </el-tag>
    </div>
    <el-segmented
      v-if="previewLanguage === 'markdown'"
      v-model="previewMode"
      :options="previewModes"
      size="small"
      aria-label="预览方式"
      class="preview-mode"
    />
    <!-- Only sanitized, passive document HTML is inserted here. -->
    <!-- eslint-disable vue/no-v-html -->
    <article
      v-if="isReading"
      class="markdown-preview"
      aria-label="Markdown 阅读预览"
      v-html="renderedMarkdown"
    />
    <!-- eslint-enable vue/no-v-html -->
    <div
      v-else
      ref="editorContainer"
      class="preview-editor"
    />
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, toRaw, watch } from 'vue'
import { monaco } from '@/utils/monaco.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { formatFileSize } from '@/utils/format.js'
import { detectUserSpaceLanguage } from './userSpaceModel.js'
import { renderArtifactMarkdown } from './artifactMarkdown.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  data: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const visible = useDialogVisible(props, emit)
const previewLanguage = computed(() => detectUserSpaceLanguage(props.data.path))
const previewMode = ref('rendered')
const previewModes = [{ label: '阅读预览', value: 'rendered' }, { label: '查看源码', value: 'source' }]
const isReading = computed(() => previewLanguage.value === 'markdown' && previewMode.value === 'rendered')
const renderedMarkdown = computed(() => isReading.value ? renderArtifactMarkdown(props.data.content) : '')
const editor = ref(null)
const editorContainer = ref(null)
const { monacoTheme, watchMonacoTheme } = useMonacoTheme()
const { disposeEditorInstance, recreateEditorInstance } = useMonacoEditorInstance()

const disposeEditor = () => disposeEditorInstance(editor, { disposeModel: true })

const syncEditor = () => {
  if (!editor.value) return
  const rawEditor = toRaw(editor.value)
  const model = rawEditor.getModel()
  if (!model) return
  model.setValue(String(props.data.content || ''))
  monaco.editor.setModelLanguage(model, previewLanguage.value)
  monaco.editor.setTheme(monacoTheme.value)
  rawEditor.layout()
}

const initEditor = () => {
  if (!visible.value || isReading.value || !editorContainer.value) return
  if (editor.value) {
    syncEditor()
    return
  }
  recreateEditorInstance(
    editor,
    editorContainer,
    createMonacoEditorOptions({
      value: String(props.data.content || ''),
      language: previewLanguage.value,
      theme: monacoTheme.value,
      readOnly: true,
      lineNumbers: 'on',
      minimapEnabled: false,
      wordWrap: 'on',
      contextmenu: true,
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace'
    }),
    { disposeModel: true }
  )
}

watch(() => props.data.path, () => { previewMode.value = 'rendered' })
watch(visible, open => { if (open) previewMode.value = 'rendered' })
watch([visible, isReading], async () => {
  disposeEditor()
  if (visible.value && !isReading.value) {
    await nextTick()
    initEditor()
  }
}, { flush: 'post', immediate: true })

watch(
  () => [props.data.path, props.data.content],
  () => {
    if (visible.value) syncEditor()
  }
)

const stopThemeWatch = watchMonacoTheme(() => editor.value)
onUnmounted(() => {
  stopThemeWatch()
  disposeEditor()
})
</script>

<style scoped>
.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-editor {
  height: 58vh;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--workspace-border-soft);
  border-radius: var(--el-border-radius-base);
}

.preview-mode {
  margin-bottom: 12px;
}

.markdown-preview {
  height: 58vh;
  min-height: 360px;
  overflow: auto;
  padding: 20px 24px;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--el-border-radius-base);
  background: var(--app-container-background);
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.markdown-preview :deep(> :first-child) {
  margin-top: 0;
}
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin: 1.4em 0 0.6em;
  line-height: 1.5;
  font-weight: 650;
}
.markdown-preview :deep(h1) {
  font-size: 24px;
}
.markdown-preview :deep(h2) {
  font-size: 20px;
}
.markdown-preview :deep(h3) {
  font-size: 17px;
}
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  font-size: 15px;
}
.markdown-preview :deep(p) {
  margin: 0.7em 0;
}
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 1.7em;
}
.markdown-preview :deep(li) {
  margin: 0.3em 0;
}
.markdown-preview :deep(blockquote) {
  margin: 1em 0;
  padding: 4px 14px;
  border-left: 3px solid var(--el-color-primary-light-5);
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
}
.markdown-preview :deep(hr) {
  margin: 20px 0;
  border: 0;
  border-top: 1px solid var(--app-divider-color);
}
.markdown-preview :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--app-control-background-soft);
  font-family: var(--el-font-family-mono);
  font-size: 0.9em;
}
.markdown-preview :deep(pre) {
  padding: 14px 16px;
  border: 1px solid var(--app-divider-color);
  border-radius: 6px;
  background: var(--app-control-background-soft);
  overflow: auto;
  line-height: 1.6;
}
.markdown-preview :deep(pre code) {
  padding: 0;
  background: transparent;
  white-space: pre;
}
.markdown-preview :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 16px 0;
  border-collapse: collapse;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--app-divider-color);
  text-align: left;
}
.markdown-preview :deep(th) {
  background: var(--app-control-background-soft);
  font-weight: 600;
}
.markdown-preview :deep(a) {
  color: var(--el-color-primary);
  text-decoration: underline;
}
</style>
