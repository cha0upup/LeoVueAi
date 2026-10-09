import { AUTH_FIELD_LIMITS } from '@/constants/app.js'
import { showError } from './messageUtils.js'
/**
 * 表单工具函数
 * 提供表单相关的通用方法
 */

export function createPasswordRules(requiredMessage = '请输入新密码') {
  return [
    { required: true, message: requiredMessage, trigger: 'blur' },
    {
      min: AUTH_FIELD_LIMITS.passwordMinLength,
      max: AUTH_FIELD_LIMITS.passwordMaxLength,
      message: `密码长度在 ${AUTH_FIELD_LIMITS.passwordMinLength} 到 ${AUTH_FIELD_LIMITS.passwordMaxLength} 个字符`,
      trigger: 'blur'
    }
  ]
}

export const createPasswordMatchValidator = (getPassword, message = '两次输入的密码不一致') =>
  (rule, value, callback) => {
    if (value !== getPassword()) {
      callback(new Error(message))
    } else {
      callback()
    }
  }

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
