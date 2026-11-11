import { showError, showSuccess } from './messageUtils.js'

/** text 可为文本或同步读取函数；调用方保留空值和生命周期判断。 */
export async function copyTextWithFeedback(
  text,
  successMessage = '已复制到剪贴板',
  errorMessage = '复制失败，请手动复制'
) {
  try {
    const content = typeof text === 'function' ? text() : text
    await navigator.clipboard.writeText(content)
    showSuccess(successMessage)
  } catch {
    showError(errorMessage)
  }
}
