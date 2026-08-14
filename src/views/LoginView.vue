<template>
  <div class="login-container">
    <div class="login-shell">
      <section class="login-hero">
        <div class="hero-brand">
          <span class="brand-mark">
            <img
              src="/leo-logo.png"
              alt="LEO"
              class="logo-icon"
            >
          </span>
          <div class="brand-copy">
            <span class="brand-kicker">Leo Console</span>
            <h1 class="app-title">
              远程主机管理控制台
            </h1>
            <p class="app-subtitle">
              统一入口管理主机、会话、AI 助手与扩展插件。
            </p>
          </div>
        </div>
      </section>

      <section class="login-panel">
        <div class="login-card">
          <div class="login-header">
            <div class="header-copy">
              <span class="form-kicker">账户登录</span>
              <h2>进入管理台</h2>
              <p>输入你的账号和密码，继续进入当前工作区。</p>
            </div>
            <el-tag
              effect="light"
              type="primary"
              class="version-tag"
            >
              v2.0.2
            </el-tag>
          </div>

          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="rules"
            class="login-form"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="请输入用户名"
                :maxlength="AUTH_FIELD_LIMITS.usernameMaxLength"
                size="large"
                clearable
                class="login-input"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.user" /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                placeholder="请输入密码"
                type="password"
                :maxlength="AUTH_FIELD_LIMITS.passwordMaxLength"
                size="large"
                clearable
                show-password
                class="login-input"
              >
                <template #prefix>
                  <el-icon><Icon :icon="iconMap.lock" /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                class="login-button"
                @click="handleLogin"
              >
                {{ loading ? '登录中...' : '登录进入工作台' }}
              </el-button>
            </el-form-item>
          </el-form>

          <div class="login-footer">
            <div class="footer-tip">
              <span class="tip-dot" />
              <span>登录成功后将自动恢复到主控制台。</span>
            </div>
            <p class="version-info">
              LeoVue Console
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  AUTH_FIELD_LIMITS,
  LOAD_DELAYS,
  MAIN_TAB_STORAGE_KEYS,
  ROUTE_PATHS
} from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { validateForm } from '@/utils/formUtils.js'
import { loginApi } from '@/services/api.js'
import { useAuth } from '@/composables/useAuth.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

// ==================== 常量 ====================
const iconMap = icons

// ==================== 组件引用 ====================
const loginFormRef = ref(null)
const router = useRouter()
const route = useRoute()
const { fetchAuth } = useAuth()

// ==================== 响应式数据 ====================
const loading = ref(false)
const loginForm = reactive({
  username: '',
  password: ''
})

// ==================== 表单验证规则 ====================
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      max: AUTH_FIELD_LIMITS.usernameMaxLength,
      message: `用户名不能超过 ${AUTH_FIELD_LIMITS.usernameMaxLength} 个字符`,
      trigger: 'blur'
    }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      max: AUTH_FIELD_LIMITS.passwordMaxLength,
      message: `密码不能超过 ${AUTH_FIELD_LIMITS.passwordMaxLength} 个字符`,
      trigger: 'blur'
    }
  ]
}

// ==================== 方法 ====================
/**
 * 获取错误消息
 * @param {Error} error - 错误对象
 * @returns {string} 错误消息
 */
const getErrorMessage = (error) => {
  if (error.response?.data?.msg) {
    return error.response.data.msg
  }
  if (error.message) {
    return error.message
  }
  return '网络错误，请稍后重试'
}

/**
 * 清除浏览器保持的tab缓存
 */
const clearTabCache = () => {
  safeLocalStorage.removeItem(MAIN_TAB_STORAGE_KEYS.tabs)
  safeLocalStorage.removeItem(MAIN_TAB_STORAGE_KEYS.currentTab)
}

const getLoginRedirectTarget = (user) => {
  const rawRedirect = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect

  if (!rawRedirect || !rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) {
    return ROUTE_PATHS.main
  }

  if (rawRedirect.startsWith(ROUTE_PATHS.login)) {
    return ROUTE_PATHS.main
  }

  if (rawRedirect.startsWith(ROUTE_PATHS.admin) && !['admin', 'leader'].includes(user?.privilege)) {
    return ROUTE_PATHS.main
  }

  return rawRedirect
}

/**
 * 处理登录
 */
const handleLogin = async () => {
  const isValid = await validateForm(loginFormRef, {
    errorMessage: '表单验证失败，请检查输入'
  })
  if (!isValid) return

  loading.value = true

  try {
    await loginApi({
      username: loginForm.username,
      password: loginForm.password
    })
    const user = await fetchAuth({ force: true })

    // 清除tab缓存
    clearTabCache()

    showSuccess('登录成功')

    setTimeout(() => {
      router.push(getLoginRedirectTarget(user))
    }, LOAD_DELAYS.loginRedirect)
  } catch (error) {
    showError(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: linear-gradient(
    180deg,
    var(--app-frame-background),
    color-mix(in srgb, var(--app-frame-background) 88%, var(--el-bg-color-overlay))
  );
  position: relative;
  overflow: hidden;
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  opacity: 0.8;
}

.login-shell {
  position: relative;
  z-index: 1;
  width: min(1180px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(380px, 420px);
  gap: 24px;
  align-items: stretch;
}

.login-hero {
  min-height: 680px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 36px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--el-color-primary) 92%, #0f1116),
    color-mix(in srgb, var(--el-color-primary-dark-2) 78%, #10151d)
  );
  box-shadow: var(--app-shell-shadow-strong);
  animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-brand {
  max-width: 560px;
}

.brand-mark {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  border-radius: 22px;
  background: color-mix(in srgb, var(--el-color-white) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-white) 16%, transparent);
  backdrop-filter: blur(10px);
}

.logo-icon {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.brand-copy {
  color: #f6f8fc;
}

.brand-kicker {
  display: inline-block;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.app-title {
  margin: 0 0 16px;
  font-size: clamp(34px, 4vw, 52px);
  line-height: 1.08;
  font-weight: 700;
  color: #ffffff;
}

.app-subtitle {
  max-width: 520px;
  color: rgba(240, 244, 255, 0.8);
  font-size: 16px;
  line-height: 1.8;
  margin: 0;
}

.login-panel {
  display: flex;
  align-items: center;
}

.login-card {
  width: 100%;
  padding: 32px;
  border-radius: 32px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
  background: color-mix(in srgb, var(--app-dialog-background) 92%, var(--el-color-primary) 8%);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--app-shell-shadow-strong);
  animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 30px;
}

.login-header :deep(.version-tag) {
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
  color: var(--el-text-color-regular);
}

.header-copy h2 {
  margin: 8px 0 10px;
  font-size: 30px;
  line-height: 1.15;
  color: var(--el-text-color-primary);
}

.header-copy p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.form-kicker {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.login-form {
  margin-bottom: 20px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-input :deep(.el-input__wrapper) {
  min-height: 54px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
  transition: all 0.2s ease;
  background: var(--app-control-background);
  box-shadow: var(--app-shell-shadow-soft);
  padding: 0 16px;
}

.login-input :deep(.el-input__wrapper:hover) {
  border-color: color-mix(in srgb, var(--el-color-primary-light-5) 46%, transparent);
  box-shadow: var(--app-card-shadow-hover);
}

.login-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.login-input :deep(.el-input__inner) {
  height: 52px;
  font-size: 15px;
}

.login-input :deep(.el-input__prefix-inner) {
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.login-button {
  width: 100%;
  height: 54px;
  border-radius: 18px;
  font-size: 15px;
  font-weight: 600;
  background: var(--app-primary-strong-surface);
  border: none;
  transition: all 0.2s ease;
  box-shadow: var(--app-primary-shadow);
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--app-card-shadow-active);
  background: var(--app-primary-strong-surface);
}

.login-button:active {
  transform: translateY(0);
  box-shadow: var(--app-shell-shadow-soft);
}

.login-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.footer-tip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.tip-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-success));
  flex-shrink: 0;
}

.version-info {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  margin: 0;
  white-space: nowrap;
}

.login-button.is-loading {
  background: var(--app-primary-strong-surface);
}

.el-form-item.is-error .login-input :deep(.el-input__wrapper) {
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 4px rgba(245, 108, 108, 0.12);
}

@media (max-width: 1080px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-hero {
    min-height: auto;
    padding: 30px;
  }
}

@media (max-width: 768px) {
  .login-container {
    padding: 16px;
  }

  .login-hero,
  .login-card {
    border-radius: 26px;
  }

  .login-header,
  .login-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-copy h2 {
    font-size: 26px;
  }
}

@media (max-width: 480px) {
  .login-hero,
  .login-card {
    padding: 22px;
  }

  .app-title {
    font-size: 30px;
  }
}
</style>
