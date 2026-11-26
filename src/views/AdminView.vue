<template>
  <div class="admin-console">
    <div
      class="admin-body"
      :class="{ 'is-sidebar-collapsed': sidebarCollapsed }"
    >
      <aside class="admin-sidebar">
        <nav class="admin-menu">
          <div class="admin-menu__brand">
            <div class="admin-menu__brand-copy">
              <span>Admin Console</span>
              <strong>管理后台</strong>
            </div>
            <button
              type="button"
              class="admin-menu__collapse"
              :title="sidebarCollapsed ? '展开导航' : '折叠导航'"
              :aria-label="sidebarCollapsed ? '展开导航' : '折叠导航'"
              @click="sidebarCollapsed = !sidebarCollapsed"
            >
              <el-icon>
                <Icon :icon="sidebarCollapsed ? iconMap.arrowRight : iconMap.arrowLeft" />
              </el-icon>
            </button>
          </div>

          <template
            v-for="group in tabGroups"
            :key="group.name"
          >
            <p class="admin-menu__group">
              <span>{{ group.name }}</span>
              <strong>{{ group.label }}</strong>
            </p>
            <button
              v-for="tab in group.tabs"
              :key="tab.name"
              type="button"
              class="admin-menu-item"
              :class="{ 'is-active': activeTab === tab.name }"
              :data-tab="tab.name"
              :title="sidebarCollapsed ? tab.label : ''"
              :aria-label="tab.label"
              :aria-current="activeTab === tab.name ? 'page' : undefined"
              @click="selectTab(tab.name)"
            >
              <el-icon><Icon :icon="tab.icon" /></el-icon>
              <span>{{ tab.label }}</span>
            </button>
          </template>
        </nav>
      </aside>

      <section class="admin-main">
        <main class="admin-panel">
          <section class="admin-panel__body">
            <component :is="activeTabMeta.component" />
          </section>
        </main>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, h, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { adminTabGroups } from '@/components/Admin/adminTabs.js'
import EmptyState from '@/components/common/EmptyState.vue'
import { ROUTE_PATHS } from '@/constants/app.js'
import { icons as iconMap } from '@/utils/icons.js'
import { useAppModeNavigation } from '@/composables/useAppModeNavigation.js'
import { useAuth } from '@/composables/useAuth.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const router = useRouter()
const route = useRoute()

const { currentUser, isAdmin, isLeader, fetchAuth } = useAuth()
const { rememberAdminRoute } = useAppModeNavigation()

const PanelLoading = () => h('p', { class: 'admin-panel-feedback', role: 'status' }, '正在加载管理模块…')
const PanelLoadError = () => h(EmptyState, {
  workbench: true,
  title: '管理模块加载失败',
  description: '请刷新页面后重试。',
  actionLabel: '刷新页面',
  onAction: () => router.go(0)
})
const groups = adminTabGroups.map(({ tabs, ...group }) => ({
  ...group,
  tabs: tabs.map(({ load, ...tab }) => ({
    ...tab,
    component: defineAsyncComponent({ loader: load, loadingComponent: PanelLoading, errorComponent: PanelLoadError })
  }))
}))

const ADMIN_SIDEBAR_COLLAPSED_KEY = 'leovue-admin-sidebar-collapsed'
const sidebarCollapsed = ref(false)

const tabGroups = computed(() => groups.filter((group) => !group.adminOnly || isAdmin.value))
const visibleTabs = computed(() => tabGroups.value.flatMap((group) => group.tabs))

const getQueryTab = (tabName) => Array.isArray(tabName) ? tabName[0] : tabName

const normalizeTabName = (tabName) => {
  const value = getQueryTab(tabName)
  return visibleTabs.value.some((tab) => tab.name === value)
    ? value
    : visibleTabs.value[0]?.name
}
const activeTab = computed(() => normalizeTabName(route.query.tab))
const activeTabMeta = computed(
  () => visibleTabs.value.find((tab) => tab.name === activeTab.value) ?? visibleTabs.value[0]
)

const getAdminTabLocation = (tabName) => {
  const query = { ...route.query, tab: tabName }
  if (tabName !== 'users') delete query.teamId
  return { path: ROUTE_PATHS.admin, query }
}

const syncActiveTabFromRoute = ({ normalizeUrl = false } = {}) => {
  if (route.path !== ROUTE_PATHS.admin) return
  const queryTab = getQueryTab(route.query.tab)
  const nextTab = activeTab.value
  if (!nextTab) return
  if (normalizeUrl && queryTab !== nextTab) {
    const normalizedLocation = getAdminTabLocation(nextTab)
    rememberAdminRoute(router.resolve(normalizedLocation).fullPath)
    router.replace(normalizedLocation)
    return
  }
  rememberAdminRoute(route.fullPath)
}

const selectTab = (tabName) => {
  const nextTab = normalizeTabName(tabName)
  if (!nextTab || getQueryTab(route.query.tab) === nextTab) return
  const nextLocation = getAdminTabLocation(nextTab)
  rememberAdminRoute(router.resolve(nextLocation).fullPath)
  router.push(nextLocation)
}

watch(
  [() => route.fullPath, activeTab],
  () => syncActiveTabFromRoute({ normalizeUrl: true })
)

watch(sidebarCollapsed, (collapsed) => {
  safeLocalStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
})

onMounted(async () => {
  sidebarCollapsed.value = safeLocalStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === '1'
  await fetchAuth()
  if (route.path !== ROUTE_PATHS.admin) return
  if (!currentUser.value) {
    router.replace(ROUTE_PATHS.login)
    return
  }
  if (!isAdmin.value && !isLeader.value) {
    router.replace(ROUTE_PATHS.main)
    return
  }
  syncActiveTabFromRoute({ normalizeUrl: true })
})
</script>

<style scoped>
.admin-console {
  container: admin-workspace / inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

.admin-panel-feedback {
  align-self: center;
  color: var(--el-text-color-secondary);
  margin: var(--space-4);
}

.admin-body {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.admin-body.is-sidebar-collapsed {
  grid-template-columns: 64px minmax(0, 1fr);
}

.admin-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--app-surface-border-strong);
  background: var(--app-surface-background-soft);
}

.admin-menu {
  flex: 1;
  min-height: 0;
  padding: var(--space-3) var(--space-2);
  overflow-y: auto;
}

.admin-menu__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 10px 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-surface-border-subtle);
}

.admin-menu__brand-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.admin-menu__collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.admin-menu__collapse:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-border-color));
  background: var(--app-hover-background);
  color: var(--el-color-primary);
}

.admin-menu__collapse:focus-visible,
.admin-menu-item:focus-visible {
  outline: var(--focus-outline);
  outline-offset: -2px;
}

.admin-menu__brand span,
.admin-menu__group span {
  color: var(--el-text-color-placeholder);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-transform: uppercase;
}

.admin-menu__brand strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.admin-menu__group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 18px 10px 8px;
}

.admin-menu__group strong {
  color: var(--el-text-color-primary);
  font-size: 11px;
  font-weight: 600;
}

.admin-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  margin-bottom: 2px;
  padding: 0 12px;
  border: 0;
  border: 1px solid transparent;
  border-radius: var(--app-control-radius);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.admin-menu-item .el-icon {
  color: var(--el-text-color-secondary);
  font-size: 18px;
}

.admin-menu-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-border-color));
  background: var(--app-hover-background);
  color: var(--el-color-primary);
}

.admin-menu-item.is-active {
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color));
  background: var(--app-selected-background);
  color: var(--el-color-primary);
}

.admin-menu-item.is-active .el-icon {
  color: var(--el-color-primary);
}

.admin-body.is-sidebar-collapsed .admin-menu {
  padding-inline: 10px;
}

.admin-body.is-sidebar-collapsed .admin-menu__brand {
  justify-content: center;
  margin-inline: 0;
}

.admin-body.is-sidebar-collapsed .admin-menu__brand-copy,
.admin-body.is-sidebar-collapsed .admin-menu-item span {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.admin-body.is-sidebar-collapsed .admin-menu__group {
  width: auto;
  height: 1px;
  margin: 12px 0 8px;
  overflow: hidden;
  background: var(--app-surface-border-subtle);
}

.admin-body.is-sidebar-collapsed .admin-menu-item {
  justify-content: center;
  gap: 0;
  padding: 0;
}

.admin-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.admin-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color-page);
}

.admin-panel__body {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.admin-panel__body :deep(.user-manager),
.admin-panel__body :deep(.audit-manager),
.admin-panel__body :deep(.audit-statistics),
.admin-panel__body :deep(.team-manager),
.admin-panel__body :deep(.ai-model-settings) {
  min-height: 100%;
}

@container admin-workspace (max-width: 1100px) {
  .admin-body { grid-template-columns: 184px minmax(0, 1fr); }
}

@container admin-workspace (max-width: 860px) {
  .admin-body,
  .admin-body.is-sidebar-collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .admin-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--app-divider-color);
  }

  .admin-menu,
  .admin-body.is-sidebar-collapsed .admin-menu {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    overflow-x: auto;
  }

  .admin-menu__brand,
  .admin-menu__group,
  .admin-body.is-sidebar-collapsed .admin-menu__group {
    display: none;
  }

  .admin-menu-item,
  .admin-body.is-sidebar-collapsed .admin-menu-item {
    flex: 0 0 auto;
    width: auto;
    height: var(--control-height);
    margin: 0;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    white-space: nowrap;
  }

  .admin-body.is-sidebar-collapsed .admin-menu-item span {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    clip: auto;
    overflow: visible;
  }

  .admin-panel__body {
    padding: var(--space-3) var(--space-2);
  }
}
</style>
