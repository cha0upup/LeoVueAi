import { computed } from 'vue'

/**
 * 双向绑定 dialog 的 visible 状态，避免组件内重复写两个 watch。
 *
 * 使用：
 * ```js
 * const visible = useDialogVisible(props, emit)
 * // 模板里：<el-dialog v-model="visible" ... />
 * // 关闭：visible.value = false
 * ```
 *
 * @param {Object} props 来源组件 props，必须包含 `modelValue: Boolean`
 * @param {Function} emit 来源组件 `defineEmits` 返回的 emit 函数
 * @param {string} [propName='modelValue'] 自定义 prop 名
 * @param {string} [eventName] emit 的事件名，默认 `update:${propName}`
 * @returns {import('vue').WritableComputedRef<boolean>}
 */
export function useDialogVisible(props, emit, propName = 'modelValue', eventName) {
  const event = eventName || `update:${propName}`
  return computed({
    get: () => Boolean(props[propName]),
    set: (value) => emit(event, Boolean(value))
  })
}
