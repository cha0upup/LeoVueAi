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
import { supportsCapabilityRequirements } from '@/composables/usePuppetConsoleModules.js'

const ProcessManager       = defineAsyncComponent(() => import('@/components/PuppetConsole/Process/ProcessManager.vue'))
const EventLogManager      = defineAsyncComponent(() => import('@/components/PuppetConsole/EventLog/EventLogManager.vue'))
const ServiceManager       = defineAsyncComponent(() => import('@/components/PuppetConsole/Service/ServiceManager.vue'))
const ScheduledTaskManager = defineAsyncComponent(() => import('@/components/PuppetConsole/ScheduledTask/ScheduledTaskManager.vue'))
const RegistryManager      = defineAsyncComponent(() => import('@/components/PuppetConsole/Registry/RegistryManager.vue'))
const PersistenceManager   = defineAsyncComponent(() => import('@/components/PuppetConsole/Persistence/PersistenceManager.vue'))

defineProps({
  sessionId: { type: String, required: true }
})

const puppetCapabilities = inject('puppetCapabilities', ref([]))
const tabDefinitions = [
  { label: '进程管理', name: 'process', requiredCapabilities: ['process'], component: ProcessManager },
  { label: '事件日志', name: 'event-log', requiredCapabilities: ['eventLog'], component: EventLogManager },
  { label: '服务管理', name: 'service', requiredCapabilities: ['service'], component: ServiceManager },
  { label: '计划任务', name: 'scheduled-task', requiredCapabilities: ['scheduledTask'], component: ScheduledTaskManager },
  { label: '注册表', name: 'registry', requiredCapabilities: ['registry'], component: RegistryManager },
  { label: '持久化枚举', name: 'persistence', requiredCapabilities: ['persistence'], component: PersistenceManager }
]

const availableTabs = computed(() =>
  tabDefinitions.filter((tab) => supportsCapabilityRequirements(tab, unref(puppetCapabilities)))
)

const activeTab   = ref('process')
const initialized = reactive({ process: true })

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
