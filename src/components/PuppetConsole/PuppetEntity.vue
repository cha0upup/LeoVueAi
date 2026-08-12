<template>
  <div
    class="puppet-entity"
    @keydown.capture="onGlobalKeydown"
  >
    <div class="console-header-wrap">
      <Transition name="header-fade">
        <PuppetConsoleHeader
          v-if="sessionId && isInitialized"
          :conn-link="connLink"
          :current-host-id="currentHostId"
          :puppet-name="puppetName"
          :display-conn-link-chain="displayConnLinkChain"
          :cache-mode="props.cacheMode"
          :task-summary="taskSummary"
          :icon-map="iconMap"
          @open-task-manager="handlePaletteOpen('task-manager')"
        />
      </Transition>
    </div>

    <div class="main-content">
      <!-- Tool workspace -->
      <div class="content-area">
        <!-- Tab bar sits at the top of the content area -->
        <TabBar
          :tabs="tabs"
          :active-key="activeKey"
          :badges="tabBadges"
          @activate="setActive"
          @close="handleCloseTab"
          @open-palette="paletteVisible = true"
          @open-settings="handlePaletteOpen('settings')"
        />

        <div class="content-body">
          <div
            v-if="!sessionId"
            class="waiting-container"
          >
            <div class="state-card">
              <el-result
                icon="info"
                title="等待连接"
                sub-title="正在等待主机连接信息..."
              >
                <template #extra>
                  <el-icon class="loading-icon">
                    <Icon :icon="iconMap.connection" />
                  </el-icon>
                  <span>请先连接到主机</span>
                </template>
              </el-result>
            </div>
          </div>

          <div
            v-else-if="hasError"
            class="error-container"
          >
            <div class="state-card">
              <el-result
                icon="error"
                :title="errorMessage"
                sub-title="请检查网络连接或联系管理员"
              >
                <template #extra>
                  <el-button
                    type="primary"
                    @click="retryInitialization"
                  >
                    <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
                    重试
                  </el-button>
                </template>
              </el-result>
            </div>
          </div>

          <div
            v-else-if="!isInitialized"
            class="loading-container"
          >
            <div class="state-card init-card">
              <div class="init-spinner">
                <el-icon class="spin-icon">
                  <Icon :icon="iconMap.connection" />
                </el-icon>
              </div>
              <p class="init-step">
                {{ initStep || '正在连接主机…' }}
              </p>
              <div class="init-progress">
                <div class="init-progress-track">
                  <div
                    class="init-progress-fill"
                    :style="{ width: initProgressWidth + '%' }"
                  />
                </div>
                <span class="init-step-count">{{ initStepIndex }}/3</span>
              </div>
            </div>
          </div>

          <template v-if="isInitialized && sessionId">
            <template
              v-for="entry in availableModuleEntries.filter(e => e.key !== 'ai')"
              :key="entry.key"
            >
              <div
                v-if="initializedModules[entry.key]"
                v-show="activeKey === entry.key"
                class="module-container"
                :class="{ 'module-active': activeKey === entry.key }"
              >
                <Suspense>
                  <component
                    :is="entry.component"
                    v-bind="getModuleProps(entry.key)"
                    :key="`${entry.key}-${refreshKey}`"
                    v-on="getModuleListeners(entry.key)"
                  />
                  <template #fallback>
                    <div class="module-loading-state">
                      <el-skeleton
                        :rows="8"
                        animated
                      />
                    </div>
                  </template>
                </Suspense>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- AI co-pilot dock (floating overlay) -->
      <AiDock
        v-if="sessionId && isInitialized"
        :session-id="sessionId"
        :initial-prompt="initialPrompt"
        :visible="aiDockVisible"
        @toggle="toggleAiDock"
      />
    </div>

    <!-- ⌘K Command Palette -->
    <CommandPalette
      :visible="paletteVisible"
      :module-definitions="paletteModules"
      :is-open="isOpen"
      @open="handlePaletteOpen"
      @close="paletteVisible = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import { getConnLinkChainApi, getCurrentHostIdApi, getPuppetNodeCapabilitiesApi } from '@/services/api.js'
import {
  supportsCapabilityRequirements,
  usePuppetConsoleModules
} from '@/composables/usePuppetConsoleModules.js'
import { useToolTabs } from '@/composables/useToolTabs.js'
import PuppetConsoleHeader from '@/components/PuppetConsole/PuppetConsoleHeader.vue'
import TabBar from '@/components/Workspace/TabBar.vue'
import CommandPalette from '@/components/Workspace/CommandPalette.vue'
import AiDock from '@/components/Workspace/AiDock.vue'
import { showError } from '@/utils/messageUtils.js'
import { taskEngine } from '@/components/PuppetConsole/File/TaskEngine.js'
import { TaskStatus } from '@/constants/task.js'
import { PUPPET_CONSOLE_SETTINGS_STORAGE_KEY } from '@/constants/app.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const CACHE_MODE_DISABLED_KEYS = [
  'terminal',
  'database',
  'proxy',
  'scan',
  'http-sender',
  'system-manage-hub',
  'security-asset-hub',
  'plugin',
  'container',
  'task-manager',
  'settings'
]

// Props
const props = defineProps({
  sessionId: {
    type: String,
    required: false,
    default: ''
  },
  connLink: {
    type: String,
    required: false,
    default: ''
  },
  puppetName: {
    type: String,
    required: false,
    default: ''
  },
  cacheMode: {
    type: Boolean,
    required: false,
    default: false
  },
  capabilities: {
    type: Array,
    required: false,
    default: () => []
  },
  initialPrompt: {
    type: String,
    required: false,
    default: ''
  }
})

// ── Core state ─────────────────────────────────────────────────────────────
const isInitialized = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const initStep = ref('')
// Tracks which module components have been mounted at least once (lazy).
// 'ai' is now in the dock — exclude it from the tool tab area.
const initializedModules = reactive({ info: true })
const serverConnLinkChain = ref([])
const currentHostId = ref('')
const serverCapabilities = ref([])
const puppetRuntime = ref('java')
const runtimeProfile = ref(null)
const iconMap = icons
const refreshKey = ref(0)
const paletteVisible = ref(false)
const sessionCapabilities = computed(() => (
  serverCapabilities.value.length ? serverCapabilities.value : props.capabilities
))

provide('puppetCapabilities', sessionCapabilities)
provide('puppetRuntime', puppetRuntime)
provide('puppetRuntimeProfile', runtimeProfile)

const { moduleDefinitions: moduleEntries, moduleMap } = usePuppetConsoleModules(iconMap)

const isModuleAvailable = (module) => (
  !!module &&
  !(props.cacheMode && CACHE_MODE_DISABLED_KEYS.includes(module.key)) &&
  supportsCapabilityRequirements(module, sessionCapabilities.value)
)

const availableModuleEntries = computed(() => moduleEntries.filter(isModuleAvailable))

// ── Tab management ─────────────────────────────────────────────────────────
const { tabs, activeKey, openTab, ensureTab, closeTab, setActive, isOpen, resetTabs, loadForSession } =
  useToolTabs(moduleEntries, {
    getSessionId: () => props.sessionId || '',
    isModuleAvailable: (_key, module) => isModuleAvailable(module)
  })

// ── Tab badges (task notifications) ───────────────────────────────────────
// badge shape: { count: number, type: 'info' | 'success' | 'danger' | 'warning' }
const tabBadges = reactive({})
const taskSummary = reactive({ running: 0, completed: 0, failed: 0 })

// ── AI dock visibility (persisted) ────────────────────────────────────────
const AI_DOCK_VISIBLE_KEY = 'puppet-ai-dock-visible'
const aiDockVisible = ref(safeLocalStorage.getItem(AI_DOCK_VISIBLE_KEY, '0') === '1')
function toggleAiDock() {
  aiDockVisible.value = !aiDockVisible.value
  safeLocalStorage.setItem(AI_DOCK_VISIBLE_KEY, aiDockVisible.value ? '1' : '0')
}

function _updateTaskBadge() {
  const sid = props.sessionId
  if (!sid) return
  const tasks = taskEngine.getTasksBySession(sid).filter(t => t.type !== 'shell')
  const running = tasks.filter(t =>
    t.status === TaskStatus.DOWNLOADING ||
    t.status === TaskStatus.UPLOADING ||
    t.status === TaskStatus.DB_EXPORTING ||
    t.status === TaskStatus.SCANNING ||
    t.status === TaskStatus.PENDING
  ).length
  const failed = tasks.filter(t => t.status === TaskStatus.FAILED).length
  const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length

  taskSummary.running = running
  taskSummary.completed = completed
  taskSummary.failed = failed

  if (running > 0) {
    tabBadges['task-manager'] = { count: running, type: 'info' }
  } else if (failed > 0) {
    tabBadges['task-manager'] = { count: failed, type: 'danger' }
  } else if (completed > 0) {
    tabBadges['task-manager'] = { count: completed, type: 'success' }
  } else {
    delete tabBadges['task-manager']
  }
}

function _onTaskEvent(task) {
  if (task.sessionId !== props.sessionId) return
  ensureTab('task-manager')
  _updateTaskBadge()
}


const INIT_STEPS = ['校验模块配置…', '获取连接链路…', '读取主机信息…']
const initStepIndex = computed(() => {
  const idx = INIT_STEPS.indexOf(initStep.value)
  return idx >= 0 ? idx + 1 : (initStep.value ? INIT_STEPS.length : 0)
})
const initProgressWidth = computed(() => {
  switch (initStep.value) {
    case '校验模块配置…': return 20
    case '获取连接链路…': return 55
    case '读取主机信息…': return 85
    default: return 0
  }
})

// ── Settings (provided to children) ───────────────────────────────────────
const loadInitialSettings = () => {
  const parsed = safeLocalStorage.getJSON(
    PUPPET_CONSOLE_SETTINGS_STORAGE_KEY,
    {},
    (value) => value && typeof value === 'object' && !Array.isArray(value)
  )
  return {
    listPageSize:
      typeof parsed.listPageSize === 'number' && parsed.listPageSize > 0
        ? parsed.listPageSize
        : 50,
    sessionId: props.sessionId || parsed.sessionId || ''
  }
}

const puppetSettings = reactive(loadInitialSettings())

provide('puppetSettings', puppetSettings)
provide('puppetListPageSize', computed(() => puppetSettings.listPageSize))
provide('cacheMode', computed(() => props.cacheMode))

// Sidebar badge system — children inject 'updateSidebarBadge' to signal badges
const sidebarBadges = reactive({})
provide('sidebarBadges', sidebarBadges)
provide('updateSidebarBadge', (key, value) => {
  sidebarBadges[key] = value
})

// ── Derived ────────────────────────────────────────────────────────────────
const displayConnLinkChain = computed(() => {
  const chain = serverConnLinkChain.value
  if (!chain?.length) return []
  const validChain = chain.filter((link) => link?.trim())
  return validChain.length ? [...validChain].reverse() : []
})

// Modules available for the command palette (excludes cache-disabled ones)
const paletteModules = computed(() => availableModuleEntries.value)

// Sync settings.sessionId with prop
watch(
  () => props.sessionId,
  (val) => { puppetSettings.sessionId = val || '' },
  { immediate: true }
)

// ── Module helpers ─────────────────────────────────────────────────────────
const getModuleProps = (moduleKey) => {
  if (moduleKey === 'settings') return { settings: puppetSettings }
  return { sessionId: props.sessionId }
}

const getModuleListeners = (moduleKey) => {
  if (moduleKey === 'settings') {
    return {
      'update:settings': (val) => Object.assign(puppetSettings, val)
    }
  }
  return {}
}

// ── Tab actions ────────────────────────────────────────────────────────────
const handlePaletteOpen = (key) => {
  const module = moduleMap[key]
  if (!isModuleAvailable(module)) return
  if (!initializedModules[key]) initializedModules[key] = true
  openTab(key)
}

const handleCloseTab = (key) => {
  closeTab(key)
  // Note: we keep initializedModules[key]=true to preserve component state
  // if the tab is reopened later in the same session.
}

// Preserve existing API for children that call switchTab via provide (if any)
const switchTab = (tabKey) => handlePaletteOpen(tabKey)
provide('switchTab', switchTab)

// ── Keyboard shortcut ─────────────────────────────────────────────────────
const onGlobalKeydown = (e) => {
  const isCmd = e.metaKey || e.ctrlKey
  if (isCmd && e.key === 'k') {
    e.preventDefault()
    e.stopPropagation()
    paletteVisible.value = !paletteVisible.value
  }
}

// Also listen at window level to catch events that don't bubble into this component
const onWindowKeydown = (e) => {
  const isCmd = e.metaKey || e.ctrlKey
  if (isCmd && e.key === 'k') {
    e.preventDefault()
    paletteVisible.value = !paletteVisible.value
  }
}

// ── Session & initialization ───────────────────────────────────────────────
const fetchConnLinkChain = async () => {
  if (!props.sessionId) return
  try {
    const response = await getConnLinkChainApi({ sessionId: props.sessionId })
    const raw = response?.data?.connLinkChain
    if (!Array.isArray(raw)) { serverConnLinkChain.value = []; return }
    serverConnLinkChain.value = raw.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') return item.connLink || item.puppetName || item.puppetId || ''
      return ''
    })
  } catch {
    serverConnLinkChain.value = []
  }
}

const fetchCurrentHostId = async () => {
  if (!props.sessionId) { currentHostId.value = ''; return }
  try {
    const response = await getCurrentHostIdApi({ sessionId: props.sessionId })
    currentHostId.value = response?.data?.currentHostId || ''
  } catch {
    currentHostId.value = ''
  }
}

const fetchCapabilities = async () => {
  if (!props.sessionId) {
    serverCapabilities.value = []
    puppetRuntime.value = 'java'
    runtimeProfile.value = null
    return
  }
  try {
    const response = await getPuppetNodeCapabilitiesApi({ sessionId: props.sessionId })
    const raw = response?.data?.capabilities
    serverCapabilities.value = Array.isArray(raw) ? raw : []
    puppetRuntime.value = response?.data?.runtimeProfile?.runtime || 'java'
    runtimeProfile.value = response?.data?.runtimeProfile || null
  } catch {
    serverCapabilities.value = Array.isArray(props.capabilities) ? [...props.capabilities] : []
  }
}

const retryInitialization = () => {
  hasError.value = false
  errorMessage.value = ''
  isInitialized.value = false
  if (props.sessionId) setTimeout(initializeComponent, 100)
}

const initializeComponent = async () => {
  try {
    if (props.cacheMode) {
      await fetchCapabilities()
      await fetchConnLinkChain()
      initStep.value = ''
      isInitialized.value = true
      return
    }

    initStep.value = '校验模块配置…'
    if (!moduleEntries?.length) throw new Error('菜单配置为空')
    if (!props.sessionId) throw new Error('会话ID不能为空')
    await fetchCapabilities()

    initStep.value = '获取连接链路…'
    await fetchConnLinkChain()

    initStep.value = '读取主机信息…'
    await fetchCurrentHostId()

    initStep.value = ''
    isInitialized.value = true
  } catch (error) {
    initStep.value = ''
    hasError.value = true
    errorMessage.value = error.message
    showError(`初始化失败: ${error.message}`)
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  taskEngine.on('taskCreated', _onTaskEvent)
  taskEngine.on('taskStarted', _onTaskEvent)
  taskEngine.on('taskPaused', _onTaskEvent)
  taskEngine.on('taskResumed', _onTaskEvent)
  taskEngine.on('taskCompleted', _onTaskEvent)
  taskEngine.on('taskFailed', _onTaskEvent)
  taskEngine.on('taskCancelled', _onTaskEvent)
  taskEngine.on('taskRemoved', _onTaskEvent)
  if (props.sessionId) {
    loadForSession()
    // Only initialize the active tab — others load lazily on first activation
    initializedModules[activeKey.value] = true
    _updateTaskBadge()
    initializeComponent()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  taskEngine.off('taskCreated', _onTaskEvent)
  taskEngine.off('taskStarted', _onTaskEvent)
  taskEngine.off('taskPaused', _onTaskEvent)
  taskEngine.off('taskResumed', _onTaskEvent)
  taskEngine.off('taskCompleted', _onTaskEvent)
  taskEngine.off('taskFailed', _onTaskEvent)
  taskEngine.off('taskCancelled', _onTaskEvent)
  taskEngine.off('taskRemoved', _onTaskEvent)
})

// Lazy-initialize modules on first activation
watch(activeKey, (key) => {
  if (key && !initializedModules[key]) {
    initializedModules[key] = true
  }
  // Clear badge when user navigates to the tab
  if (key && tabBadges[key]) {
    delete tabBadges[key]
  }
})

watch(
  () => props.sessionId,
  (newSessionId, oldSessionId) => {
    if (newSessionId && !isInitialized.value) {
      initializeComponent()
    } else if (newSessionId && newSessionId !== oldSessionId) {
      // Session switched: reset tabs and lazy-mount state, then restore persisted tabs
      resetTabs()
      Object.keys(initializedModules).forEach((k) => delete initializedModules[k])
      Object.keys(tabBadges).forEach((k) => delete tabBadges[k])
      loadForSession()
      // Only initialize the active tab — others load lazily on first activation
      initializedModules[activeKey.value] = true
      _updateTaskBadge()
      fetchConnLinkChain()
      fetchCurrentHostId()
      fetchCapabilities()
    } else if (!newSessionId) {
      currentHostId.value = ''
      serverCapabilities.value = []
      puppetRuntime.value = 'java'
      runtimeProfile.value = null
    }
  }
)

watch(
  () => props.capabilities,
  (value) => {
    serverCapabilities.value = Array.isArray(value) ? [...value] : []
  },
  { immediate: true }
)
</script>

<style scoped>
.puppet-entity {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  overflow: hidden;
}

/* Reserve header space to avoid layout shift on init */
.console-header-wrap {
  flex-shrink: 0;
  min-height: 42px;
}

.header-fade-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.header-fade-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  writing-mode: horizontal-tb;
  text-orientation: mixed;
  min-width: 0;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: transparent;
}

.content-body {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.module-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: visible;
  padding: 0;
}

/* v-show sets display:none — must override flex */
.module-container[style*='display: none'] {
  display: none !important;
}

.content-component {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.module-loading-state {
  padding: 12px;
  border-radius: var(--radius-container);
  margin: 0;
}

.loading-container {
  padding-top: 10px;
  flex: 1;
  overflow-y: auto;
}

.waiting-container {
  padding-top: 10px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: min(50vh, 600px);
}

.error-container {
  padding-top: 10px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: min(50vh, 600px);
}

.state-card {
  width: min(720px, 100%);
  padding: 16px;
  border-radius: var(--radius-container);
  border: 1px solid var(--app-divider-color);
  background: var(--app-container-background);
  box-shadow: none;
}

.state-card :deep(.el-result) {
  padding: 8px;
}

.waiting-container .loading-icon {
  font-size: clamp(2.5rem, 3vw, 3rem);
  color: var(--el-color-primary);
  animation: pulse 2s infinite;
  margin-bottom: var(--el-spacing-base);
}

/* init card */
.init-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 24px;
  width: min(420px, 100%);
  margin: 0 auto;
}

.init-spinner {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-container);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-control-background-soft));
  color: var(--el-color-primary);
}

.spin-icon {
  font-size: 22px;
  animation: spinPulse 1.6s ease-in-out infinite;
}

@keyframes spinPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.55; transform: scale(0.88); }
}

.init-step {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.02em;
  min-height: 1.5em;
}

.init-progress {
  width: 100%;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.init-progress-track {
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  overflow: hidden;
}

.init-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--el-color-primary);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  width: 0%;
}

.init-step-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.04em;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(1.1); }
}

@media (max-width: 900px) {
  .main-content {
    flex-direction: column;
    padding: 0;
  }

  .module-container {
    padding: 10px 0 0;
  }
}
</style>
