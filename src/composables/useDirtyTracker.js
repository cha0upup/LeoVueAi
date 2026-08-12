import { computed, ref } from 'vue'

/**
 * 跟踪表单脏状态。调用方提供一个返回当前快照的函数，组件挂载时
 * 会立即取一次基线；之后任何 reactive 字段变化都会让 `isDirty` 变 true。
 *
 * 适用于编辑类 dialog —— 关闭前可以根据 `isDirty.value` 决定是否
 * 弹"放弃修改"确认。
 *
 * 使用：
 * ```js
 * const { isDirty, reset } = useDirtyTracker(() =>
 *   JSON.stringify({ name: form.name, content: form.content })
 * )
 *
 * function hydrate() {
 *   form.name = props.data.name
 *   form.content = props.data.content
 *   reset()  // 加载完成 → 重置基线，避免被 hydrate 误判为 dirty
 * }
 *
 * function onSubmitSuccess() {
 *   reset()  // 提交成功 → 把当前内容当作新基线
 * }
 * ```
 *
 * @param {() => string} getSnapshot 返回当前表单序列化字符串的函数
 * @returns {{
 *   isDirty: import('vue').ComputedRef<boolean>,
 *   reset: () => void
 * }}
 */
export function useDirtyTracker(getSnapshot) {
  if (typeof getSnapshot !== 'function') {
    throw new TypeError('useDirtyTracker: getSnapshot 必须是函数')
  }

  const baseline = ref(getSnapshot())
  const isDirty = computed(() => getSnapshot() !== baseline.value)

  function reset() {
    baseline.value = getSnapshot()
  }

  return { isDirty, reset }
}
