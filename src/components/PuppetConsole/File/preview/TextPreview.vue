<template>
  <div class="editor-container">
    <div
      ref="monacoEditorContainer"
      class="file-content"
    />
  </div>
</template>

<script setup>
import { onUnmounted, ref, toRaw, watch } from 'vue'
import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'

const { monacoTheme, watchMonacoTheme } = useMonacoTheme()
const { disposeEditorInstance, recreateEditorInstance } = useMonacoEditorInstance()

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'plaintext'
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  fontSize: {
    type: Number,
    default: 14
  },
  wordWrap: {
    type: Boolean,
    default: true
  },
  showMinimap: {
    type: Boolean,
    default: true
  },
  showLineNumbers: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['content-change', 'undo-redo-state-change', 'stats-change'])

const monacoEditor = ref(null)
const monacoEditorContainer = ref(null)
const canUndo = ref(false)
const canRedo = ref(false)
const lineCount = ref(0)
const charCount = ref(0)

watch(
  () => props.content,
  (newValue) => {
    if (monacoEditor.value) {
      const editor = toRaw(monacoEditor.value)
      // 只有在内容确实不同时才调用 setValue，避免触发光标重置
      if (editor.getValue() !== newValue) {
        editor.setValue(newValue)
      }
    }
  }
)

watch(
  () => props.fontSize,
  (newSize) => {
    if (monacoEditor.value) {
      toRaw(monacoEditor.value).updateOptions({ fontSize: newSize })
    }
  }
)

watch(
  () => props.wordWrap,
  (wrap) => {
    if (monacoEditor.value) {
      toRaw(monacoEditor.value).updateOptions({ wordWrap: wrap ? 'on' : 'off' })
    }
  }
)

watch(
  () => props.showLineNumbers,
  (show) => {
    if (monacoEditor.value) {
      toRaw(monacoEditor.value).updateOptions({ lineNumbers: show ? 'on' : 'off' })
    }
  }
)

watch(
  () => props.showMinimap,
  (show) => {
    if (monacoEditor.value) {
      toRaw(monacoEditor.value).updateOptions({ minimap: { enabled: show } })
    }
  }
)

const initEditor = () => {
  if (!monacoEditorContainer.value) return

  recreateEditorInstance(
    monacoEditor,
    monacoEditorContainer,
    createMonacoEditorOptions({
      value: props.content,
      language: props.language,
      theme: monacoTheme.value,
      lineNumbers: props.showLineNumbers ? 'on' : 'off',
      readOnly: props.readOnly,
      minimapEnabled: props.showMinimap,
      wordWrap: props.wordWrap ? 'on' : 'off',
      fontSize: props.fontSize,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      matchBrackets: 'always',
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: true,
      formatOnType: true
    }),
    {
      disposeModel: true
    }
  )

  const emitEditorStats = () => {
    const model = toRaw(monacoEditor.value).getModel()
    if (model) {
      lineCount.value = model.getLineCount()
      charCount.value = model.getValue().length
      emit('stats-change', {
        lineCount: lineCount.value,
        charCount: charCount.value
      })
    }
  }

  const emitUndoRedoState = () => {
    const undoAction = toRaw(monacoEditor.value).getAction('undo')
    const redoAction = toRaw(monacoEditor.value).getAction('redo')
    canUndo.value = undoAction?.isEnabled?.() || false
    canRedo.value = redoAction?.isEnabled?.() || false
    emit('undo-redo-state-change', { canUndo: canUndo.value, canRedo: canRedo.value })
  }

  // Monitor content changes
  toRaw(monacoEditor.value).onDidChangeModelContent(() => {
    const model = toRaw(monacoEditor.value).getModel()
    if (model) {
      emit('content-change', model.getValue())
    }
    emitEditorStats()
    emitUndoRedoState()
  })

  emitEditorStats()
  emitUndoRedoState()
}

const undo = () => {
  if (monacoEditor.value && canUndo.value) {
    toRaw(monacoEditor.value).trigger('keyboard', 'undo', null)
  }
}

const redo = () => {
  if (monacoEditor.value && canRedo.value) {
    toRaw(monacoEditor.value).trigger('keyboard', 'redo', null)
  }
}

const toggleSearch = () => {
  if (monacoEditor.value) {
    toRaw(monacoEditor.value).trigger('keyboard', 'actions.find', null)
  }
}

const toggleReplace = () => {
  if (monacoEditor.value) {
    toRaw(monacoEditor.value).trigger('keyboard', 'editor.action.startFindReplaceAction', null)
  }
}

const formatCode = () => {
  if (monacoEditor.value) {
    toRaw(monacoEditor.value).getAction('editor.action.formatDocument').run()
  }
}

const getContent = () => {
  if (monacoEditor.value) {
    return toRaw(monacoEditor.value).getValue()
  }
  return props.content
}

const getEditorInstance = () => {
  return monacoEditor.value
}

const stopMonacoThemeWatch = watchMonacoTheme(() => monacoEditor.value)

onUnmounted(() => {
  stopMonacoThemeWatch()
  disposeEditorInstance(monacoEditor, { disposeModel: true })
})

defineExpose({
  initEditor,
  undo,
  redo,
  toggleSearch,
  toggleReplace,
  formatCode,
  getContent,
  getEditorInstance,
  canUndo,
  canRedo,
  lineCount,
  charCount
})
</script>

<style scoped>
.editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.file-content {
  flex: 1;
  min-height: 0;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
  border-top: 1px solid var(--preview-soft-border);
}

.file-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.file-content::-webkit-scrollbar-track {
  background: var(--el-bg-color-page);
}

.file-content::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: var(--el-border-radius-small);
}

.file-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}
</style>
