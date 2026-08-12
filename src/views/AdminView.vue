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

          <p class="admin-menu__group">
            <span>Identity</span>
            <strong>账号与组织</strong>
          </p>
          <button
            v-for="tab in accountTabs"
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

          <p class="admin-menu__group">
            <span>Governance</span>
            <strong>审计治理</strong>
          </p>
          <button
            v-for="tab in auditTabs"
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

          <p class="admin-menu__group">
            <span>System</span>
            <strong>系统能力</strong>
          </p>
          <button
            v-for="tab in systemTabs"
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
import { icons } from '@/utils/icons.js'
import { useAppModeNavigation } from '@/composables/useAppModeNavigation.js'
import { useAuth } from '@/composables/useAuth.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const iconMap = icons
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
    summary: '处理账号新增、角色配置与状态维护。',
    description: '集中管理用户身份、角色与团队归属，适合执行账户治理与批量维护。',
    tagType: 'primary',
    tagText: '账户',
    component: UserManager
  },
  {
    name: 'teams',
    label: '团队管理',
    adminOnly: false,
    icon: iconMap.userFilled,
    summary: '组织团队结构，明确队长与成员归属。',
    description: '维护团队实体与负责人分配，为后续权限隔离和资源视角提供组织基础。',
    tagType: 'success',
    tagText: '组织',
    component: TeamManager
  },
  {
    name: 'audit',
    label: '审计日志',
    adminOnly: true,
    icon: iconMap.document,
    summary: '筛选、追踪并清理系统操作日志。',
    description: '面向运维审计与安全追溯，支持多维筛选日志、定位风险操作并维护日志留存。',
    tagType: 'warning',
    tagText: '追踪',
    component: AuditManager
  },
  {
    name: 'statistics',
    label: '审计统计',
    adminOnly: true,
    icon: iconMap.trendCharts,
    summary: '查看审计行为分布与时间趋势。',
    description: '提供按用户、团队、主机与操作类型的统计视角，用于发现异常与优化治理策略。',
    tagType: 'info',
    tagText: '分析',
    component: AuditStatistics
  },
  {
    name: 'system',
    label: 'AI 模型接入',
    adminOnly: true,
    icon: iconMap.settings,
    summary: '管理 AI 供应商、模型同步与能力上限。',
    description: '配置平台接入的 AI 供应商，识别模型能力上限并控制默认调用模型。',
    tagType: 'danger',
    tagText: '配置',
    component: AiChannelSettings
  }
]

const activeTab = ref('users')
const ADMIN_SIDEBAR_COLLAPSED_KEY = 'leovue-admin-sidebar-collapsed'
const sidebarCollapsed = ref(false)

// 根据角色过滤可见模块：只有 admin 可见 adminOnly 标记的模块
const visibleTabs = computed(() => tabs.filter((tab) => !tab.adminOnly || isAdmin.value))
const accountTabs = computed(() => visibleTabs.value.filter((tab) => ['users', 'teams'].includes(tab.name)))
const auditTabs = computed(() => visibleTabs.value.filter((tab) => ['audit', 'statistics'].includes(tab.name)))
const systemTabs = computed(() => visibleTabs.value.filter((tab) => ['system'].includes(tab.name)))

const activeTabMeta = computed(
  () => visibleTabs.value.find((tab) => tab.name === activeTab.value) ?? visibleTabs.value[0]
)
const getQueryTab = (tabName) => {
  return Array.isArray(tabName) ? tabName[0] : tabName
}

const normalizeTabName = (tabName) => {
  const value = Array.isArray(tabName) ? tabName[0] : tabName
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
  if (nextTab) {
    activeTab.value = nextTab
  }
  if (normalizeUrl && nextTab && queryTab !== nextTab) {
    const normalizedLocation = getAdminTabLocation(nextTab)
    rememberAdminRoute(router.resolve(normalizedLocation).fullPath)
    router.replace(normalizedLocation)
    return
  }
  if (nextTab) {
    rememberAdminRoute(route.fullPath)
  }
}

const selectTab = (tabName) => {
  const nextTab = normalizeTabName(tabName)
  if (!nextTab) return
  if (getQueryTab(route.query.tab) === nextTab) return
  const nextLocation = getAdminTabLocation(nextTab)
  rememberAdminRoute(router.resolve(nextLocation).fullPath)
  router.push(nextLocation)
}

watch(
  () => route.query.tab,
  () => {
    syncActiveTabFromRoute({ normalizeUrl: true })
  }
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
