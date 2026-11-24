<template>
  <div
    ref="container"
    class="preview-editor"
  />
</template>

<script setup>
import { onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
import { createMonacoEditorOptions, disposeEditorInstance, recreateEditorInstance } from '@/utils/monacoEditor.js'

const props = defineProps({
  content: { type: String, required: true },
  language: { type: String, required: true }
})
const container = ref(null)
const editor = shallowRef(null)
const { monacoTheme, watchMonacoTheme } = useMonacoTheme()

onMounted(() => {
  recreateEditorInstance(editor, container, createMonacoEditorOptions({
    value: props.content,
    language: props.language,
    theme: monacoTheme.value,
    readOnly: true,
    wordWrap: 'on',
    fontSize: 13,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace'
  }), { disposeModel: true })
})

watch(() => props.content, content => editor.value?.getModel()?.setValue(content))
watchMonacoTheme(() => editor.value)
onScopeDispose(() => disposeEditorInstance(editor, { disposeModel: true }))
</script>

<style scoped>
.preview-editor {
  height: 58vh;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--el-border-radius-base);
}
</style>
