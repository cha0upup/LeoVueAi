<template>
  <section class="info-grid">
    <article class="info-panel">
      <div class="panel-title">
        节点信息
      </div>
      <div class="kv-table">
        <div class="kv-row">
          <span>父节点</span>
          <strong>{{ puppet.parentPuppetId || 'root' }}</strong>
        </div>
        <div class="kv-row">
          <span>备注</span>
          <strong>{{ puppet.remark || '-' }}</strong>
        </div>
        <div class="kv-row">
          <span>创建</span>
          <strong>{{ formatDate(puppet.createTime) }}</strong>
        </div>
        <div class="kv-row">
          <span>更新</span>
          <strong>{{ formatDate(puppet.updateTime) }}</strong>
        </div>
      </div>
    </article>

    <article class="info-panel">
      <div class="panel-title">
        网络与代理
      </div>
      <div class="kv-table">
        <div class="kv-row">
          <span>协议</span>
          <strong class="protocol-value">
            <i
              class="protocol-dot"
              :class="protocolClass"
            />
            {{ protocolLabel }}
          </strong>
        </div>
        <div class="kv-row">
          <span>代理</span>
          <button
            class="quick-switch"
            :class="{ active: puppet.proxyEnabled, loading: isQuickSaving('proxyEnabled') }"
            type="button"
            :disabled="isQuickSaving('proxyEnabled')"
            :title="puppet.proxyEnabled ? '点击关闭代理' : '点击开启代理'"
            @click="emit('toggle-quick-config', 'proxyEnabled')"
          >
            <i />
            <strong>{{ puppet.proxyEnabled ? '已启用' : '未启用' }}</strong>
          </button>
        </div>
        <div class="kv-row">
          <span>类型</span>
          <strong>{{ puppet.proxyType || 'direct' }}</strong>
        </div>
        <div class="kv-row">
          <span>地址</span>
          <strong>{{ puppet.proxyHost ? `${puppet.proxyHost}:${puppet.proxyPort || '-'}` : '-' }}</strong>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatDate } from '@/utils/format.js'
import { isPuppetQuickSaving } from './puppetDetailUtils.js'

const props = defineProps({
  puppet: {
    type: Object,
    required: true
  },
  quickSavingKey: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['toggle-quick-config'])

const isQuickSaving = (field) => isPuppetQuickSaving(props.puppet, props.quickSavingKey, field)

const protocolLabel = computed(() => {
  const map = {
    http: 'HTTP',
    websocket: 'WebSocket',
    httpChunked: 'HTTP Chunked'
  }
  return map[props.puppet.protocol] || props.puppet.protocol || 'HTTP'
})

const protocolClass = computed(() => {
  const p = props.puppet.protocol
  if (p === 'websocket') return 'ws'
  if (p === 'httpChunked') return 'chunked'
  return 'http'
})
</script>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 20px;
}

.info-panel {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--pm-border);
  border-radius: var(--app-panel-radius);
  background: var(--pm-panel-strong);
}

.panel-title {
  position: relative;
  margin-bottom: 8px;
  padding-left: 12px;
  color: var(--pm-ink);
  font-size: 13px;
  font-weight: 800;
}

.panel-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: var(--el-color-primary);
}

.kv-table {
  display: grid;
}

.kv-row {
  display: grid;
  grid-template-columns: minmax(64px, 0.28fr) minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 28px;
  padding: 4px 0;
  border-bottom: 1px solid var(--pm-border);
}

.kv-row:last-child {
  border-bottom: 0;
}

.kv-row span {
  color: var(--pm-muted);
  font-size: 11px;
}

.kv-row strong,
.kv-row code {
  min-width: 0;
  color: var(--pm-ink);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;
}

.kv-row code {
  font-family: var(--el-font-family-mono);
  font-weight: 600;
}

.quick-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-self: start;
  min-width: 78px;
  height: 26px;
  padding: 0 10px 0 3px;
  border-radius: 999px;
  background: var(--pm-panel-soft);
  color: var(--pm-muted);
  border: 1px solid var(--pm-border);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease,
    opacity 0.16s ease;
}

.quick-switch:hover {
  border-color: color-mix(in srgb, var(--pm-blue) 34%, transparent);
  box-shadow: none;
}

.quick-switch:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--pm-blue) 34%, transparent);
  outline-offset: 2px;
}

.quick-switch:disabled {
  cursor: wait;
  opacity: 0.72;
}

.quick-switch i {
  position: relative;
  width: 34px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--pm-placeholder);
  box-shadow: inset 0 1px 2px rgba(24, 38, 65, 0.12);
}

.quick-switch i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--pm-panel-strong);
  box-shadow: 0 1px 3px rgba(24, 38, 65, 0.2);
  transition: transform 0.16s ease;
}

.quick-switch strong {
  color: currentColor;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.quick-switch.active {
  background: color-mix(in srgb, var(--pm-blue) 11%, var(--pm-panel-strong));
  color: var(--pm-blue);
  border-color: color-mix(in srgb, var(--pm-blue) 28%, transparent);
}

.quick-switch.active i {
  background: var(--pm-blue);
}

.quick-switch.active i::after {
  transform: translateX(16px);
}

.quick-switch.loading i::after {
  box-shadow:
    0 1px 3px rgba(24, 38, 65, 0.2),
    0 0 0 3px rgba(255, 255, 255, 0.42);
}

.protocol-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.protocol-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.protocol-dot.http {
  background: var(--el-color-info);
}

.protocol-dot.ws {
  background: var(--pm-blue);
}

.protocol-dot.chunked {
  background: var(--el-color-warning);
}

@media (max-width: 1100px) {
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .info-grid,
  .kv-row {
    grid-template-columns: 1fr;
  }

  .info-grid {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
