<template>
  <div class="home-container">
    <div class="home-layout">
      <aside
        class="home-aside"
        :class="{ 'is-collapsed': sidebarCollapsed }"
      >
        <div class="aside-shell">
          <div class="nav-section">
            <div class="nav-section-header">
              <div class="nav-section-title">
                <span class="nav-section-kicker">Platform Modules</span>
                <strong>平台模块</strong>
              </div>
              <el-tooltip
                :content="sidebarCollapsed ? '展开导航' : '折叠导航'"
                placement="right"
              >
                <button
                  class="collapse-toggle"
                  type="button"
                  :aria-label="sidebarCollapsed ? '展开导航' : '折叠导航'"
                  @click="toggleSidebar"
                >
                  <el-icon>
                    <Icon :icon="sidebarCollapsed ? iconMap.arrowRight : iconMap.arrowLeft" />
                  </el-icon>
                </button>
              </el-tooltip>
            </div>
            <div class="sidebar-menu">
              <section
                v-for="group in menuGroups"
                :key="group.key"
                class="menu-group"
                :aria-label="group.title"
              >
                <div class="menu-group-label">
                  <span class="menu-group-kicker">{{ group.kicker }}</span>
                  <strong>{{ group.title }}</strong>
                </div>
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  class="menu-item"
                  :class="{
                    'is-active': selectedMenu === item.key,
                    'has-task-alert': item.key === 'task-center' && taskSummary.failed > 0
                  }"
                  :title="sidebarCollapsed ? menuAriaLabel(item) : ''"
                  :aria-label="menuAriaLabel(item)"
                  @click="handleSelect(item.key)"
                >
                  <span class="menu-icon">
                    <el-icon><Icon :icon="item.icon" /></el-icon>
                  </span>
                  <strong class="menu-title">{{ item.title }}</strong>
                  <span
                    v-if="item.key === 'task-center' && hasTaskBadge"
                    class="menu-badges"
                  >
                    <StatusIndicator
                      v-if="taskSummary.active > 0"
                      status="running"
                      :label="String(taskSummary.active)"
                      compact
                    />
                    <StatusIndicator
                      v-if="taskSummary.failed > 0"
                      status="failed"
                      :label="String(taskSummary.failed)"
                      compact
                    />
                  </span>
                </button>
              </section>
            </div>
          </div>
        </div>
      </aside>

      <main class="home-main">
        <div class="content-body">
          <section class="home-stage">
            <div class="content-section">
              <template
                v-for="(component, key) in componentMap"
                :key="key"
              >
                <div
                  v-if="initializedModules[key]"
                  v-show="selectedMenu === key"
                  class="module-wrapper"
                >
                  <component
                    :is="component"
                    @add-puppet-entity="addPuppetEntity"
                  />
                </div>
              </template>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { DEFAULT_HOME_MENU_KEY, HOME_MENU_GROUPS } from '@/constants/app.js'
import { globalTaskCenterSnapshotApi } from '@/services/api.js'
import { icons } from '@/utils/icons.js'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const ScriptGenerator = defineAsyncComponent(
  () => import('@/components/ScriptGenerator/ScriptGenerator.vue')
)
const PluginManager = defineAsyncComponent(
  () => import('@/components/PluginManager/PluginManager.vue')
)
const FingerprintManager = defineAsyncComponent(
  () => import('@/components/FingerprintManager/FingerprintManager.vue')
)
const DisguiseManager = defineAsyncComponent(
  () => import('@/components/DisguiseManager/DisguiseManager.vue')
)
const PuppetManager = defineAsyncComponent(
  () => import('@/components/PuppetManager/PuppetManager.vue')
)
const UserSpace = defineAsyncComponent(() => import('@/components/UserSpace/UserSpace.vue'))
const GlobalTaskCenter = defineAsyncComponent(
  () => import('@/components/TaskCenter/GlobalTaskCenter.vue')
)
const SkillManager = defineAsyncComponent(
  () => import('@/components/SkillManager/SkillManager.vue')
)

const emit = defineEmits(['addPuppetEntity'])
const selectedMenu = ref(DEFAULT_HOME_MENU_KEY)
const SIDEBAR_COLLAPSED_KEY = 'leovue-home-sidebar-collapsed'
const sidebarCollapsed = ref(false)
const iconMap = icons
const taskSummary = ref({ active: 0, failed: 0 })
let taskSummaryTimer = null
// 记录已挂载过的模块 key，首次访问时懒挂载，之后用 v-show 保留状态
const initializedModules = reactive({ [DEFAULT_HOME_MENU_KEY]: true })
const menuGroups = HOME_MENU_GROUPS
const hasTaskBadge = computed(() => taskSummary.value.active > 0 || taskSummary.value.failed > 0)

const componentMap = {
  puppet: PuppetManager,
  'task-center': GlobalTaskCenter,
  'user-space': UserSpace,
  hostgen: ScriptGenerator,
  disguise: DisguiseManager,
  plugin: PluginManager,
  fingerprint: FingerprintManager,
  skill: SkillManager
}

const handleSelect = (key) => {
  if (!componentMap[key]) return
  if (!initializedModules[key]) {
    initializedModules[key] = true // 首次访问时懒挂载，此后 v-show 保留状态
  }
  selectedMenu.value = key
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const refreshTaskSummary = async () => {
  try {
    const response = await globalTaskCenterSnapshotApi()
    const summary = response.data?.summary
    taskSummary.value = {
      active: Number(summary?.active) || 0,
      failed: Number(summary?.failed) || 0
    }
  } catch {
    // 导航状态不应因临时网络错误打断用户工作；保留上一轮可用快照。
  }
}

const menuAriaLabel = (item) => {
  if (item.key !== 'task-center' || !hasTaskBadge.value) return item.title
  const parts = []
  if (taskSummary.value.active > 0) parts.push(`${taskSummary.value.active} 个进行中`)
  if (taskSummary.value.failed > 0) parts.push(`${taskSummary.value.failed} 个失败`)
  return `${item.title}，${parts.join('，')}`
}

const refreshTaskSummaryWhenVisible = () => {
  if (document.visibilityState === 'visible') refreshTaskSummary()
}

const addPuppetEntity = (puppetEntityParams) => {
  emit('addPuppetEntity', puppetEntityParams)
}

onMounted(() => {
  sidebarCollapsed.value = safeLocalStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  refreshTaskSummary()
  taskSummaryTimer = window.setInterval(refreshTaskSummaryWhenVisible, 15000)
  document.addEventListener('visibilitychange', refreshTaskSummaryWhenVisible)
})

onUnmounted(() => {
  if (taskSummaryTimer) window.clearInterval(taskSummaryTimer)
  document.removeEventListener('visibilitychange', refreshTaskSummaryWhenVisible)
})

watch(sidebarCollapsed, (collapsed) => {
  safeLocalStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
})
</script>

<style scoped>
.home-container {
  height: 100%;
  width: 100%;
  background: transparent;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.home-layout {
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  gap: var(--space-3);
  padding: 0;
  box-sizing: border-box;
}

.home-aside {
  width: 232px;
  flex-shrink: 0;
  min-height: 0;
  transition: width var(--motion-slow) var(--motion-easing);
}

.home-aside.is-collapsed {
  width: 58px;
}

.aside-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-2) var(--space-3) 0;
  border-radius: 0;
  border: 0;
  border-right: 1px solid var(--app-surface-border-strong);
  background: var(--app-surface-background-soft);
  box-shadow: none;
}

.nav-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.nav-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 var(--space-3) var(--space-3);
  padding: 0 0 var(--space-3);
  border-bottom: 1px solid var(--app-surface-border-subtle);
}

.nav-section-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-section-kicker,
.menu-group-kicker {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-transform: uppercase;
}

.nav-section-title strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}

.collapse-toggle {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 34%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--app-control-background) 80%, transparent);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition:
    color var(--motion-fast) var(--motion-easing),
    border-color var(--motion-fast) var(--motion-easing),
    background var(--motion-fast) var(--motion-easing);
}

.collapse-toggle:hover {
  color: var(--el-color-primary);
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--app-control-background));
}

.sidebar-menu {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: 2px;
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.menu-group + .menu-group {
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 24%, transparent);
}

.menu-group-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 31px;
  padding: 0 12px 5px 14px;
}

.menu-group-label strong {
  color: var(--el-text-color-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 10px 4px 12px;
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition:
    color var(--motion-fast) var(--motion-easing),
    background-color var(--motion-fast) var(--motion-easing),
    border-color var(--motion-fast) var(--motion-easing);
  text-align: left;
  overflow: hidden;
  position: relative;
}

.menu-item:hover {
  background: var(--app-hover-background);
}

.menu-item.is-active {
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color));
  background: var(--app-selected-background);
}

.menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: color-mix(in srgb, var(--el-color-primary) 72%, white);
}

.menu-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  color: var(--el-color-primary);
  background: transparent;
  font-size: 14px;
}

.menu-item.is-active .menu-icon {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--app-control-background));
}

.menu-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  min-width: 0;
}

.menu-item.is-active .menu-title {
  color: var(--el-color-primary);
}

.menu-badges {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}

.menu-badges :deep(.status-indicator) {
  min-width: 24px;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.home-aside.is-collapsed .aside-shell {
  padding-right: 6px;
}

.home-aside.is-collapsed .nav-section-title,
.home-aside.is-collapsed .menu-group-label strong,
.home-aside.is-collapsed .menu-group-kicker,
.home-aside.is-collapsed .menu-title {
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

.home-aside.is-collapsed .nav-section-header {
  justify-content: center;
  margin: 0 0 12px 6px;
  padding-bottom: 10px;
}

.home-aside.is-collapsed .menu-group-label {
  min-height: 0;
  padding: 0;
}

.home-aside.is-collapsed .menu-item {
  justify-content: center;
  gap: 0;
  min-height: 36px;
  padding: 5px 0 5px 6px;
}

.home-aside.is-collapsed .menu-icon {
  width: 28px;
  height: 28px;
}

.home-aside.is-collapsed .menu-group + .menu-group {
  margin-top: 6px;
  padding-top: 6px;
}

.home-aside.is-collapsed .menu-badges {
  display: none;
}

.home-aside.is-collapsed .menu-item.has-task-alert .menu-icon::after {
  content: '';
  position: absolute;
  top: 0;
  right: -1px;
  width: 6px;
  height: 6px;
  border: 1px solid var(--app-control-background);
  border-radius: 50%;
  background: var(--el-color-danger);
}

/* 与管理后台侧栏保持一致的目录结构与交互状态。 */
.aside-shell {
  padding: var(--space-3) var(--space-2);
}

.nav-section-header {
  min-height: 38px;
  margin: 0 10px 16px;
  padding: 0 0 12px;
}

.nav-section-kicker,
.menu-group-kicker {
  font-size: 9px;
}

.nav-section-title strong {
  font-size: 13px;
}

.collapse-toggle {
  width: 24px;
  height: 24px;
  border-color: transparent;
  background: transparent;
}

.collapse-toggle:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-border-color));
  background: var(--app-hover-background);
}

.sidebar-menu,
.menu-group {
  display: block;
}

.sidebar-menu {
  padding-bottom: var(--space-2);
}

.menu-group + .menu-group {
  padding-top: 0;
  border-top: 0;
}

.menu-group-label {
  min-height: 0;
  margin: 18px 10px 8px;
  padding: 0;
}

.menu-group:first-child .menu-group-label {
  margin-top: 0;
}

.menu-item {
  gap: 10px;
  min-height: 36px;
  margin-bottom: 2px;
  padding: 0 12px;
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-regular);
}

.menu-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-border-color));
  color: var(--el-color-primary);
}

.menu-item.is-active {
  color: var(--el-color-primary);
}

.menu-item.is-active::before {
  content: none;
}

.menu-item:focus-visible {
  outline: var(--focus-outline);
  outline-offset: -2px;
}

.menu-icon,
.home-aside.is-collapsed .menu-icon {
  width: 18px;
  height: 18px;
  border-radius: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 18px;
}

.menu-item.is-active .menu-icon {
  color: var(--el-color-primary);
  background: transparent;
}

.menu-title {
  color: inherit;
}

.home-aside.is-collapsed {
  width: 64px;
}

.home-aside.is-collapsed .aside-shell {
  padding: var(--space-3) 10px;
}

.home-aside.is-collapsed .nav-section-header {
  margin: 0 0 16px;
  padding-bottom: 12px;
}

.home-aside.is-collapsed .menu-item {
  min-height: 36px;
  padding: 0;
  border-radius: var(--app-control-radius);
}

.home-aside.is-collapsed .menu-group + .menu-group {
  margin-top: 12px;
  padding-top: 0;
  border-top: 1px solid var(--app-surface-border-subtle);
}

.home-aside.is-collapsed .menu-item.has-task-alert .menu-icon::after {
  top: -3px;
  right: -4px;
}

.home-main {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  flex: 1;
  min-width: 0;
}

.content-body {
  flex: 1;
  padding: 0;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-section {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  padding: 0;
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 每个模块的容器：填满 content-section，v-show 隐藏时覆盖 display:flex */
.module-wrapper {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.module-wrapper[style*='display: none'] {
  display: none !important;
}

.module-wrapper > :deep(*) {
  flex: 1;
  min-height: 0;
}

.content-section > :deep(*) {
  flex: 1;
  min-height: 0;
}

.sidebar-menu::-webkit-scrollbar,
.content-section::-webkit-scrollbar {
  width: var(--app-scrollbar-width);
  height: var(--app-scrollbar-height);
}

.sidebar-menu::-webkit-scrollbar-track,
.content-section::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-menu::-webkit-scrollbar-thumb,
.content-section::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: var(--el-border-radius-round);
}

.sidebar-menu::-webkit-scrollbar-thumb:hover,
.content-section::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-placeholder);
}

@media (max-width: 1200px) {
  .home-layout {
    gap: 14px;
    padding: 14px;
  }

  .home-aside {
    width: 232px;
  }

  .home-aside.is-collapsed {
    width: 64px;
  }
}

@media (max-width: 900px) {
  .home-layout {
    flex-direction: column;
  }

  .home-aside {
    width: 100%;
  }

  .home-aside.is-collapsed {
    width: 100%;
  }

  .aside-shell {
    max-height: 42vh;
    padding-left: 0;
    border-right: 0;
  }

  .menu-item {
    border-radius: 8px;
    padding-left: 16px;
  }

  .home-aside.is-collapsed .nav-section-title,
  .home-aside.is-collapsed .menu-group-label strong,
  .home-aside.is-collapsed .menu-group-kicker,
  .home-aside.is-collapsed .menu-title {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  .home-aside.is-collapsed .nav-section-header {
    justify-content: space-between;
    margin: 0 12px 14px 14px;
    padding-bottom: 12px;
  }

  .home-aside.is-collapsed .menu-group-label {
    min-height: 31px;
    padding: 0 12px 5px 14px;
  }

  .home-aside.is-collapsed .menu-item {
    justify-content: flex-start;
    gap: 8px;
    min-height: 34px;
    padding: 5px 10px 5px 16px;
  }

  .home-aside.is-collapsed .menu-icon {
    width: 24px;
    height: 24px;
  }

  .home-aside.is-collapsed .menu-badges {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .home-layout {
    padding: 12px;
  }

  .aside-shell {
    border-radius: 0;
  }
}
</style>
