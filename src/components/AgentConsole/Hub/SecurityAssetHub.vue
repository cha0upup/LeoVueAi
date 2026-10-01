<template>
  <div class="hub-container">
    <el-tabs
      v-model="activeTab"
      class="hub-tabs"
    >
      <el-tab-pane
        v-for="tab in availableTabs"
        :key="tab.name"
        :label="tab.label"
        :name="tab.name"
      >
        <Suspense>
          <component
            :is="tab.component"
            v-if="initialized[tab.name]"
            :session-id="sessionId"
          />
        </Suspense>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, inject, reactive, ref, unref, watch } from 'vue'
import { supportsCapabilityRequirements } from '@/composables/useAgentConsoleModules.js'

const UserAccountManager       = defineAsyncComponent(() => import('@/components/AgentConsole/UserAccount/UserAccountManager.vue'))
const FirewallManager          = defineAsyncComponent(() => import('@/components/AgentConsole/Firewall/FirewallManager.vue'))
const NetworkShareManager      = defineAsyncComponent(() => import('@/components/AgentConsole/NetworkShare/NetworkShareManager.vue'))
const SuidCapsManager          = defineAsyncComponent(() => import('@/components/AgentConsole/SuidCaps/SuidCapsManager.vue'))
const InstalledSoftwareManager = defineAsyncComponent(() => import('@/components/AgentConsole/InstalledSoftware/InstalledSoftwareManager.vue'))
const DockerManager            = defineAsyncComponent(() => import('@/components/AgentConsole/Docker/DockerManager.vue'))
const Screen                   = defineAsyncComponent(() => import('@/components/AgentConsole/Screen/Screen.vue'))

defineProps({
  sessionId: { type: String, required: true }
})

const agentCapabilities = inject('agentCapabilities', ref([]))
const tabDefinitions = [
  { label: '用户与组', name: 'user-account', requiredCapabilities: ['userAccount'], component: UserAccountManager },
  { label: '防火墙', name: 'firewall', requiredCapabilities: ['firewall'], component: FirewallManager },
  { label: '网络共享', name: 'network-share', requiredCapabilities: ['networkShare'], component: NetworkShareManager },
  { label: 'SUID/Caps', name: 'suid-caps', requiredCapabilities: ['suidCapability'], component: SuidCapsManager },
  { label: '已装软件', name: 'installed-software', requiredCapabilities: ['installedSoftware'], component: InstalledSoftwareManager },
  { label: 'Docker', name: 'docker', requiredCapabilities: ['docker'], component: DockerManager },
  { label: '屏幕截图', name: 'screen', requiredCapabilities: ['componentInvoke'], component: Screen }
]

const availableTabs = computed(() =>
  tabDefinitions.filter((tab) => supportsCapabilityRequirements(tab, unref(agentCapabilities)))
)

const activeTab   = ref('user-account')
const initialized = reactive({ 'user-account': true })

watch(activeTab, (key) => {
  if (!initialized[key]) initialized[key] = true
})

watch(
  availableTabs,
  (tabs) => {
    if (!tabs.length) return
    if (!tabs.some((tab) => tab.name === activeTab.value)) {
      activeTab.value = tabs[0].name
    }
    if (!initialized[activeTab.value]) initialized[activeTab.value] = true
  },
  { immediate: true }
)
</script>

<style scoped>
.hub-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-container-background);
}
.hub-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.hub-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-divider-color);
  background: var(--app-container-background);
}
.hub-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 0;
}
.hub-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.hub-tabs :deep(.el-tabs__item:focus-visible) {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: -2px;
}
</style>
