import { confirmAction } from '@/utils/confirmUtils.js'

/**
 * 用脏检查包裹 dialog 关闭流程，未保存的修改会先弹确认。
 *
 * 返回两个函数：
 * - `handleBeforeClose(done)`：直接接到 `<el-dialog :before-close>` 上，
 *   覆盖 X、ESC、点击遮罩三种关闭路径
 * - `handleClose()`：用在自定义的"取消"按钮上
 *
 * 使用：
 * ```js
 * const { handleBeforeClose, handleClose } = useConfirmClose({
 *   isDirty,
 *   onClose: () => { visible.value = false }
 * })
 * ```
 *
 * @param {Object} options
 * @param {import('vue').Ref<boolean>|import('vue').ComputedRef<boolean>} options.isDirty
 *        当前是否处于"未保存"状态
 * @param {() => void} options.onClose 真正执行关闭的动作
 * @param {Object} [options.confirmText] 自定义提示文案
 * @param {string} [options.confirmText.title]
 * @param {string} [options.confirmText.message]
 * @param {string} [options.confirmText.confirmButtonText]
 * @param {string} [options.confirmText.cancelButtonText]
 * @returns {{
 *   handleBeforeClose: (done?: Function) => Promise<void>,
 *   handleClose: () => Promise<void>
 * }}
 */
export function useConfirmClose({ isDirty, onClose, confirmText = {} }) {
  const text = {
    title: '放弃修改？',
    message: '当前修改尚未保存，关闭后会丢失。确认关闭？',
    confirmButtonText: '放弃修改',
    cancelButtonText: '继续编辑',
    ...confirmText
  }

  async function ensureCanClose() {
    if (!isDirty.value) return true
    return confirmAction({
      title: text.title,
      message: text.message,
      confirmButtonText: text.confirmButtonText,
      cancelButtonText: text.cancelButtonText,
      type: 'warning'
    })
  }

  async function handleBeforeClose(done) {
    if (await ensureCanClose()) {
      if (typeof done === 'function') done()
      else onClose()
    }
  }

  async function handleClose() {
    if (await ensureCanClose()) onClose()
  }

  return { handleBeforeClose, handleClose }
}
