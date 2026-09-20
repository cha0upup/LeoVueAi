<template>
  <div class="proxy-workbench">
    <div class="proxy-shell">
      <div class="shell-body">
        <div
          class="protocol-tabs"
          role="tablist"
          aria-label="代理类型"
        >
          <button
            v-for="(protocol, index) in availableProxyProtocols"
            :id="`${tabsId}-${protocol.value}`"
            :key="protocol.value"
            type="button"
            role="tab"
            class="protocol-tab"
            :class="{ active: activeProxyType === protocol.value }"
            :aria-selected="activeProxyType === protocol.value"
            :aria-controls="`${tabsId}-panel`"
            :aria-label="`${protocol.label}，${getProtocolStatusLabel(protocol.value)}`"
            :tabindex="activeProxyType === protocol.value ? 0 : -1"
            :title="[protocol.label, getProtocolStatusLabel(protocol.value), getProtocolMeta(protocol.value)].filter(Boolean).join(' · ')"
            @click="activeProxyType = protocol.value"
            @keydown="onProtocolKeydown($event, index)"
          >
            <el-icon aria-hidden="true">
              <Icon :icon="protocol.icon" />
            </el-icon>
            <span>{{ protocol.label }}</span>
            <span
              class="protocol-status-dot"
              :class="`is-${proxyState[protocol.value].status}`"
              aria-hidden="true"
            />
          </button>
        </div>

        <section
          :id="`${tabsId}-panel`"
          class="workspace-panel"
          role="tabpanel"
          :aria-labelledby="`${tabsId}-${activeProxyType}`"
          tabindex="0"
        >
          <div class="workspace-body">
            <Socks5Proxy
              v-if="activeProxyType === 'socks5'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyState('socks5', { status })"
              @metrics-change="(payload) => updateProxyState('socks5', payload)"
            />
            <HttpProxy
              v-else-if="activeProxyType === 'http'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyState('http', { status })"
              @metrics-change="(payload) => updateProxyState('http', payload)"
            />
            <LocalForward
              v-else-if="activeProxyType === 'forward'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyState('forward', { status })"
              @rules-change="(rulesCount) => updateProxyState('forward', { rulesCount })"
            />
            <ReverseTunnel
              v-else-if="activeProxyType === 'reverse'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyState('reverse', { status })"
              @rules-change="(rulesCount) => updateProxyState('reverse', { rulesCount })"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, unref, useId, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { supportsCapabilityRequirements } from '@/composables/usePuppetConsoleModules.js'
import Socks5Proxy from './Socks5Proxy.vue'
import HttpProxy from './HttpProxy.vue'
import LocalForward from './LocalForward.vue'
import ReverseTunnel from './ReverseTunnel.vue'

const iconMap = icons
const puppetCapabilities = inject('puppetCapabilities', ref([]))

defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const tabsId = useId()
const activeProxyType = ref('socks5')
const proxyState = ref({
  socks5: {
    status: 'unknown',
    activeConnections: 0,
    totalConnections: 0,
    port: null
  },
  http: {
    status: 'unknown',
    activeConnections: 0,
    totalConnections: 0,
    port: null
  },
  forward: {
    status: 'unknown',
    rulesCount: 0
  },
  reverse: {
    status: 'unknown',
    rulesCount: 0
  }
})

const proxyProtocols = [
  {
    value: 'socks5',
    label: 'SOCKS5 代理',
    icon: iconMap.proxy,
    requiredCapabilities: ['socks5Proxy']
  },
  {
    value: 'http',
    label: 'HTTP 代理',
    icon: iconMap.server,
    requiredCapabilities: ['httpProxy']
  },
  {
    value: 'forward',
    label: '本地端口转发',
    icon: iconMap.network,
    requiredCapabilities: ['localForward']
  },
  {
    value: 'reverse',
    label: '反向隧道',
    icon: iconMap.share,
    requiredCapabilities: ['reverseTunnel']
  }
]

const availableProxyProtocols = computed(() =>
  proxyProtocols.filter((protocol) => supportsCapabilityRequirements(protocol, unref(puppetCapabilities)))
)

watch(
  availableProxyProtocols,
  (protocols) => {
    if (!protocols.length) return
    if (!protocols.some((protocol) => protocol.value === activeProxyType.value)) {
      activeProxyType.value = protocols[0].value
    }
  },
  { immediate: true }
)

const updateProxyState = (type, patch) => {
  proxyState.value[type] = { ...proxyState.value[type], ...patch }
}

const onProtocolKeydown = (event, index) => {
  const count = availableProxyProtocols.value.length
  let next
  if (event.key === 'ArrowRight') next = (index + 1) % count
  else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = count - 1
  else return
  event.preventDefault()
  activeProxyType.value = availableProxyProtocols.value[next].value
  event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus()
}

const getProtocolStatusLabel = (type) => {
  const status = proxyState.value[type]?.status
  if (status === 'running') return '运行中'
  if (status === 'error') return '异常'
  if (status === 'stopped') return '未启动'
  return '未检查'
}

const getProtocolMeta = (type) => {
  const current = proxyState.value[type] || {}
  if ((type === 'socks5' || type === 'http') && current.status === 'running') {
    return `端口 ${current.port || '-'} · ${current.activeConnections || 0} 活跃连接`
  }
  if (type === 'forward') {
    const count = current.rulesCount || 0
    return count > 0 ? `${count} 条规则运行中` : '进入工作区添加转发规则'
  }
  if (type === 'reverse') {
    const count = current.rulesCount || 0
    return count > 0 ? `${count} 条隧道运行中` : '进入工作区添加反向隧道'
  }
  return ''
}
</script>

<style scoped>
.proxy-workbench {
  height: 100%;
  min-width: 0;
  min-height: 0;
  container: proxy / inline-size;
}

.proxy-shell,
.shell-body {
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.proxy-shell {
  background: var(--app-surface-background, var(--el-bg-color));
  border-radius: var(--radius-container);
  overflow: hidden;
}

.protocol-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  padding: 0 20px;
  overflow-x: auto;
  border-bottom: 1px solid var(--el-border-color-light);
  scrollbar-width: thin;
}

.protocol-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 8px;
  min-height: 50px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.protocol-tab::after {
  position: absolute;
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  content: '';
}

.protocol-tab:hover {
  background: var(--el-fill-color-light);
}

.protocol-tab.active {
  color: var(--el-color-primary);
  font-weight: 600;
}

.protocol-tab.active::after {
  background: var(--el-color-primary);
}

.protocol-tab:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -4px;
  border-radius: 6px;
}

.protocol-tab .el-icon {
  font-size: 16px;
}

.protocol-status-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  box-sizing: border-box;
  border: 1px solid var(--el-text-color-placeholder);
  border-radius: 50%;
}

.protocol-status-dot.is-unknown { border-style: dotted; }
.protocol-status-dot.is-running { background: var(--el-color-success); border-color: var(--el-color-success); }
.protocol-status-dot.is-error { background: var(--el-color-danger); border-color: var(--el-color-danger); }

.workspace-panel {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  scrollbar-width: thin;
}

.workspace-panel:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.workspace-body {
  padding: 20px 32px 20px 20px;
}

@container proxy (max-width: 560px) {
  .protocol-tabs { gap: 0; padding: 0 8px; }
  .protocol-tab { gap: 6px; padding: 0 10px; min-height: 46px; }
  .workspace-body { padding: 16px 32px 16px 12px; }
}
</style>
