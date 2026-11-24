<template>
  <main class="startup-page">
    <section
      class="startup-card"
      :aria-busy="checking"
    >
      <img
        src="/leo-logo.png"
        alt="LEO"
      >
      <div role="status">
        <h1>{{ checking ? '正在检查系统状态' : '系统状态检查未完成' }}</h1>
        <p v-if="retryScheduled">
          服务正在准备，稍后将自动重新检查。
        </p>
        <p v-else>
          检查成功后将继续进入初始化或登录页面。
        </p>
        <p
          v-if="navigationError || authError"
          class="startup-error"
        >
          {{ navigationError || authError }}
        </p>
      </div>
      <el-button
        v-if="isStartupPage"
        type="primary"
        :loading="checking"
        @click="retryNow"
      >
        {{ checking ? '正在检查...' : '重新检查' }}
      </el-button>
    </section>
  </main>
</template>

<script setup>
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { resolveAuthNavigation } from '@/routerGuards.js'

const MAX_AUTO_RETRIES = 3
const route = useRoute()
const router = useRouter()
const { currentUser, authLoading, authFetched, authCheckState, authError, initializationRequired,
  startupRetryDelay, fetchAuth } = useAuth()
const isStartupPage = computed(() => route.path === ROUTE_PATHS.startup)
const retrying = ref(false)
const checking = computed(() => authLoading.value || retrying.value)
const retryScheduled = ref(false)
const navigationError = ref('')
let timer
let attempts = 0
let disposed = false

function cancelScheduledRetry() {
  clearTimeout(timer)
  timer = undefined
  retryScheduled.value = false
}

async function runCheck() {
  if (disposed || !isStartupPage.value || checking.value) return
  cancelScheduledRetry()
  retrying.value = true
  navigationError.value = ''
  try {
    await fetchAuth({ force: true })
    if (disposed || !isStartupPage.value || !authFetched.value) return
    const target = resolveAuthNavigation(route, currentUser.value, initializationRequired.value, authCheckState.value)
    if (target) await router.replace(target)
  } catch {
    if (!disposed) navigationError.value = '进入下一页面失败，请重新检查'
  } finally {
    retrying.value = false
  }
}

function retryNow() {
  if (checking.value) return
  attempts = 0
  return runCheck()
}

watch([isStartupPage, checking, startupRetryDelay, authCheckState], ([active, pending, delay, state]) => {
  cancelScheduledRetry()
  if (!active || pending || state !== 'error' || delay == null || attempts >= MAX_AUTO_RETRIES) return
  retryScheduled.value = true
  timer = setTimeout(() => {
    attempts += 1
    void runCheck()
  }, delay)
}, { immediate: true })

onScopeDispose(() => {
  disposed = true
  cancelScheduledRetry()
})
</script>

<style scoped>
.startup-page { height: 100%; display: grid; place-items: center; padding: 24px; overflow-y: auto; }
.startup-card { width: min(100%, 480px); padding: 32px; border: 1px solid var(--el-border-color-light); border-radius: 20px; background: var(--el-bg-color); }
.startup-card img { width: 48px; height: 48px; }
.startup-card h1 { font-size: 24px; margin: 20px 0 12px; }
.startup-card p { font-size: 14px; line-height: 1.8; color: var(--el-text-color-secondary); }
.startup-card .startup-error { color: var(--el-color-danger); overflow-wrap: anywhere; }
.startup-card :deep(.el-button) { margin-top: 12px; }
</style>
