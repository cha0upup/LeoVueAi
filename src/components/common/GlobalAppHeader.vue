<template>
  <AppHeader
    title="Leo"
    subtitle="控制台"
    :username="username"
    :user-role-label="userRoleLabel"
    :menu-items="userMenuItems"
    @command="handleCommand"
  >
    <template #center>
      <div class="global-header-nav">
        <nav
          class="platform-switcher"
          aria-label="平台空间切换"
        >
          <button
            type="button"
            class="platform-switcher__item"
            :class="{ 'is-active': activeKey === HOME_TAB_ID }"
            data-tab="workspace"
            :aria-current="activeKey === HOME_TAB_ID ? 'page' : undefined"
            @click="openWorkspace"
          >
            <el-icon class="platform-switcher__icon">
              <Icon :icon="iconMap.homeFilled" />
            </el-icon>
            <span>主工作台</span>
          </button>

          <button
            v-if="isAdmin || isLeader"
            type="button"
            class="platform-switcher__item"
            :class="{ 'is-active': activeKey === ADMIN_TAB_ID }"
            data-tab="admin"
            :aria-current="activeKey === ADMIN_TAB_ID ? 'page' : undefined"
            @click="openAdmin"
          >
            <el-icon class="platform-switcher__icon">
              <Icon :icon="iconMap.shield" />
            </el-icon>
            <span>管理后台</span>
          </button>
        </nav>

        <span
          v-if="openedTabs.length"
          class="global-header-divider"
          aria-hidden="true"
        />

        <nav
          v-if="openedTabs.length"
          class="puppet-tab-strip"
          aria-label="Puppet 控制台"
        >
          <button
            v-for="(tab, index) in openedTabs"
            :key="tab.id"
            type="button"
            class="puppet-tab"
            :class="{
              'is-active': activeKey === tab.id,
              'is-loading': tab.sessionId && !tab.isLoaded
            }"
            :data-tab="tab.id"
            :aria-current="activeKey === tab.id ? 'page' : undefined"
            @click="openPuppetTab(tab.id)"
          >
            <el-icon class="puppet-tab__icon">
              <Icon :icon="tab.icon || iconMap.server" />
            </el-icon>
            <span class="puppet-tab__text">{{ tab.title }}</span>
            <el-icon
              v-if="tab.sessionId && !tab.isLoaded"
              class="puppet-tab__loading"
            >
              <Icon :icon="iconMap.loading" />
            </el-icon>
            <el-icon
              class="puppet-tab__close"
              @click.stop="handleClosePuppetTab(tab.id, index)"
            >
              <Icon :icon="iconMap.close" />
            </el-icon>
          </button>
        </nav>
      </div>
    </template>

    <template #tools>
      <PlatformAiEntry />
    </template>
  </AppHeader>

  <ProfileDialog ref="profileDialog" />
  <ChangePasswordDialog ref="changePasswordDialog" />
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/common/AppHeader.vue'
import ChangePasswordDialog from '@/components/common/ChangePasswordDialog.vue'
import ProfileDialog from '@/components/common/ProfileDialog.vue'
import PlatformAiEntry from '@/components/common/PlatformAiEntry.vue'
import { MAIN_HOME_TAB_ID, ROUTE_PATHS } from '@/constants/app.js'
import { useAppModeNavigation } from '@/composables/useAppModeNavigation.js'
import { useAuth } from '@/composables/useAuth.js'
import { useMainTabs } from '@/composables/useMainTabs.js'
import { useUserMenuActions } from '@/composables/useUserMenuActions.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'

const ADMIN_TAB_ID = 'ADMIN'
const HOME_TAB_ID = MAIN_HOME_TAB_ID
const iconMap = icons
const router = useRouter()
const route = useRoute()
const changePasswordDialog = ref(null)
const profileDialog = ref(null)

const { isAdmin, isLeader } = useAuth()
const { goToAdmin, rememberAdminRoute, rememberWorkspaceRoute } = useAppModeNavigation()
const { currentTab, tabs, closeTab, getTabRoute, goToHome, switchTab } = useMainTabs({
  confirmAction,
  iconMap
})
const { handleCommand, userMenuItems, username, userRoleLabel } = useUserMenuActions({
  profileDialog,
  changePasswordDialog,
  router
})

const openedTabs = computed(() => tabs.value.filter((tab) => tab.id !== HOME_TAB_ID))
const isWorkspacePath = (path) =>
  path === ROUTE_PATHS.main || path.startsWith(`${ROUTE_PATHS.main}/`)
const activeKey = computed(() => {
  if (route.path === ROUTE_PATHS.admin) return ADMIN_TAB_ID
  if (isWorkspacePath(route.path)) return currentTab.value
  return ''
})

const openWorkspace = () => {
  if (route.path === ROUTE_PATHS.admin) {
    rememberAdminRoute()
  }
  goToHome()
  if (route.path !== ROUTE_PATHS.main) {
    router.push(ROUTE_PATHS.main)
  }
}

const openAdmin = () => {
  if (isWorkspacePath(route.path)) {
    rememberWorkspaceRoute()
  }
  goToAdmin()
}

const openPuppetTab = (tabId) => {
  if (route.path === ROUTE_PATHS.admin) {
    rememberAdminRoute()
  }
  const tab = switchTab(tabId)
  if (!tab) {
    return
  }

  const targetRoute = getTabRoute(tab)
  if (route.fullPath !== targetRoute) {
    router.push(targetRoute)
  }
}

const handleClosePuppetTab = async (tabId, index) => {
  const wasActiveWorkspaceTab = isWorkspacePath(route.path) && currentTab.value === tabId
  const result = await closeTab(tabId, index)

  if (!result?.closed) {
    return
  }

  const nextRoute = getTabRoute(result.nextTab)

  if (route.path === ROUTE_PATHS.admin) {
    rememberWorkspaceRoute(nextRoute)
    return
  }

  if (wasActiveWorkspaceTab && route.fullPath !== nextRoute) {
    router.replace(nextRoute)
  }
}
</script>

<style scoped>
.global-header-nav {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.platform-switcher {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: var(--control-height);
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--app-control-radius);
  background: color-mix(in srgb, var(--app-control-background-soft) 88%, transparent);
}

.platform-switcher__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 86px;
  height: var(--control-height-sm);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: calc(var(--app-control-radius) - 2px);
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.platform-switcher__item:hover {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}

.platform-switcher__item.is-active {
  color: var(--el-color-primary);
  background: var(--el-bg-color-overlay);
  box-shadow: none;
}

.platform-switcher__icon {
  font-size: 15px;
  flex-shrink: 0;
}

.global-header-divider {
  width: 1px;
  height: 24px;
  flex-shrink: 0;
  background: var(--app-surface-border-subtle);
}

.puppet-tab-strip {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0 5px;
}

.puppet-tab-strip::-webkit-scrollbar {
  height: 4px;
}

.puppet-tab-strip::-webkit-scrollbar-track {
  background: transparent;
}

.puppet-tab-strip::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 999px;
}

.puppet-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 104px;
  max-width: 210px;
  height: 30px;
  padding: 0 8px 0 10px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 42%, transparent);
  border-radius: var(--radius-control);
  border-bottom-color: color-mix(in srgb, var(--el-border-color) 42%, transparent);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.puppet-tab::after {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
  content: '';
}

.puppet-tab:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--el-fill-color-light));
  color: var(--el-text-color-primary);
}

.puppet-tab.is-active {
  border-color: color-mix(in srgb, var(--el-color-primary) 34%, var(--el-border-color));
  border-bottom-color: color-mix(in srgb, var(--el-color-primary) 34%, var(--el-border-color));
  background: var(--app-selected-background);
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: none;
}

.puppet-tab.is-active::after {
  background: var(--el-color-primary);
}

.puppet-tab.is-loading {
  border-color: color-mix(in srgb, var(--el-color-warning) 38%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-warning) 10%, var(--el-bg-color));
  color: var(--el-color-warning);
}

.puppet-tab__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.puppet-tab__text {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.puppet-tab__loading {
  font-size: 12px;
  color: var(--el-color-warning);
  animation: global-spin 1s linear infinite;
}

.puppet-tab__close {
  font-size: 14px;
  opacity: 0.55;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.puppet-tab__close:hover {
  opacity: 1;
  color: var(--el-color-danger);
  transform: scale(1.08);
}

@media (max-width: 760px) {
  .global-header-nav {
    align-items: stretch;
    flex-direction: column;
    gap: 6px;
  }

  .platform-switcher {
    align-self: flex-start;
  }

  .global-header-divider {
    display: none;
  }

  .puppet-tab-strip {
    width: 100%;
    padding-top: 0;
  }
}

@keyframes global-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
