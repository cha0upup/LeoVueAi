import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { changePasswordApi } from '@/services/api/auth.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'
import { createPasswordMatchValidator, createPasswordRules, validateForm } from '@/utils/formUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const emptyPasswords = () => ({ oldPassword: '', newPassword: '', confirmPassword: '' })

export function usePasswordChangeForm({ canSubmit, onSaved }) {
  const { passwordMinLength, passwordMaxLength } = useAuth()
  const form = reactive(emptyPasswords())
  const formRef = ref(null)
  const submitting = ref(false)
  let disposed = false
  const rules = computed(() => ({
    oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
    newPassword: createPasswordRules('请输入新密码', { min: passwordMinLength.value, max: passwordMaxLength.value }),
    confirmPassword: [
      { required: true, message: '请确认新密码', trigger: 'blur' },
      { validator: createPasswordMatchValidator(() => form.newPassword), trigger: 'blur' }
    ]
  }))

  const clear = () => {
    Object.assign(form, emptyPasswords())
    formRef.value?.clearValidate?.()
  }

  watch(sessionGeneration, () => {
    clear()
    submitting.value = false
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    clear()
  })

  async function submitForm() {
    if (disposed || submitting.value || !canSubmit()) return
    const generation = sessionGeneration.value
    const isActive = () => !disposed && isCurrentSession(generation) && canSubmit()
    submitting.value = true
    try {
      if (!await validateForm(formRef, { errorMessage: '请检查密码输入' }) || !isActive()) return
      try {
        await changePasswordApi({ oldPassword: form.oldPassword, newPassword: form.newPassword })
      } catch (error) {
        if (isActive()) showError(error?.response?.data?.msg || error?.message || '密码修改失败，请稍后重试')
        return
      }
      if (!isActive()) return
      clear()
      showSuccess('密码修改成功')
      await onSaved()
    } finally {
      if (isCurrentSession(generation)) submitting.value = false
    }
  }

  return { form, formRef, rules, submitting, passwordMinLength, passwordMaxLength, clear, submitForm }
}
