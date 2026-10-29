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
        <h1>设置管理员密码</h1>
        <p>欢迎使用 Leo Console。完成设置后，即可使用 admin 登录管理台。</p>
      </header>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submitForm"
        @keyup.enter="submitForm"
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
          size="large"
          class="setup-submit"
          :loading="submitting"
          @click="submitForm"
        >
          {{ submitting ? '正在初始化...' : '完成初始化' }}
        </el-button>
      </el-form>
      <footer class="setup-footer">
        此页面仅在首次部署时开放。完成后设置入口自动关闭，已有账号的密码保持不变。
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { initializeSystemApi } from '@/services/api/auth.js'
import { createPasswordMatchValidator, validateForm } from '@/utils/formUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

const router = useRouter()
const { fetchAuth, initializationRequired, passwordMinLength, passwordMaxLength } = useAuth()
const formRef = ref(null)
const submitting = ref(false)
const form = reactive({ password: '', confirmPassword: '' })
const rules = computed(() => ({
  password: [
    { required: true, message: '请输入管理员密码', trigger: 'blur' },
    {
      min: passwordMinLength.value,
      max: passwordMaxLength.value,
      message: `密码长度在 ${passwordMinLength.value} 到 ${passwordMaxLength.value} 个字符`,
      trigger: 'blur'
    }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: createPasswordMatchValidator(() => form.password), trigger: 'blur' }
  ]
}))

const submitForm = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    if (!await validateForm(formRef, { errorMessage: '请检查密码输入' })) return
    await initializeSystemApi({ password: form.password, confirmPassword: form.confirmPassword })
    form.password = ''
    form.confirmPassword = ''
    await fetchAuth({ force: true })
    showSuccess('初始化完成，请使用 admin 登录')
    await router.replace(ROUTE_PATHS.login)
  } catch (error) {
    showError(error?.response?.data?.msg || error?.message || '初始化失败，请稍后重试')
    if (error?.response?.status === 409) {
      await fetchAuth({ force: true })
      if (!initializationRequired.value) await router.replace(ROUTE_PATHS.login)
    }
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
