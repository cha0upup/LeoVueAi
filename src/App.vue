<template>
  <div
    id="app"
    :class="{ 'app-shell': showAppHeader }"
  >
    <GlobalAppHeader
      v-if="showAppHeader"
      :key="sessionGeneration"
    />
    <StartupCheckView
      v-if="authLoading && !authFetched && route.path !== ROUTE_PATHS.startup"
    />
    <router-view
      v-else
      v-slot="{ Component }"
    >
      <KeepAlive
        v-if="currentUser && route.meta.requiresAuth"
        :key="sessionGeneration"
        include="MainView"
      >
        <component
          :is="Component"
          :class="{ 'app-shell__view': showAppHeader }"
        />
      </KeepAlive>
      <component
        :is="Component"
        v-else-if="!route.meta.requiresAuth"
      />
    </router-view>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import GlobalAppHeader from '@/components/common/GlobalAppHeader.vue'
import StartupCheckView from '@/views/StartupCheckView.vue'
import { ROUTE_PATHS } from '@/constants/app.js'
import { useTheme } from '@/stores/theme'
import { sessionGeneration } from '@/services/sessionLifecycle.js'
import { useAuth } from '@/composables/useAuth.js'

const { initTheme } = useTheme()
const { currentUser, authLoading, authFetched } = useAuth()
const route = useRoute()

const showAppHeader = computed(() =>
  currentUser.value && route.meta.requiresAuth &&
  route.meta.showAppHeader !== false &&
  route.path !== ROUTE_PATHS.login
)

onMounted(() => {
  // 初始化主题
  initTheme()
})
</script>

<style>
body,
html,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: var(--app-frame-background, var(--el-bg-color-page));
  color: var(--el-text-color-primary);
  transition:
    background 0.25s ease,
    color 0.25s ease;
}

html,
body {
  overflow: hidden;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.app-shell__view {
  flex: 1;
  min-height: 0;
}
</style>
