<template>
  <div class="proxy-workbench">
    <div class="proxy-shell">
      <div class="shell-body">
        <aside class="protocol-rail">
          <button
            v-for="protocol in availableProxyProtocols"
            :key="protocol.value"
            type="button"
            class="protocol-item"
            :class="{ active: activeProxyType === protocol.value }"
            @click="activeProxyType = protocol.value"
          >
            <div class="protocol-item-top">
              <span class="protocol-icon-shell">
                <el-icon>
                  <Icon :icon="protocol.icon" />
                </el-icon>
              </span>
            </div>
            <div class="protocol-main">
              <strong class="protocol-title">{{ protocol.label }}</strong>
              <span
                class="protocol-status"
                :class="`is-${getProtocolTagType(protocol.value)}`"
              >
                {{ getProtocolStatusLabel(protocol.value) }}
              </span>
            </div>
            <div class="protocol-meta">
              <span>{{ getProtocolMeta(protocol.value) }}</span>
            </div>
          </button>
        </aside>

        <section class="workspace-panel">
          <div class="workspace-body">
            <Socks5Proxy
              v-if="activeProxyType === 'socks5'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyStatus('socks5', status)"
              @metrics-change="(payload) => updateProxyMetrics('socks5', payload)"
            />
            <HttpProxy
              v-else-if="activeProxyType === 'http'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyStatus('http', status)"
              @metrics-change="(payload) => updateProxyMetrics('http', payload)"
            />
            <LocalForward
              v-else-if="activeProxyType === 'forward'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyStatus('forward', status)"
              @rules-change="updateForwardRules"
            />
            <ReverseTunnel
              v-else-if="activeProxyType === 'reverse'"
              :session-id="sessionId"
              @status-change="(status) => updateProxyStatus('reverse', status)"
              @rules-change="updateReverseTunnelRules"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, unref, watch } from 'vue'
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

const updateProxyStatus = (type, status) => {
  const current = proxyState.value[type] || {}
  proxyState.value[type] = { ...current, status }
}

const updateProxyMetrics = (type, payload) => {
  const current = proxyState.value[type] || {}
  proxyState.value[type] = { ...current, ...payload }
}

const updateForwardRules = (count) => {
  proxyState.value.forward = {
    ...proxyState.value.forward,
    rulesCount: count
  }
}

const updateReverseTunnelRules = (count) => {
  proxyState.value.reverse = {
    ...proxyState.value.reverse,
    rulesCount: count
  }
}

const getProtocolTagType = (type) => {
  const status = proxyState.value[type]?.status
  if (status === 'running') return 'success'
  if (status === 'error') return 'danger'
  if (status === 'stopped') return 'info'
  return 'info'
}

const getProtocolStatusLabel = (type) => {
  const status = proxyState.value[type]?.status
  if (status === 'running') return '运行中'
  if (status === 'error') return '异常'
  if (status === 'stopped') return '未启动'
  return '待检查'
}

const getProtocolMeta = (type) => {
  const current = proxyState.value[type] || {}
  if (type === 'socks5' && current.status === 'running') {
    return `端口 ${current.port || '-'} · ${current.activeConnections || 0} 活跃连接`
  }
  if (type === 'http' && current.status === 'running') {
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
  return '进入工作区配置监听与状态'
}
</script>

<style scoped>
.proxy-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.proxy-shell {
  --proxy-shell-surface: color-mix(
    in srgb,
    var(--app-surface-background) 94%,
    var(--el-bg-color-overlay)
  );
  --proxy-shell-soft-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --proxy-shell-muted-surface: color-mix(
    in srgb,
    var(--app-control-background) 92%,
    var(--el-bg-color-overlay)
  );
  --proxy-shell-border: color-mix(in srgb, var(--el-border-color) 36%, transparent);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-container);
  background: var(--proxy-shell-surface);
  overflow: hidden;
}

:global(html:not(.dark) .proxy-shell),
:global(html[data-theme='light'] .proxy-shell) {
  --proxy-shell-surface: var(--app-surface-background);
  --proxy-shell-soft-surface: #f4f4f3;
  --proxy-shell-muted-surface: #fafaf9;
  --proxy-shell-border: color-mix(in srgb, var(--el-border-color) 78%, transparent);
}

.shell-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  background: var(--proxy-shell-muted-surface);
}

.protocol-rail,
.workspace-panel {
  min-height: 0;
}

.protocol-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.protocol-item {
  width: 100%;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: var(--radius-container);
  border: 1px solid var(--proxy-shell-border);
  background: color-mix(in srgb, var(--proxy-shell-surface) 92%, var(--proxy-shell-soft-surface));
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
}

.protocol-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 4%, var(--proxy-shell-surface));
}

.protocol-item.active {
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--proxy-shell-surface));
}

.protocol-item-top {
  display: flex;
  align-items: center;
  justify-content: center;
}

.protocol-icon-shell {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, white);
  color: var(--el-color-primary);
  font-size: 17px;
}

.protocol-main {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.protocol-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
  min-width: 0;
}

.protocol-meta {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.protocol-status {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
}

.protocol-status.is-success {
  color: var(--el-color-success);
}

.protocol-status.is-warning {
  color: var(--el-color-warning);
}

.protocol-status.is-danger {
  color: var(--el-color-danger);
}

.protocol-status.is-info {
  color: var(--el-color-info);
}

.protocol-meta {
  grid-column: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-item.active .protocol-title,
.protocol-item.active .protocol-meta {
  color: var(--el-text-color-primary);
}

.workspace-panel {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-container);
  border: 1px solid var(--proxy-shell-border);
  background: var(--proxy-shell-surface);
  overflow: hidden;
}

.workspace-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}

@media (max-width: 980px) {
  .shell-body {
    grid-template-columns: 1fr;
  }

  .protocol-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .protocol-rail {
    grid-template-columns: 1fr;
  }

  .shell-body,
  .workspace-body {
    padding: 12px;
  }
}
</style>
