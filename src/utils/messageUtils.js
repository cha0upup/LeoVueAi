import { ElMessage } from 'element-plus'

const OPTION_KEYS = new Set([
  'message',
  'type',
  'duration',
  'showClose',
  'center',
  'dangerouslyUseHTMLString',
  'customClass',
  'icon',
  'offset',
  'appendTo',
  'grouping',
  'repeatNum',
  'onClose'
])

function isMessageOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value instanceof Error || value.response) return false
  return Object.keys(value).some((key) => OPTION_KEYS.has(key))
}

function stringifyMessage(value, fallback) {
  if (value == null) return fallback
  if (value instanceof Error) return value.message || fallback
  if (typeof value === 'string') return value || fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    return value.message || value.msg || fallback
  }
  return String(value)
}

function notify(type, messageOrOptions, options = {}) {
  if (isMessageOptions(messageOrOptions)) {
    return ElMessage({
      ...messageOrOptions,
      ...options,
      type
    })
  }

  return ElMessage({
    ...options,
    type,
    message: stringifyMessage(messageOrOptions, options.defaultMessage || '操作失败')
  })
}

export function showMessage(messageOrOptions, options = {}) {
  if (isMessageOptions(messageOrOptions)) {
    return ElMessage({
      ...messageOrOptions,
      ...options
    })
  }

  return ElMessage({
    ...options,
    message: stringifyMessage(messageOrOptions, options.defaultMessage || '操作失败')
  })
}

export function showSuccess(messageOrOptions, options) {
  return notify('success', messageOrOptions, options)
}

export function showWarning(messageOrOptions, options) {
  return notify('warning', messageOrOptions, options)
}

export function showInfo(messageOrOptions, options) {
  return notify('info', messageOrOptions, options)
}

export function showError(messageOrOptions, options) {
  return notify('error', messageOrOptions, options)
}

/**
 * 统一格式化 API 错误并通过 ElMessage 弹出。
 *
 * 常见模式:
 *   try { ... } catch (e) { showError('操作失败: ' + (e.message || e)) }
 * 简化为:
 *   try { ... } catch (e) { handleApiError(e, '操作失败') }
 *
 * @param error  捕获到的 error / Response / 字符串
 * @param prefix 错误前缀(如 "查询日志失败")
 */
export function handleApiError(error, prefix) {
  const msg = stringifyMessage(error, '未知错误')
  return notify('error', `${prefix}: ${msg}`)
}
