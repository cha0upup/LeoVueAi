import { onBeforeUnmount, watch } from 'vue'

/**
 * 在 dialog 显示期间监听 Ctrl/Cmd+S，触发保存动作。
 *
 * 用 capture 阶段监听，确保比 Monaco 等编辑器内部的 Ctrl+S 命令更早
 * 拿到事件，并 preventDefault 阻止浏览器原生"保存网页"。
 *
 * 使用：
 * ```js
 * const visible = useDialogVisible(props, emit)
 * useSaveShortcut(visible, () => handleSubmit(), {
 *   isLoading: () => props.loading
 * })
 * ```
 *
 * @param {import('vue').Ref<boolean>} visibleRef dialog 当前是否显示
 * @param {() => void} onSave Ctrl+S 按下时调用的回调
 * @param {Object} [options]
 * @param {() => boolean} [options.isLoading] 返回 true 时不触发保存
 */
export function useSaveShortcut(visibleRef, onSave, options = {}) {
  const { isLoading } = options

  function handler(e) {
    const isSave = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')
    if (!isSave) return
    e.preventDefault()
    e.stopPropagation()
    if (typeof isLoading === 'function' && isLoading()) return
    onSave()
  }

  watch(
    visibleRef,
    (visible) => {
      if (visible) {
        document.addEventListener('keydown', handler, true)
      } else {
        document.removeEventListener('keydown', handler, true)
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handler, true)
  })
}
