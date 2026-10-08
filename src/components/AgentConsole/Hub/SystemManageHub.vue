<template>
  <AgentConsoleHub
    :session-id="sessionId"
    :tab-definitions="tabDefinitions"
    initial-tab="process"
  />
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import AgentConsoleHub from './AgentConsoleHub.vue'

const ProcessManager       = defineAsyncComponent(() => import('@/components/AgentConsole/Process/ProcessManager.vue'))
const EventLogManager      = defineAsyncComponent(() => import('@/components/AgentConsole/EventLog/EventLogManager.vue'))
const ServiceManager       = defineAsyncComponent(() => import('@/components/AgentConsole/Service/ServiceManager.vue'))
const ScheduledTaskManager = defineAsyncComponent(() => import('@/components/AgentConsole/ScheduledTask/ScheduledTaskManager.vue'))
const RegistryManager      = defineAsyncComponent(() => import('@/components/AgentConsole/Registry/RegistryManager.vue'))
const PersistenceManager   = defineAsyncComponent(() => import('@/components/AgentConsole/Persistence/PersistenceManager.vue'))

defineProps({
  sessionId: { type: String, required: true }
})

const tabDefinitions = [
  { label: '进程管理', name: 'process', requiredCapabilities: ['process'], component: ProcessManager },
  { label: '事件日志', name: 'event-log', requiredCapabilities: ['eventLog'], component: EventLogManager },
  { label: '服务管理', name: 'service', requiredCapabilities: ['service'], component: ServiceManager },
  { label: '计划任务', name: 'scheduled-task', requiredCapabilities: ['scheduledTask'], component: ScheduledTaskManager },
  { label: '注册表', name: 'registry', requiredCapabilities: ['registry'], component: RegistryManager },
  { label: '持久化枚举', name: 'persistence', requiredCapabilities: ['persistence'], component: PersistenceManager }
]

</script>
