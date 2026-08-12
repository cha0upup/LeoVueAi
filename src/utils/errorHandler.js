/**
 * 错误处理工具函数
 * 统一处理应用中的错误和异常
 */

import { showError } from './messageUtils.js'
import { formatDatabaseError } from './databaseError.js'

/** 默认的 HTTP/业务状态码 → 提示文案映射 */
const DEFAULT_CODE_MESSAGES = {
  400: '请求参数错误',
  401: '用户未登录，请先登录',
  403: '没有权限执行此操作',
  404: '资源不存在',
  500: '服务器错误'
}

/**
 * 从 HTTP/业务响应对象中解析出错误消息字符串（不弹出提示）
 * @param {Object} response - axios 响应对象
 * @param {Object} [overrides] - 自定义错误消息映射，{ 400: '...', default: '...' }
 * @returns {string}
 */
function resolveResponseErrorMessage(response, overrides = {}, fallbackMessage = '操作失败') {
  const code = response?.data?.code
  const message = response?.data?.msg

  const codeMessages = { ...DEFAULT_CODE_MESSAGES, ...overrides }
  const fallback = overrides.default || fallbackMessage

  if (response?.data?.errorCategory) {
    return formatDatabaseError({ response }, fallback)
  }

  if (code && codeMessages[code]) {
    return codeMessages[code] + (message ? `：${message}` : '')
  }
  return message || fallback
}

/**
 * 统一处理异常，可选地弹出错误提示
 * @param {Error} error - catch 捕获的错误
 * @param {Object} [options]
 * @param {string} [options.defaultMessage='操作失败，请重试'] - 无法解析时的兜底文案
 * @param {boolean} [options.showMessage=true] - 是否弹出 ElMessage 提示
 * @param {Object} [options.defaultMessages] - 状态码 → 文案覆盖映射
 * @returns {string} 最终展示的错误消息
 */
export function handleError(error, options = {}) {
  const { defaultMessage = '操作失败，请重试', showMessage = true, defaultMessages } = options

  let errorMessage = defaultMessage

  if (error?.response) {
    // axios HTTP 错误：从响应体中解析
    errorMessage = resolveResponseErrorMessage(error.response, defaultMessages, defaultMessage)
  } else if (error?.message) {
    errorMessage = error.message
  }

  if (showMessage) {
    showError(errorMessage)
  }

  return errorMessage
}
