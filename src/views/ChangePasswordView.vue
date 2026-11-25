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
          <span class="page-kicker">账号安全设置</span>
          <h1>{{ confirmed ? '确认登录状态' : '请先更新密码' }}</h1>
          <p v-if="!confirmed">
            账户创建或密码被管理员重置后，请设置自己的密码，再进入 Leo 控制台。
          </p>
        </div>
      </header>

      <div
        v-if="!confirmed"
        class="security-note"
      >
        <el-icon><Icon :icon="iconMap.shield" /></el-icon>
        <span>
          新密码长度为 {{ passwordMinLength }}–{{ passwordMaxLength }}
          个字符，并需满足服务端安全策略。
        </span>
      </div>

      <el-form
        v-if="!confirmed"
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="submitting || loggingOut"
        label-position="top"
        class="password-form"
        @submit.prevent="submitForm"
        @keyup.enter="submitForm"
      >
        <el-form-item
          label="当前密码"
          prop="oldPassword"
        >
          <el-input
            v-model="form.oldPassword"
            type="password"
            placeholder="请输入当前密码"
            :maxlength="passwordMaxLength"
            autocomplete="current-password"
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
            :maxlength="passwordMaxLength"
            autocomplete="new-password"
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
            :maxlength="passwordMaxLength"
            autocomplete="new-password"
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
      <section
        v-else
        class="password-form"
        :aria-busy="checkingStatus"
      >
        <p role="status">
          {{ checkingStatus ? '正在检查登录状态…' : '密码已更新。如未进入控制台，请重新检查登录状态。' }}
        </p>
        <el-button
          type="primary"
          class="submit-button"
          :loading="checkingStatus"
          :disabled="loggingOut"
          @click="continueAfterChange"
        >
          重新检查登录状态
        </el-button>
      </section>

      <footer class="page-footer">
        <span v-if="!confirmed">当前会话仅允许修改密码或退出登录。</span>
        <el-button
          link
          type="primary"
          :disabled="submitting || checkingStatus || loggingOut"
          @click="handleLogout"
        >
          {{ loggingOut ? '正在退出...' : '退出并切换账户' }}
        </el-button>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { onScopeDispose, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { usePasswordChangeForm } from '@/composables/usePasswordChangeForm.js'
import { authPageTarget } from '@/routerGuards.js'
import { logoutApi } from '@/services/api/auth.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'
import { icons as iconMap } from '@/utils/icons.js'
import { showError } from '@/utils/messageUtils.js'

const route = useRoute()
const router = useRouter()
const { resetAuth } = useAuth()

const confirmed = ref(false)
const checkingStatus = ref(false)
const loggingOut = ref(false)
let disposed = false
onScopeDispose(() => { disposed = true })

const { form, formRef, rules, submitting, passwordMinLength, passwordMaxLength, submitForm } = usePasswordChangeForm({
  canSubmit: () => !confirmed.value && !loggingOut.value,
  onSaved: () => {
    confirmed.value = true
    return continueAfterChange()
  }
})

async function continueAfterChange() {
  if (disposed || !confirmed.value || checkingStatus.value || loggingOut.value) return
  checkingStatus.value = true
  try {
    await router.replace(authPageTarget(ROUTE_PATHS.startup, route.query.redirect))
  } catch {
    if (!disposed) showError('登录状态暂未确认，请重新检查')
  } finally {
    checkingStatus.value = false
  }
}

const handleLogout = async () => {
  if (disposed || loggingOut.value || submitting.value || checkingStatus.value) return
  const generation = sessionGeneration.value
  loggingOut.value = true
  try {
    await logoutApi()
    if (disposed || !isCurrentSession(generation)) return
    resetAuth()
    await router.replace(ROUTE_PATHS.login)
  } catch (error) {
    if (!disposed && isCurrentSession(generation)) {
      showError(error?.response?.data?.msg || error?.message || '退出登录失败，请稍后重试')
    }
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
