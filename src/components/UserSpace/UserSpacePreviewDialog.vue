<template>
  <el-dialog
    v-model="visible"
    width="920px"
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
    <div
      ref="editorContainer"
      class="preview-editor"
    />
  </el-dialog>
</template>

<script setup>
import { computed, onUnmounted, ref, toRaw, watch } from 'vue'
import { monaco } from '@/utils/monaco.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
import { formatFileSize } from '@/utils/format.js'
import { detectUserSpaceLanguage } from './userSpaceModel.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  data: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const previewLanguage = computed(() => detectUserSpaceLanguage(props.data.path))
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
  if (!visible.value || !editorContainer.value) return
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

.preview-dialog :deep(.el-dialog__header) {
  min-height: 20px;
  padding: 8px 12px 0;
}

.preview-dialog :deep(.el-dialog__title) {
  display: none;
}

.preview-editor {
  height: 58vh;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--workspace-border-soft);
  border-radius: var(--el-border-radius-base);
}
</style>
