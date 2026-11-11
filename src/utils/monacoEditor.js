import { toRaw } from 'vue'
import { monaco } from '@/utils/monaco.js'

export function disposeEditorInstance(editorRef, { disposeModel = false } = {}) {
  if (!editorRef?.value) return

  const editor = toRaw(editorRef.value)
  const model = editor.getModel()

  if (disposeModel && model) {
    model.dispose()
  }

  editor.dispose()
  editorRef.value = null
}

export function recreateEditorInstance(editorRef, containerRef, options, extra = {}) {
  disposeEditorInstance(editorRef, extra)

  if (!containerRef?.value) {
    return null
  }

  editorRef.value = monaco.editor.create(toRaw(containerRef.value), options)
  return editorRef.value
}

export function createMonacoEditorOptions(config = {}) {
  const {
    value = '',
    language = 'plaintext',
    theme = 'vs',
    readOnly = false,
    automaticLayout = true,
    scrollBeyondLastLine = false,
    minimapEnabled = false,
    fontSize = 14,
    lineNumbers = 'on',
    wordWrap = 'off',
    ...overrides
  } = config

  return {
    value,
    language,
    theme,
    readOnly,
    automaticLayout,
    scrollBeyondLastLine,
    minimap: {
      enabled: minimapEnabled
    },
    fontSize,
    lineNumbers,
    wordWrap,
    ...overrides
  }
}
