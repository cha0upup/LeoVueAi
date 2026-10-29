<template>
  <main class="startup-page">
    <section
      class="startup-card"
      role="status"
    >
      <img
        src="/leo-logo.png"
        alt="LEO"
      >
      <h1>{{ authLoading ? '正在检查系统状态' : '系统状态检查未完成' }}</h1>
      <p>服务可能正在启动，或暂时连接异常。检查成功后将继续进入初始化或登录页面。</p>
      <p
        v-if="authError"
        class="startup-error"
      >
        {{ authError }}
      </p>
      <el-button
        type="primary"
        :loading="authLoading"
        @click="retry"
      >
        {{ authLoading ? '正在检查...' : '重新检查' }}
      </el-button>
    </section>
  </main>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'
import { resolveAuthNavigation } from '@/routerGuards.js'

const route = useRoute()
const router = useRouter()
const { currentUser, authLoading, authFetched, authCheckState, authError, initializationRequired, fetchAuth } = useAuth()

const retry = async () => {
  if (authLoading.value) return
  await fetchAuth({ force: true })
  if (!authFetched.value) return
  const target = resolveAuthNavigation(route, currentUser.value, initializationRequired.value, authCheckState.value)
  if (target) await router.replace(target)
}
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
