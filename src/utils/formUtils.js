import { showError, showSuccess } from './messageUtils.js'
import { withLoading } from './apiUtils.js'
import { handleError } from './errorHandler.js'
/**
 * 表单工具函数
 * 提供表单相关的通用方法
 */

/**
 * 表单验证的通用处理
 * @param {Object} formRef - 表单引用对象
 * @param {Object} options - 配置选项
 * @param {string} options.errorMessage - 验证失败时的错误消息
 * @returns {Promise<boolean>} 验证是否通过
 */
export async function validateForm(formRef, options = {}) {
  const { errorMessage = '表单验证失败，请检查输入' } = options

  if (!formRef?.value) {
    showError('表单引用不存在')
    return false
  }

  try {
    const valid = await formRef.value.validate()
    if (!valid) {
      showError(errorMessage)
      return false
    }
    return true
  } catch {
    showError(errorMessage)
    return false
  }
}

/**
 * 重置表单
 * @param {Object} formRef - 表单引用对象
 * @param {Object} formData - 表单数据对象
 * @param {Object} defaultValues - 默认值对象
 */
export function resetForm(formRef, formData, defaultValues) {
  // 重置 Element Plus 表单验证状态
  if (formRef?.value) {
    formRef.value.resetFields()
    formRef.value.clearValidate?.()
  }

  // 重置表单数据
  if (formData && defaultValues) {
    Object.assign(formData, { ...defaultValues })
  }
}

/**
 * 表单提交的通用处理（带loading状态管理）
 * @param {Function} submitFn - 提交函数，应该返回 Promise
 * @param {Object} options - 配置选项
 * @param {Object} options.loadingRef - loading状态的ref对象
 * @param {string} options.successMessage - 成功消息
 * @param {string} options.errorMessage - 错误消息
 * @param {Function} options.onSuccess - 成功回调
 * @param {Function} options.onError - 错误回调
 * @returns {Promise} 提交结果
 */
export async function handleFormSubmit(submitFn, options = {}) {
  const {
    loadingRef,
    successMessage = '操作成功',
    errorMessage = '操作失败，请稍后重试',
    onSuccess,
    onError
  } = options

  return withLoading(loadingRef, async () => {
    try {
      const result = await submitFn()

      if (result !== false) {
        if (successMessage) showSuccess(successMessage)
        if (typeof onSuccess === 'function') onSuccess(result)
        return result
      } else {
        if (errorMessage) showError(errorMessage)
        if (typeof onError === 'function') onError()
        return false
      }
    } catch (error) {
      if (errorMessage) handleError(error, { defaultMessage: errorMessage })
      if (typeof onError === 'function') onError(error)
      throw error
    }
  })
}
