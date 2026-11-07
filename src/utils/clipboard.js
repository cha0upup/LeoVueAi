import { showError, showSuccess } from './messageUtils.js'

/** 共用剪贴板写入与反馈；调用方保留内容准备、空值和生命周期判断。 */
export async function copyTextWithFeedback(
  text,
  successMessage = '已复制到剪贴板',
  errorMessage = '复制失败，请手动复制'
) {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(successMessage)
  } catch {
    showError(errorMessage)
  }
}
