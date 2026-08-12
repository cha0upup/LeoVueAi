<template>
  <div
    ref="containerRef"
    class="code-preview"
  />
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'plaintext' },
  readonly: { type: Boolean, default: true },
  fontSize: { type: Number, default: 13 },
  wordWrap: { type: String, default: 'on' },
  minimap: { type: Boolean, default: false }
})

const containerRef = ref(null)
const editorRef = ref(null)

const { monacoTheme, watchMonacoTheme } = useMonacoTheme()
const { disposeEditorInstance, recreateEditorInstance } = useMonacoEditorInstance()

const buildOptions = () => createMonacoEditorOptions({
  value: props.modelValue,
  language: props.language,
  theme: monacoTheme.value,
  readOnly: props.readonly,
  fontSize: props.fontSize,
  minimapEnabled: props.minimap,
  wordWrap: props.wordWrap,
  lineNumbers: 'on',
  folding: true,
  renderWhitespace: 'selection'
})

const ensureEditor = () => {
  if (!containerRef.value) return
  recreateEditorInstance(editorRef, containerRef, buildOptions(), { disposeModel: true })
}

onMounted(() => {
  ensureEditor()
})

// 内容变化：复用同一 editor 实例改 value，避免重建（保留滚动位置）
watch(
  () => props.modelValue,
  (val) => {
    const editor = editorRef.value
    if (!editor) {
      ensureEditor()
      return
    }
    if (editor.getValue() !== val) {
      editor.setValue(val ?? '')
    }
  }
)

// 语言变化：用 monaco model 切语言；语言不可变时重建
watch(
  () => props.language,
  () => {
    ensureEditor()
  }
)

const stopThemeWatch = watchMonacoTheme(() => editorRef.value)

onUnmounted(() => {
  stopThemeWatch()
  disposeEditorInstance(editorRef, { disposeModel: true })
})
</script>

<style scoped>
.code-preview {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
