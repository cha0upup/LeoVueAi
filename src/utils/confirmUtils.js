/**
 * 确认对话框工具函数
 * 提供统一的确认操作处理
 */

import { ElMessageBox } from 'element-plus'
import { showError, showSuccess, showWarning } from './messageUtils.js'
import { withLoading } from './apiUtils.js'

/**
 * 底层确认弹窗，供 confirmDelete / confirmAction 复用
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmButtonText='确定']
 * @param {string} [opts.cancelButtonText='取消']
 * @param {string} [opts.type='warning']
 * @returns {Promise<boolean>}
 */
async function showConfirm({
  title,
  message,
  confirmButtonText = '确定',
  cancelButtonText = '取消',
  type = 'warning'
}) {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText,
      cancelButtonText,
      type,
      dangerouslyUseHTMLString: false
    })
    return true
  } catch {
    return false
  }
}

/**
 * 显示删除确认对话框
 * @param {Object} [options]
 * @param {string} [options.title='确认删除']
 * @param {string} [options.message='此操作不可恢复，确定要继续吗？']
 * @param {string} [options.confirmButtonText='确定']
 * @param {string} [options.cancelButtonText='取消']
 * @param {string} [options.type='warning']
 * @returns {Promise<boolean>}
 */
export async function confirmDelete(options = {}) {
  return showConfirm({
    title: '确认删除',
    message: '此操作不可恢复，确定要继续吗？',
    ...options
  })
}

/**
 * 显示通用确认对话框
 * @param {Object} [options]
 * @param {string} [options.title='提示']
 * @param {string} [options.message='确定要执行此操作吗？']
 * @param {string} [options.confirmButtonText='确定']
 * @param {string} [options.cancelButtonText='取消']
 * @param {string} [options.type='warning']
 * @returns {Promise<boolean>}
 */
export async function confirmAction(options = {}) {
  return showConfirm({
    title: '提示',
    message: '确定要执行此操作吗？',
    ...options
  })
}

/**
 * 执行带确认的删除操作
 * @param {Function} deleteFn - 删除函数，应该返回Promise
 * @param {Object} options - 配置选项
 * @param {string} options.title - 确认对话框标题
 * @param {string} options.message - 确认对话框消息
 * @param {string} options.successMessage - 成功消息
 * @param {string} options.errorMessage - 错误消息
 * @param {Function} options.onSuccess - 成功回调
 * @param {Function} options.onError - 错误回调
 * @param {Object} options.loadingRef - loading状态的ref对象
 * @returns {Promise} 删除结果
 */
export async function executeDeleteWithConfirm(deleteFn, options = {}) {
  const {
    title = '确认删除',
    message = '此操作不可恢复，确定要继续吗？',
    successMessage = '删除成功',
    errorMessage = '删除失败，请稍后重试',
    onSuccess,
    onError,
    loadingRef
  } = options

  const confirmed = await confirmDelete({ title, message })
  if (!confirmed) return false

  return withLoading(loadingRef, async () => {
    try {
      const result = await deleteFn()
      if (successMessage) showSuccess(successMessage)
      if (typeof onSuccess === 'function') onSuccess(result)
      return result
    } catch (error) {
      if (errorMessage) showError(errorMessage)
      if (typeof onError === 'function') onError(error)
      throw error
    }
  })
}

/**
 * 执行批量删除操作
 * @param {Array} items - 要删除的项数组
 * @param {Function} deleteFn - 删除函数，接收数组中的每一项并返回 Promise
 * @param {Object} options - 配置选项
 * @param {string} options.itemName - 项目名称，如'用户'、'文件'等
 * @param {Object} options.loadingRef - loading状态的ref对象
 * @param {Function} options.onSuccess - 成功回调
 * @param {string} options.confirmMessage - 自定义确认消息
 * @returns {Promise} 删除结果
 */
export async function executeBatchDelete(items, deleteFn, options = {}) {
  const { itemName = '项', loadingRef, onSuccess, confirmMessage } = options

  const count = Array.isArray(items) ? items.length : 0

  if (!count) {
    showWarning(`请先选择要删除的${itemName}`)
    return false
  }

  const confirmed = await confirmDelete({
    message: confirmMessage || `确定要删除选中的 ${count} 个${itemName}吗？此操作不可恢复。`
  })
  if (!confirmed) return false

  return withLoading(loadingRef, async () => {
    const results = await Promise.allSettled(items.map((item) => deleteFn(item)))

    let successCount = 0
    let failCount = 0
    results.forEach((res) => {
      if (res.status === 'fulfilled') successCount += 1
      else failCount += 1
    })

    if (successCount > 0 && failCount === 0) {
      showSuccess(`批量删除成功 ${successCount} 个${itemName}`)
    } else if (successCount > 0 && failCount > 0) {
      showWarning(`部分删除成功：成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      showError(`删除${itemName}失败，请稍后重试`)
      throw new Error('批量删除失败')
    }

    if (typeof onSuccess === 'function') onSuccess({ successCount, failCount })
    return { successCount, failCount }
  })
}
