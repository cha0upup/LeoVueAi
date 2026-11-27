<template>
  <main class="setup-page">
    <section class="setup-card">
      <header class="setup-header">
        <img
          src="/leo-logo.png"
          alt="LEO"
          class="setup-logo"
        >
        <span class="setup-kicker">首次部署 · 初始化</span>
        <h1>{{ confirmation ? '确认初始化状态' : '设置管理员密码' }}</h1>
        <p v-if="!confirmation">
          欢迎使用 Leo Console。完成设置后，即可使用 admin 登录管理台。
        </p>
      </header>

      <el-form
        v-if="!confirmation"
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submitForm"
      >
        <el-form-item label="管理员账号">
          <el-input
            model-value="admin"
            disabled
            size="large"
          />
        </el-form-item>
        <el-form-item
          label="管理员密码"
          prop="password"
        >
          <el-input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            placeholder="请输入管理员密码"
            :maxlength="passwordMaxLength"
            :disabled="submitting"
            size="large"
            show-password
            autofocus
          />
        </el-form-item>
        <el-form-item
          label="确认密码"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="请再次输入管理员密码"
            :maxlength="passwordMaxLength"
            :disabled="submitting"
            size="large"
            show-password
          />
        </el-form-item>
        <p class="setup-policy">
          密码长度 {{ passwordMinLength }}–{{ passwordMaxLength }} 个字符，请使用本次部署独有的口令。
        </p>
        <el-button
          type="primary"
          native-type="submit"
          size="large"
          class="setup-submit"
          :loading="submitting"
        >
          {{ submitting ? '正在初始化...' : '完成初始化' }}
        </el-button>
      </el-form>
      <section
        v-else
        :aria-busy="submitting"
      >
        <p
          class="setup-policy"
          role="status"
        >
          {{ submitting ? '正在读取服务端状态…' : '初始化结果待确认，请重新检查状态。' }}
        </p>
        <el-button
          type="primary"
          class="setup-submit"
          :loading="submitting"
          @click="submitForm"
        >
          重新检查状态
        </el-button>
      </section>
      <footer class="setup-footer">
        此页面仅在首次部署时开放。完成后设置入口自动关闭，已有账号的密码保持不变。
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, onScopeDispose, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { initializeSystemApi } from '@/services/api/auth.js'
import { authPageTarget } from '@/routerGuards.js'
import { createPasswordMatchValidator, createPasswordRules, validateForm } from '@/utils/formUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const router = useRouter()
const route = useRoute()
const { fetchAuth, authFetched, initializationRequired, passwordMinLength, passwordMaxLength } = useAuth()
const formRef = ref(null)
const submitting = ref(false)
const confirmation = ref('')
const form = reactive({ password: '', confirmPassword: '' })
let disposed = false
const rules = computed(() => ({
  password: createPasswordRules('请输入管理员密码', { min: passwordMinLength.value, max: passwordMaxLength.value }),
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: createPasswordMatchValidator(() => form.password), trigger: 'blur' }
  ]
}))

const clearPasswords = () => Object.assign(form, { password: '', confirmPassword: '' })

onScopeDispose(() => {
  disposed = true
  clearPasswords()
})

async function verifySetupStatus() {
  await fetchAuth({ force: true })
  if (disposed) return

  if (!authFetched.value || !initializationRequired.value) {
    clearPasswords()
    const destination = authFetched.value ? ROUTE_PATHS.login : ROUTE_PATHS.startup
    await router.replace(authPageTarget(destination, route.query.redirect))
  } else if (confirmation.value === 'uncertain') {
    // A transport failure has no definite write result. Only a fresh status may reopen the form.
    confirmation.value = ''
    showError('系统仍待初始化，请重试提交')
  }
}

const submitForm = async () => {
  if (submitting.value || disposed) return
  submitting.value = true
  try {
    if (!confirmation.value) {
      if (!await validateForm(formRef, { errorMessage: '请检查密码输入' }) || disposed) return
      let outcome = 'accepted'
      try {
        await initializeSystemApi({ password: form.password, confirmPassword: form.confirmPassword })
        if (disposed) return
        showSuccess('初始化完成，请使用 admin 登录')
      } catch (error) {
        if (disposed) return
        const status = error?.response?.status
        if (status !== 409) {
          if (status && status < 500 && status !== 408) {
            showError(error?.response?.data?.msg || error?.message || '初始化失败，请稍后重试')
            return
          }
          outcome = 'uncertain'
        }
      }
      confirmation.value = outcome
      if (outcome === 'accepted') clearPasswords()
    }
    await verifySetupStatus()
  } catch {
    if (!disposed) showError('初始化后的状态确认失败，请重新检查状态')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.setup-page {
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  display: grid;
  place-items: center;
  padding: 32px 20px;
  background: radial-gradient(ellipse at top, color-mix(in srgb, var(--el-color-primary) 12%, transparent), transparent 65%);
}

.setup-card {
  width: min(100%, 480px);
  padding: 36px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 24px;
  background: var(--app-dialog-background, var(--el-bg-color));
  box-shadow: var(--app-shell-shadow-strong);
}

.setup-header { margin-bottom: 26px; }
.setup-logo { display: block; width: 48px; height: 48px; margin-bottom: 18px; }
.setup-kicker { color: var(--el-color-primary); font-size: 13px; font-weight: 600; }
.setup-header h1 { margin: 10px 0; font-size: 28px; }
.setup-header p, .setup-policy, .setup-footer { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.setup-submit { width: 100%; margin-top: 8px; }
.setup-footer { border-top: 1px solid var(--el-border-color-lighter); margin-top: 24px; padding-top: 18px; }

@media (max-width: 480px) {
  .setup-card { padding: 24px; }
}
</style>
