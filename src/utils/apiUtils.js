/**
 * API请求工具函数
 * 提供统一的API请求处理，包括loading状态管理、错误处理和成功消息提示
 */

import { handleError } from './errorHandler.js'
import { showSuccess } from './messageUtils.js'

const loadingRefCounts = new WeakMap()

function beginLoading(loadingRef) {
  if (!loadingRef || (typeof loadingRef !== 'object' && typeof loadingRef !== 'function')) return
  loadingRefCounts.set(loadingRef, (loadingRefCounts.get(loadingRef) || 0) + 1)
  loadingRef.value = true
}

function endLoading(loadingRef) {
  if (!loadingRef || (typeof loadingRef !== 'object' && typeof loadingRef !== 'function')) return
  const remaining = Math.max(0, (loadingRefCounts.get(loadingRef) || 1) - 1)
  if (remaining > 0) {
    loadingRefCounts.set(loadingRef, remaining)
    return
  }
  loadingRefCounts.delete(loadingRef)
  loadingRef.value = false
}

/**
 * 用 loadingRef 包裹异步操作，保证 finally 中一定重置状态
 * @param {Object|null} loadingRef
 * @param {Function} fn
 * @returns {Promise}
 */
export async function withLoading(loadingRef, fn) {
  beginLoading(loadingRef)
  try {
    return await fn()
  } finally {
    endLoading(loadingRef)
  }
}

/**
 * 执行API请求的通用方法
 * @param {Function} requestFn - API请求函数，应该返回Promise
 * @param {Object} [options]
 * @param {Object} [options.loadingRef] - loading状态的ref对象
 * @param {string} [options.successMessage] - 成功消息（null则不显示）
 * @param {string} [options.errorMessage='操作失败，请稍后重试'] - 错误消息
 * @param {Function} [options.onSuccess] - 成功回调
 * @param {Function} [options.onError] - 错误回调
 * @param {Object} [options.errorMessages] - 状态码 → 文案覆盖映射
 * @param {boolean} [options.showSuccessMessage=true] - 是否显示成功消息
 * @param {boolean} [options.showErrorMessage=true] - 是否显示错误消息
 * @returns {Promise}
 */
export async function executeRequest(requestFn, options = {}) {
  const {
    loadingRef,
    successMessage = null,
    errorMessage = '操作失败，请稍后重试',
    errorMessages,
    onSuccess,
    onError,
    showSuccessMessage = true,
    showErrorMessage = true
  } = options

  return withLoading(loadingRef, async () => {
    try {
      const result = await requestFn()

      if (successMessage && showSuccessMessage) {
        showSuccess(successMessage)
      }
      if (typeof onSuccess === 'function') {
        await onSuccess(result)
      }

      return result
    } catch (error) {
      if (showErrorMessage) {
        handleError(error, {
          defaultMessage: errorMessage,
          defaultMessages: errorMessages,
          showMessage: true
        })
      }
      if (typeof onError === 'function') {
        await onError(error)
      }
      throw error
    }
  })
}

/**
 * 执行API请求并在成功时显示提示消息
 * 响应格式已由 axios 拦截器统一处理，此处直接使用 response.data。
 * @param {Function} requestFn - API请求函数
 * @param {Object} [options]
 * @param {Object} [options.loadingRef] - loading状态的ref对象
 * @param {Object} [options.successMessages] - 成功消息映射，{ default: '操作成功' }
 * @param {Object} [options.errorMessages] - 错误消息映射，{ 400: '参数错误' }
 * @param {Function} [options.onSuccess] - 成功回调
 * @param {Function} [options.onError] - 错误回调
 * @returns {Promise}
 */
export async function executeRequestWithStatus(requestFn, options = {}) {
  const { loadingRef, successMessages = {}, errorMessages = {}, onSuccess, onError } = options

  return executeRequest(requestFn, {
    loadingRef,
    successMessage: successMessages.default || '操作成功',
    errorMessages,
    onSuccess,
    onError
  })
}
