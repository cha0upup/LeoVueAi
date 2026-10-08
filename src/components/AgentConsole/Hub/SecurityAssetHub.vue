<template>
  <AgentConsoleHub
    :session-id="sessionId"
    :tab-definitions="tabDefinitions"
    initial-tab="user-account"
  />
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import AgentConsoleHub from './AgentConsoleHub.vue'

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

const tabDefinitions = [
  { label: '用户与组', name: 'user-account', requiredCapabilities: ['userAccount'], component: UserAccountManager },
  { label: '防火墙', name: 'firewall', requiredCapabilities: ['firewall'], component: FirewallManager },
  { label: '网络共享', name: 'network-share', requiredCapabilities: ['networkShare'], component: NetworkShareManager },
  { label: 'SUID/Caps', name: 'suid-caps', requiredCapabilities: ['suidCapability'], component: SuidCapsManager },
  { label: '已装软件', name: 'installed-software', requiredCapabilities: ['installedSoftware'], component: InstalledSoftwareManager },
  { label: 'Docker', name: 'docker', requiredCapabilities: ['docker'], component: DockerManager },
  { label: '屏幕截图', name: 'screen', requiredCapabilities: ['componentInvoke'], component: Screen }
]

</script>
