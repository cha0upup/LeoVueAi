import { computed, toRaw, watch } from 'vue'
import { monaco } from '@/utils/monaco.js'
import { useTheme } from '@/stores/theme'

export function useMonacoTheme() {
  const themeStore = useTheme()
  const monacoTheme = computed(() => (themeStore.currentTheme.value === 'dark' ? 'vs-dark' : 'vs'))

  const syncTheme = () => {
    monaco.editor.setTheme(monacoTheme.value)
  }

  const watchMonacoTheme = (getEditors) =>
    watch(monacoTheme, () => {
      const editors = typeof getEditors === 'function' ? getEditors() : getEditors
      const activeEditors = (Array.isArray(editors) ? editors : [editors]).filter(Boolean)

      if (!activeEditors.length) {
        return
      }

      syncTheme()
    })

  const disposeMonacoEditors = (...editorRefs) => {
    editorRefs.forEach((editorRef) => {
      if (!editorRef?.value) return
      toRaw(editorRef.value).dispose()
      editorRef.value = null
    })
  }

  return {
    monacoTheme,
    syncTheme,
    watchMonacoTheme,
    disposeMonacoEditors
  }
}
