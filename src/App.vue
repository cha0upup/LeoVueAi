<template>
  <div
    id="app"
    :class="{ 'app-shell': showAppHeader }"
  >
    <GlobalAppHeader v-if="showAppHeader" />
    <router-view v-slot="{ Component }">
      <KeepAlive include="MainView">
        <component
          :is="Component"
          :class="{ 'app-shell__view': showAppHeader }"
        />
      </KeepAlive>
    </router-view>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import GlobalAppHeader from '@/components/common/GlobalAppHeader.vue'
import { ROUTE_PATHS } from '@/constants/app.js'
import { useTheme } from '@/stores/theme'

const { initTheme } = useTheme()
const route = useRoute()

const showAppHeader = computed(() =>
  route.meta.requiresAuth &&
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
