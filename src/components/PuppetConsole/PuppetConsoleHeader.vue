<template>
  <div class="content-header">
    <div class="content-header-card chain-summary-card">
      <div class="card-topline">
        <el-tag
          effect="light"
          type="primary"
          class="summary-tag summary-tag-primary"
        >
          {{
            chainCountLabel
          }}
        </el-tag>
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
        <el-tooltip
          content="云端服务器"
          placement="top"
          effect="dark"
        >
          <el-icon class="cloud-icon">
            <Icon :icon="iconMap.cloud" />
          </el-icon>
        </el-tooltip>

        <template v-if="displayConnLinkChain?.length">
          <el-icon class="chain-arrow">
            <Icon :icon="iconMap.arrowRight" />
          </el-icon>
          <el-tooltip
            v-for="(link, index) in displayConnLinkChain"
            :key="`${link}-${index}`"
            :content="getChainItemTooltip(index, displayConnLinkChain.length)"
            placement="top"
            effect="dark"
          >
            <span
              class="chain-item"
              :class="{
                'chain-item--target': index === displayConnLinkChain.length - 1,
                'chain-item--relay': index < displayConnLinkChain.length - 1
              }"
            >
              <el-icon class="link-icon">
                <Icon :icon="getChainIcon(index, displayConnLinkChain.length)" />
              </el-icon>
              <span
                class="chain-link"
                :title="link"
              >{{ link }}</span>
              <el-icon
                v-if="index < displayConnLinkChain.length - 1"
                class="chain-arrow"
              >
                <Icon :icon="iconMap.arrowRight" />
              </el-icon>
            </span>
          </el-tooltip>
        </template>

        <template v-else-if="connLink">
          <el-icon class="chain-arrow">
            <Icon :icon="iconMap.arrowRight" />
          </el-icon>
          <el-tooltip
            content="连接地址"
            placement="top"
            effect="dark"
          >
            <span class="chain-item">
              <el-icon class="link-icon"><Icon :icon="iconMap.link" /></el-icon>
              <span
                class="chain-link"
                :title="connLink"
              >{{ connLink }}</span>
            </span>
          </el-tooltip>
        </template>
      </div>
    </div>

    <div class="content-header-card hostid-summary-card">
      <div class="hostid-summary">
        <el-icon class="hostid-summary-icon">
          <Icon :icon="iconMap.server" />
        </el-icon>
        <div class="hostid-summary-info">
          <span
            v-if="puppetName"
            class="hostid-summary-name"
          >{{ puppetName }}</span>
          <span
            v-if="currentHostId"
            class="hostid-summary-value"
            :title="currentHostId"
          >
            {{ currentHostId }}
          </span>
          <span
            v-else
            class="hostid-summary-empty"
          >未设置</span>
        </div>
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
  puppetName: {
    type: String,
    default: ''
  },
  displayConnLinkChain: {
    type: Array,
    default: () => []
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

const chainCountLabel = computed(() => {
  if (props.displayConnLinkChain?.length) {
    return `${props.displayConnLinkChain.length + 1} 节点`
  }
  return props.connLink ? '直连' : '未连接'
})

const getChainIcon = (index, totalLength) => {
  if (index === totalLength - 1) {
    return props.iconMap.server
  }

  return index === 0 ? props.iconMap.link : props.iconMap.connection
}

const getChainItemTooltip = (index, totalLength) => {
  if (index === totalLength - 1) {
    return '当前节点（目标服务器）'
  }

  return '中转节点'
}
</script>

<style scoped>
.content-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 8px;
  overflow: hidden;
  flex-wrap: nowrap;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 22%, transparent);
}

.module-badge-card,
.module-badge-icon-wrap,
.module-badge-icon,
.module-badge-title { display: none; }

.card-topline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cache-mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
  background: color-mix(in srgb, var(--el-color-warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 28%, transparent);
  cursor: help;
  white-space: nowrap;
}

.cache-mode-chip .el-icon {
  font-size: 11px;
}

/* Task summary chips */
.task-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 6px;
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

.content-header-card {
  min-width: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  --header-soft-border: color-mix(in srgb, var(--el-border-color) 12%, transparent);
}

.chain-summary-card {
  flex: 1;
  overflow: hidden;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.hostid-summary-card {
  flex: 0 0 auto;
  max-width: 220px;
  flex-shrink: 0;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.cloud-icon {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  margin-right: 1px;
}

.connection-chain {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  flex: 1;
  flex-wrap: nowrap;
  overflow: hidden;
  white-space: nowrap;
}

.chain-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--header-soft-border);
  transition: all 0.2s ease;
  position: relative;
}

.chain-item--relay {
  opacity: 0.5;
}

.chain-item--relay .chain-link {
  color: var(--el-text-color-secondary);
  font-weight: 500;
  font-size: 9px;
  max-width: 72px;
}

.chain-item--relay .link-icon {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
}

.chain-item--target {
  background: color-mix(in srgb, var(--el-color-primary) 9%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  padding: 3px 8px;
}

.chain-item--target .chain-link {
  color: var(--el-color-primary);
  font-weight: 700;
  font-size: 11px;
  max-width: 160px;
}

.chain-item--target .link-icon {
  color: var(--el-color-primary);
  font-size: 12px;
}

.chain-item:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 3%, transparent);
  box-shadow: none;
}

.link-icon {
  font-size: 11px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.chain-link {
  font-size: 10px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chain-arrow {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  margin: 0;
  flex-shrink: 0;
}

.hostid-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 2px 0;
  flex: 1;
  justify-content: flex-start;
  border-radius: 0;
  background: transparent;
  border: 0;
}

.hostid-summary-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.hostid-summary-name {
  min-width: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hostid-summary-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  color: var(--el-color-primary);
  font-size: 12px;
  flex-shrink: 0;
  box-shadow: none;
}

:global(html.dark .content-header-card),
:global(html[data-theme='dark'] .content-header-card) {
  --header-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

.hostid-summary-value,
.hostid-summary-empty {
  min-width: 0;
  font-size: 10px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hostid-summary-value {
  font-family: 'Courier New', monospace;
  letter-spacing: 0.01em;
}

.hostid-summary-empty {
  color: var(--el-text-color-placeholder);
}

@media (max-width: 768px) {
  .content-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 8px 0;
    flex-wrap: wrap;
  }

  .content-header-card {
    padding: 0;
  }

  .chain-summary-card {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .connection-chain {
    gap: 4px;
  }

  .chain-item {
    padding: 2px 4px;
  }

  .chain-link {
    max-width: 120px;
    font-size: 12px;
  }

  .link-icon {
    font-size: 12px;
  }

  .chain-arrow {
    font-size: 11px;
  }

  .hostid-summary-card {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .hostid-summary {
    justify-content: flex-start;
  }
}
</style>
