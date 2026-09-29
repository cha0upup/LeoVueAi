import { showError } from './messageUtils.js'
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
