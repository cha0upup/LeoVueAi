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
              @click="selectTab(tab.name)"
            >
              <el-icon><Icon :icon="tab.icon" /></el-icon>
              <span>{{ tab.label }}</span>
            </button>
          </template>
        </nav>
      </aside>

      <section class="admin-main">
        <main class="admin-panel surface">
          <section class="admin-panel__body">
            <component :is="activeTabMeta.component" />
          </section>
        </main>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AuditManager from '@/components/Admin/AuditManager.vue'
import AuditStatistics from '@/components/Admin/AuditStatistics.vue'
import TeamManager from '@/components/Admin/TeamManager.vue'
import UserManager from '@/components/Admin/UserManager.vue'
import AiChannelSettings from '@/components/Settings/AiChannelSettings.vue'
import { ROUTE_PATHS } from '@/constants/app.js'
import { icons as iconMap } from '@/utils/icons.js'
import { useAppModeNavigation } from '@/composables/useAppModeNavigation.js'
import { useAuth } from '@/composables/useAuth.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const router = useRouter()
const route = useRoute()

const { currentUser, isAdmin, isLeader, fetchAuth } = useAuth()
const { rememberAdminRoute } = useAppModeNavigation()

const tabs = [
  {
    name: 'users',
    label: '用户管理',
    adminOnly: false,
    icon: iconMap.user,
    component: UserManager
  },
  {
    name: 'teams',
    label: '团队管理',
    adminOnly: false,
    icon: iconMap.userFilled,
    component: TeamManager
  },
  {
    name: 'audit',
    label: '审计日志',
    adminOnly: true,
    icon: iconMap.document,
    component: AuditManager
  },
  {
    name: 'statistics',
    label: '审计统计',
    adminOnly: true,
    icon: iconMap.trendCharts,
    component: AuditStatistics
  },
  {
    name: 'system',
    label: 'AI 模型接入',
    adminOnly: true,
    icon: iconMap.settings,
    component: AiChannelSettings
  }
]

const activeTab = ref('users')
const ADMIN_SIDEBAR_COLLAPSED_KEY = 'leovue-admin-sidebar-collapsed'
const sidebarCollapsed = ref(false)

// 根据角色过滤可见模块：只有 admin 可见 adminOnly 标记的模块
const visibleTabs = computed(() => tabs.filter((tab) => !tab.adminOnly || isAdmin.value))
const tabGroups = computed(() => [
  { name: 'Identity', label: '账号与组织', tabs: visibleTabs.value.filter((tab) => ['users', 'teams'].includes(tab.name)) },
  { name: 'Governance', label: '审计治理', tabs: visibleTabs.value.filter((tab) => ['audit', 'statistics'].includes(tab.name)) },
  { name: 'System', label: '系统能力', tabs: visibleTabs.value.filter((tab) => tab.name === 'system') }
])

const activeTabMeta = computed(
  () => visibleTabs.value.find((tab) => tab.name === activeTab.value) ?? visibleTabs.value[0]
)
const getQueryTab = (tabName) => Array.isArray(tabName) ? tabName[0] : tabName

const normalizeTabName = (tabName) => {
  const value = getQueryTab(tabName)
  return visibleTabs.value.some((tab) => tab.name === value)
    ? value
    : visibleTabs.value[0]?.name
}

const getAdminTabLocation = (tabName) => ({
  path: ROUTE_PATHS.admin,
  query: { ...route.query, tab: tabName }
})

const syncActiveTabFromRoute = ({ normalizeUrl = false } = {}) => {
  const queryTab = getQueryTab(route.query.tab)
  const nextTab = normalizeTabName(queryTab)
  if (!nextTab) return
  activeTab.value = nextTab
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
  () => route.query.tab,
  () => syncActiveTabFromRoute({ normalizeUrl: true })
)

watch(sidebarCollapsed, (collapsed) => {
  safeLocalStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
})

onMounted(async () => {
  sidebarCollapsed.value = safeLocalStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === '1'
  await fetchAuth()
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
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
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
  height: calc(100vh - 64px);
  overflow: auto;
  padding: 0;
}

.admin-panel__body :deep(.user-manager),
.admin-panel__body :deep(.audit-manager),
.admin-panel__body :deep(.audit-statistics),
.admin-panel__body :deep(.team-manager),
.admin-panel__body :deep(.ai-model-settings) {
  min-height: 100%;
}

.admin-panel__body :deep(.ai-model-settings) {
  padding: var(--space-4);
}

@media (max-width: 768px) {
  .admin-body {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    display: none;
  }

  .admin-panel__body {
    height: calc(100vh - 64px);
  }

  .admin-panel__body :deep(.ai-model-settings) {
    padding: 20px 16px;
  }
}
</style>
