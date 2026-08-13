import { toRaw } from 'vue'
import { monaco } from '@/utils/monaco.js'

export function useMonacoEditorInstance() {
  const disposeEditorInstance = (editorRef, { disposeModel = false } = {}) => {
    if (!editorRef?.value) return

    const editor = toRaw(editorRef.value)
    const model = editor.getModel()

    if (disposeModel && model) {
      model.dispose()
    }

    editor.dispose()
    editorRef.value = null
  }

  const recreateEditorInstance = (editorRef, containerRef, options, extra = {}) => {
    const { disposeModel = false } = extra

    disposeEditorInstance(editorRef, { disposeModel })

    if (!containerRef?.value) {
      return null
    }

    editorRef.value = monaco.editor.create(toRaw(containerRef.value), options)
    return editorRef.value
  }

  return {
    disposeEditorInstance,
    recreateEditorInstance
  }
}
