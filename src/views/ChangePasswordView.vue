<template>
  <main class="password-change-page">
    <section class="password-change-card">
      <header class="page-header">
        <span class="brand-mark">
          <img
            src="/leo-logo.png"
            alt="LEO"
          >
        </span>
        <div>
          <span class="page-kicker">首次登录安全设置</span>
          <h1>请先修改初始密码</h1>
          <p>为保护账户安全，完成密码修改后才能进入 Leo 控制台。</p>
        </div>
      </header>

      <div class="security-note">
        <el-icon><Icon :icon="iconMap.shield" /></el-icon>
        <span>
          新密码长度为 {{ AUTH_FIELD_LIMITS.passwordMinLength }}–{{ AUTH_FIELD_LIMITS.passwordMaxLength }}
          个字符，并需满足服务端安全策略。
        </span>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="password-form"
        @keyup.enter="submitForm"
      >
        <el-form-item
          label="当前密码"
          prop="oldPassword"
        >
          <el-input
            v-model="form.oldPassword"
            type="password"
            placeholder="请输入当前使用的初始密码"
            :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
            size="large"
            show-password
            autofocus
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.key" /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item
          label="新密码"
          prop="newPassword"
        >
          <el-input
            v-model="form.newPassword"
            type="password"
            placeholder="请输入新密码"
            :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
            size="large"
            show-password
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.lock" /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item
          label="确认新密码"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
            size="large"
            show-password
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.check" /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          class="submit-button"
          :loading="submitting"
          @click="submitForm"
        >
          {{ submitting ? '正在修改...' : '修改密码并进入控制台' }}
        </el-button>
      </el-form>

      <footer class="page-footer">
        <span>当前会话仅允许修改密码或退出登录。</span>
        <el-button
          link
          type="primary"
          :disabled="submitting || loggingOut"
          @click="handleLogout"
        >
          {{ loggingOut ? '正在退出...' : '退出并切换账户' }}
        </el-button>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AUTH_FIELD_LIMITS, ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { changePasswordApi, logoutApi } from '@/services/api.js'
import { validateForm } from '@/utils/formUtils.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const iconMap = icons
const route = useRoute()
const router = useRouter()
const { fetchAuth, resetAuth } = useAuth()

const formRef = ref(null)
const submitting = ref(false)
const loggingOut = ref(false)
const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
    return
  }
  callback()
}

const rules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
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

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.msg || error?.message || fallback

const getRedirectTarget = () => {
  const rawRedirect = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect

  if (!rawRedirect || !rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) {
    return ROUTE_PATHS.main
  }
  if (
    rawRedirect.startsWith(ROUTE_PATHS.login) ||
    rawRedirect.startsWith(ROUTE_PATHS.changePassword)
  ) {
    return ROUTE_PATHS.main
  }
  return rawRedirect
}

const submitForm = async () => {
  if (submitting.value) return
  const isValid = await validateForm(formRef, { errorMessage: '请检查密码输入' })
  if (!isValid) return

  submitting.value = true
  try {
    await changePasswordApi({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword
    })
    await fetchAuth({ force: true })
    showSuccess('密码修改成功')
    await router.replace(getRedirectTarget())
  } catch (error) {
    showError(getErrorMessage(error, '密码修改失败，请稍后重试'))
  } finally {
    submitting.value = false
  }
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await logoutApi()
    resetAuth()
    await router.replace(ROUTE_PATHS.login)
  } catch (error) {
    showError(getErrorMessage(error, '退出登录失败，请稍后重试'))
  } finally {
    loggingOut.value = false
  }
}
</script>

<style scoped>
.password-change-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow: auto;
  background:
    radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--el-color-primary) 12%, transparent), transparent 34%),
    var(--app-frame-background);
}

.password-change-card {
  width: min(560px, 100%);
  padding: 34px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: 22px;
  background: var(--app-container-background);
  box-shadow: var(--app-shell-shadow-strong);
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.brand-mark {
  width: 54px;
  height: 54px;
  flex: 0 0 54px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
}

.brand-mark img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.page-kicker {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.page-header h1 {
  margin: 7px 0 9px;
  color: var(--el-text-color-primary);
  font-size: 27px;
  line-height: 1.2;
}

.page-header p {
  margin: 0;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 24px 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 28%, transparent);
  border-radius: 12px;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-color-warning) 9%, var(--app-control-background));
  font-size: 13px;
  line-height: 1.6;
}

.security-note .el-icon {
  flex-shrink: 0;
  color: var(--el-color-warning);
  font-size: 18px;
}

.password-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.password-form :deep(.el-form-item__label) {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.submit-button {
  width: 100%;
  margin-top: 2px;
}

.page-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--app-divider-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 640px) {
  .password-change-page {
    place-items: start center;
    padding: 14px;
  }

  .password-change-card {
    padding: 24px 20px;
    border-radius: 18px;
  }

  .page-header h1 {
    font-size: 23px;
  }

  .page-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
