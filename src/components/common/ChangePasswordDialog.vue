<template>
  <el-dialog
    v-model="changePasswordVisible"
    width="560px"
    class="change-password-dialog"
    @close="handleClose"
  >
    <div class="dialog-shell">
      <div class="dialog-head">
        <div class="dialog-head-copy">
          <span class="dialog-kicker">账户安全</span>
          <h2>修改密码</h2>
          <p>输入当前密码并设置新密码，提交后将立即更新当前账户凭据。</p>
        </div>
        <div class="dialog-head-icon">
          <el-icon><Icon :icon="iconMap.lock" /></el-icon>
        </div>
      </div>

      <div class="security-note">
        <el-icon><Icon :icon="iconMap.shield" /></el-icon>
        <span>
          密码至少 {{ AUTH_FIELD_LIMITS.passwordMinLength }} 个字符，具体要求以系统安全策略为准，最长
          {{ AUTH_FIELD_LIMITS.passwordMaxLength }} 个字符。
        </span>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="password-form"
      >
        <div class="form-grid">
          <div class="field-card">
            <div class="field-head">
              <span>旧密码</span>
              <small>验证当前身份</small>
            </div>
            <el-form-item prop="oldPassword">
              <el-input
                v-model="form.oldPassword"
                type="password"
                placeholder="请输入旧密码"
                :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
                show-password
                class="password-input"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.key" /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </div>

          <div class="field-card">
            <div class="field-head">
              <span>新密码</span>
              <small>设置新的登录凭据</small>
            </div>
            <el-form-item prop="newPassword">
              <el-input
                v-model="form.newPassword"
                type="password"
                placeholder="请输入新密码"
                :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
                show-password
                class="password-input"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.lock" /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </div>

          <div class="field-card">
            <div class="field-head">
              <span>确认密码</span>
              <small>再次确认新密码</small>
            </div>
            <el-form-item prop="confirmPassword">
              <el-input
                v-model="form.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
                show-password
                class="password-input"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.check" /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </div>
        </div>
      </el-form>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          class="footer-button"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          class="footer-button primary-button"
          type="primary"
          @click="submitForm"
        >
          提交修改
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { AUTH_FIELD_LIMITS } from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { validateForm, handleFormSubmit, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { changePasswordApi } from '@/services/api.js'

const dialog = useDialog()
const changePasswordVisible = dialog.visible
const iconMap = icons

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      min: AUTH_FIELD_LIMITS.passwordMinLength,
      max: AUTH_FIELD_LIMITS.passwordMaxLength,
      message: `密码长度在 ${AUTH_FIELD_LIMITS.passwordMinLength} 到 ${AUTH_FIELD_LIMITS.passwordMaxLength} 个字符`,
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const formRef = ref(null)

const openChangePasswordDialog = () => {
  dialog.open()
}

const handleClose = () => {
  resetFormUtil(formRef, form, {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  dialog.close()
}

const submitForm = async () => {
  const isValid = await validateForm(formRef, {
    errorMessage: '请检查表单输入'
  })
  if (!isValid) return

  await handleFormSubmit(
    async () => {
      const response = await changePasswordApi({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword
      })
      return response
    },
    {
      successMessage: '密码修改成功',
      errorMessage: '请求失败，请稍后重试',
      onSuccess: () => {
        handleClose()
      }
    }
  )
}

defineExpose({
  openChangePasswordDialog
})
</script>

<style scoped>
.dialog-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dialog-head-copy h2 {
  margin: 8px 0 10px;
  font-size: 28px;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.dialog-head-copy p {
  margin: 0;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.dialog-kicker {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.dialog-head-icon {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
  border: 1px solid color-mix(in srgb, var(--el-color-primary-light-7) 54%, transparent);
  font-size: 22px;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--el-color-success-light-7) 54%, transparent);
  background: color-mix(in srgb, var(--el-color-success) 12%, var(--app-control-background));
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.security-note .el-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--el-color-success);
}

.password-form {
  margin-top: 2px;
}

.form-grid {
  display: grid;
  gap: 14px;
}

.field-card {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 74%, transparent);
  background: var(--app-card-background);
}

.field-head {
  margin-bottom: 12px;
}

.field-head span {
  display: block;
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.field-head small {
  color: var(--el-text-color-secondary);
}

.password-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.password-input :deep(.el-input__wrapper) {
  min-height: 50px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 74%, transparent);
  background: var(--app-control-background);
  box-shadow: var(--app-shell-shadow-soft);
  padding: 0 14px;
  transition: all 0.2s ease;
}

.password-input :deep(.el-input__wrapper:hover) {
  border-color: color-mix(in srgb, var(--el-color-primary-light-5) 42%, transparent);
  box-shadow: var(--app-card-shadow-hover);
}

.password-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 4px rgba(64, 117, 255, 0.12);
}

.password-input :deep(.el-input__inner) {
  height: 48px;
  font-size: 15px;
}

.password-input :deep(.el-input__prefix-inner) {
  color: var(--el-text-color-secondary);
  font-size: 17px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.footer-button {
  min-width: 112px;
  height: 42px;
  border-radius: 14px;
}

.primary-button {
  background: var(--app-primary-strong-surface);
  border: none;
  box-shadow: var(--app-primary-shadow);
}

.primary-button:hover {
  background: var(--app-primary-strong-surface);
}

:deep(.change-password-dialog .el-dialog) {
  border-radius: 28px;
  overflow: hidden;
}

:deep(.change-password-dialog .el-dialog__header) {
  display: none;
}

:deep(.change-password-dialog .el-dialog__body) {
  padding: 28px 28px 12px;
}

:deep(.change-password-dialog .el-dialog__footer) {
  padding: 0 28px 24px;
}

@media (max-width: 640px) {
  :deep(.change-password-dialog) {
    width: calc(100vw - 24px) !important;
  }

  .dialog-head {
    flex-direction: column;
  }

  .dialog-head-copy h2 {
    font-size: 24px;
  }

  :deep(.change-password-dialog .el-dialog__body) {
    padding: 22px 22px 10px;
  }

  :deep(.change-password-dialog .el-dialog__footer) {
    padding: 0 22px 20px;
  }
}
</style>
