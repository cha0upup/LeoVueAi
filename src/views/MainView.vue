<template>
  <div class="main-container">
    <el-container
      class="main-layout"
      direction="vertical"
    >
      <el-main
        class="main-content"
        :class="{ 'is-puppet-console': currentTab !== HOME_TAB_ID }"
      >
        <div class="content-wrapper">
          <div
            v-if="currentTab === HOME_TAB_ID"
            class="content-page"
          >
            <Home @add-puppet-entity="openPuppetEntity" />
          </div>

          <div
            v-for="tab in tabs"
            v-show="currentTab === tab.id && tab.id !== HOME_TAB_ID"
            :key="tab.id"
            class="content-page"
          >
            <PuppetEntity
              v-if="tab.isLoaded"
              :conn-link="tab.connLink"
              :session-id="tab.sessionId"
              :puppet-name="tab.title"
              :cache-mode="tab.cacheMode"
              :capabilities="tab.capabilities || []"
              :initial-prompt="tab.initialPrompt || ''"
            />
            <div
              v-else
              class="loading-placeholder"
            >
              <el-skeleton
                :rows="10"
                animated
              />
              <div class="loading-text">
                <el-icon class="loading-icon">
                  <Icon :icon="iconMap.loading" />
                </el-icon>
                <span>正在加载主机控制台...</span>
              </div>
            </div>
          </div>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { defineAsyncComponent, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { useMainTabs } from '@/composables/useMainTabs.js'
import { showWarning } from '@/utils/messageUtils.js'

defineOptions({
  name: 'MainView'
})

const Home = defineAsyncComponent(() => import('@/components/Home.vue'))
const PuppetEntity = defineAsyncComponent(
  () => import('@/components/PuppetConsole/PuppetEntity.vue')
)
const iconMap = icons
const route = useRoute()
const router = useRouter()

const {
  HOME_TAB_ID,
  currentTab,
  tabs,
  addPuppetEntity,
  getTabRoute,
  goToHome,
  switchTabByKey
} = useMainTabs({
  confirmAction,
  iconMap
})

const readRouteTabKey = () => {
  const rawTabKey = route.params.tabKey
  return Array.isArray(rawTabKey) ? rawTabKey[0] : rawTabKey
}

const openPuppetEntity = (puppetEntityParams) => {
  const tab = addPuppetEntity(puppetEntityParams)
  const targetRoute = getTabRoute(tab)

  if (route.fullPath !== targetRoute) {
    router.push(targetRoute)
  }
}

const syncTabFromRoute = () => {
  if (route.name === ROUTE_NAMES.mainPuppet) {
    const tabKey = readRouteTabKey()
    const tab = tabKey ? switchTabByKey(tabKey) : null

    if (!tab) {
      goToHome()
      showWarning('主机控制台会话已失效')
      router.replace(ROUTE_PATHS.main)
    }
    return
  }

  if (route.name === ROUTE_NAMES.main) {
    goToHome()
  }
}

watch(
  () => [route.name, route.params.tabKey],
  syncTabFromRoute,
  { immediate: true }
)
</script>

<style scoped>
.main-container {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--app-frame-background);
}

.main-layout {
  height: 100%;
  background: transparent;
}

.main-content {
  padding: 8px 0 var(--app-page-padding);
  background: transparent;
  overflow: hidden;
}

.main-content.is-puppet-console {
  padding: 0;
}

.content-wrapper {
  height: 100%;
  overflow: hidden;
  padding: 0;
}

.content-page {
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-placeholder {
  padding: 28px;
  text-align: center;
  background: color-mix(in srgb, var(--app-surface-background) 94%, var(--el-bg-color-overlay));
  border-radius: var(--app-panel-radius);
  border: 1px solid var(--app-surface-border-subtle);
  box-shadow: var(--app-shell-shadow-soft);
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.loading-icon {
  font-size: 16px;
  color: var(--el-color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .main-content {
    padding-left: 0;
    padding-right: 0;
  }
}

@media (max-width: 640px) {
  .loading-placeholder {
    padding: 18px;
    border-radius: 24px;
  }
}
</style>
