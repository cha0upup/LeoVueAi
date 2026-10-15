<template>
  <div class="content-header">
    <div
      class="content-header-card chain-summary-card"
      aria-label="连接路径"
    >
      <div class="card-topline">
        <span
          v-if="hasConnectionPath"
          class="connection-mode-tag"
        >
          {{ connectionModeLabel }}
        </span>
        <el-tooltip
          v-else
          :content="connectionPathMessage"
          placement="bottom"
          effect="dark"
        >
          <span
            class="connection-path-placeholder"
            role="status"
            :aria-label="connectionPathMessage"
            tabindex="0"
          >{{ connectionPathStatus === 'loading' ? '读取中…' : '路径未知' }}</span>
        </el-tooltip>
        <el-tooltip
          v-if="cacheMode"
          content="缓存模式 — 当前展示的是离线缓存数据，部分功能不可用"
          placement="bottom"
          effect="dark"
        >
          <span class="cache-mode-chip">
            <el-icon><Icon :icon="iconMap.info" /></el-icon>
            <span>缓存只读</span>
          </span>
        </el-tooltip>
      </div>
      <div class="connection-chain">
        <template v-if="hasConnectionPath">
          <el-tooltip
            content="发起连接的控制服务端"
            placement="top"
            effect="dark"
          >
            <span
              class="control-server"
              aria-label="控制服务端"
              tabindex="0"
            >
              <el-icon><Icon :icon="iconMap.server" /></el-icon>
            </span>
          </el-tooltip>
          <template
            v-for="(link, index) in displayConnLinkChain"
            :key="`${link}-${index}`"
          >
            <span
              class="chain-arrow"
              aria-hidden="true"
            >
              <svg viewBox="0 0 28 12">
                <path d="M1 6h24m-4-4 4 4-4 4" />
              </svg>
            </span>
            <el-tooltip
              :content="getChainItemTooltip(index, link)"
              placement="top"
              effect="dark"
            >
              <span
                class="chain-item"
                :class="{
                  'chain-item--target': index === displayConnLinkChain.length - 1,
                  'chain-item--relay': index < displayConnLinkChain.length - 1
                }"
                :aria-label="getChainItemTooltip(index, link)"
                tabindex="0"
              >
                <el-icon class="link-icon">
                  <Icon :icon="getChainIcon(index, displayConnLinkChain.length)" />
                </el-icon>
                <span class="chain-link">{{ link }}</span>
              </span>
            </el-tooltip>
          </template>
        </template>

        <template v-else-if="connLink">
          <!-- A known target address alone does not establish a direct path. -->
          <el-tooltip
            :content="`当前主机连接地址 · ${connLink}；${connectionPathMessage}`"
            placement="top"
            effect="dark"
          >
            <span
              class="chain-item chain-item--pending"
              :aria-label="`当前主机连接地址 · ${connLink}；${connectionPathMessage}`"
              tabindex="0"
            >
              <el-icon class="link-icon"><Icon :icon="iconMap.server" /></el-icon>
              <span class="chain-link">{{ connLink }}</span>
            </span>
          </el-tooltip>
        </template>
      </div>
    </div>

    <!-- Global task summary chips -->
    <div
      v-if="hasTasks"
      class="task-summary"
    >
      <button
        v-if="taskSummary.running > 0"
        class="task-chip task-chip--running"
        type="button"
        :title="`${taskSummary.running} 个任务进行中`"
        @click="emit('open-task-manager')"
      >
        <span class="task-chip-dot" />
        <span class="task-chip-count">{{ taskSummary.running }}</span>
      </button>
      <button
        v-if="taskSummary.failed > 0"
        class="task-chip task-chip--failed"
        type="button"
        :title="`${taskSummary.failed} 个任务失败`"
        @click="emit('open-task-manager')"
      >
        <el-icon><Icon :icon="iconMap.warning || iconMap.info" /></el-icon>
        <span class="task-chip-count">{{ taskSummary.failed }}</span>
      </button>
      <button
        v-if="taskSummary.completed > 0"
        class="task-chip task-chip--completed"
        type="button"
        :title="`${taskSummary.completed} 个任务已完成`"
        @click="emit('open-task-manager')"
      >
        <el-icon><Icon :icon="iconMap.success || iconMap.info" /></el-icon>
        <span class="task-chip-count">{{ taskSummary.completed }}</span>
      </button>
    </div>

    <div
      class="content-header-card hostid-summary-card"
      aria-label="主机标识"
    >
      <el-tooltip
        :content="hostIdentityTooltip"
        placement="bottom-end"
        effect="dark"
      >
        <span
          class="hostid-summary-value"
          :aria-label="hostIdentityTooltip"
          tabindex="0"
        >
          <span class="hostid-summary-label">ID</span>
          <template v-if="currentHostId">
            <span class="hostid-summary-id-full">{{ currentHostId }}</span>
            <span class="hostid-summary-id-compact">{{ compactHostId }}</span>
          </template>
          <span
            v-else
            class="hostid-summary-empty"
          >—</span>
        </span>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  connLink: {
    type: String,
    default: ''
  },
  currentHostId: {
    type: String,
    default: ''
  },
  agentName: {
    type: String,
    default: ''
  },
  displayConnLinkChain: {
    type: Array,
    default: () => []
  },
  connectionPathStatus: {
    type: String,
    default: 'unavailable',
    validator: (value) => ['loading', 'ready', 'unavailable'].includes(value)
  },
  cacheMode: {
    type: Boolean,
    default: false
  },
  taskSummary: {
    type: Object,
    default: () => ({ running: 0, completed: 0, failed: 0 })
  },
  iconMap: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['open-task-manager'])

const hasTasks = computed(() =>
  (props.taskSummary?.running || 0) +
  (props.taskSummary?.completed || 0) +
  (props.taskSummary?.failed || 0) > 0
)

const hasConnectionPath = computed(() =>
  props.connectionPathStatus === 'ready' && props.displayConnLinkChain.length > 0
)

// Only intermediate hosts count as relays; the control server and target do not.
const connectionModeLabel = computed(() => {
  const relayCount = props.displayConnLinkChain.length - 1
  return relayCount > 0 ? `经 ${relayCount} 个中转` : '直连'
})

const connectionPathMessage = computed(() =>
  props.connectionPathStatus === 'loading' ? '读取连接路径…' : '连接路径暂未获取'
)

const compactHostId = computed(() => {
  const id = props.currentHostId
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
})

const hostIdentityTooltip = computed(() => [
  props.agentName,
  props.currentHostId ? `主机标识 · ${props.currentHostId}` : '主机标识暂未获取'
].filter(Boolean).join(' · '))

const getChainIcon = (index, totalLength) => {
  if (index === totalLength - 1) {
    return props.iconMap.server
  }

  return index === 0 ? props.iconMap.link : props.iconMap.connection
}

const getChainItemTooltip = (index, link) => {
  const role = index === props.displayConnLinkChain.length - 1
    ? '当前主机'
    : `中转主机 ${index + 1}`
  return `${role} · ${link}`
}
</script>

<style scoped>
.content-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
  min-height: 34px;
  padding: 4px 12px;
  box-sizing: border-box;
  background: var(--app-container-background);
  border-bottom: 1px solid var(--app-divider-color);
}

.content-header-card {
  display: flex;
  align-items: center;
  min-width: 0;
}

.chain-summary-card {
  flex: 1;
  gap: 8px;
  overflow: hidden;
}

.card-topline {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}

.connection-mode-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-tag);
  color: var(--el-text-color-secondary);
  background: var(--app-control-background);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.connection-path-placeholder {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.cache-mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 500;
  color: var(--el-color-warning-dark-2);
  background: color-mix(in srgb, var(--el-color-warning) 10%, var(--app-container-background));
  cursor: help;
  white-space: nowrap;
}

.connection-chain {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  white-space: nowrap;
}

.control-server {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
  height: 24px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.control-server .el-icon {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.chain-arrow {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 16px;
  color: color-mix(in srgb, var(--el-text-color-secondary) 50%, var(--app-container-background));
}

.chain-arrow svg {
  display: block;
  width: 100%;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chain-item {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  min-height: 24px;
  padding: 0 6px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  transition: background var(--motion-fast), border-color var(--motion-fast);
}

.chain-link {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.link-icon {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.chain-item--relay {
  background: var(--app-control-background-soft);
}

.chain-item--relay .chain-link {
  max-width: 140px;
  color: var(--el-text-color-secondary);
}

.chain-item--target {
  background: color-mix(in srgb, var(--el-color-primary) 5%, var(--app-container-background));
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--app-container-background));
}

.chain-item--target .chain-link {
  max-width: 400px;
  color: color-mix(in srgb, var(--el-color-primary) 78%, var(--el-text-color-primary));
}

.chain-item--target .link-icon {
  color: var(--el-color-primary);
}

.chain-item--pending {
  background: var(--app-control-background-soft);
}

.chain-item--pending .chain-link {
  max-width: 320px;
  color: var(--el-text-color-secondary);
}

.chain-item:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, var(--app-container-background));
  background: var(--app-hover-background);
}

.chain-item:focus-visible,
.control-server:focus-visible,
.connection-path-placeholder:focus-visible,
.hostid-summary-value:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
  border-radius: var(--radius-control);
}

.hostid-summary-card {
  flex: 0 0 auto;
  margin-left: auto;
  padding-left: 10px;
  border-left: 1px solid var(--app-divider-color);
}

.hostid-summary-value,
.hostid-summary-empty {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
}

.hostid-summary-value {
  font-family: var(--el-font-family-mono);
  cursor: help;
}

.hostid-summary-id-compact {
  display: none;
}

.hostid-summary-label {
  color: var(--el-text-color-placeholder);
  font-family: var(--el-font-family);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.03em;
}

/* Task summary chips */
.task-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.task-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--motion-fast), border-color var(--motion-fast);
  white-space: nowrap;
}

.task-chip:hover {
  filter: brightness(0.98);
  box-shadow: none;
}

.task-chip:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.task-chip--running {
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 32%, transparent);
  color: var(--el-color-primary);
}

.task-chip--running .task-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  animation: task-pulse 1.4s ease-in-out infinite;
}

.task-chip--failed {
  background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--el-color-danger) 32%, transparent);
  color: var(--el-color-danger);
}

.task-chip--completed {
  background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
  border-color: color-mix(in srgb, var(--el-color-success) 32%, transparent);
  color: var(--el-color-success);
}

.task-chip .el-icon {
  font-size: 12px;
}

.task-chip-count {
  line-height: 1;
}

@keyframes task-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(0.7); }
}

@media (max-width: 1100px) {
  .chain-item--target .chain-link,
  .chain-item--pending .chain-link {
    max-width: 240px;
  }

  .hostid-summary-id-full {
    display: none;
  }

  .hostid-summary-id-compact {
    display: inline;
  }
}

@media (max-width: 640px) {
  .content-header {
    gap: 8px;
    padding-inline: 8px;
  }

  .chain-summary-card {
    flex: 1;
    gap: 6px;
  }

  .chain-item--target .chain-link,
  .chain-item--pending .chain-link {
    max-width: 52vw;
  }

  .hostid-summary-card {
    padding-left: 8px;
  }
}
</style>
