<template>
  <aside class="terminal-rail">
    <div class="terminal-rail__head">
      <div>
        <span class="rail-title">终端会话</span>
        <span class="rail-meta">
          <template v-if="sessions.length === 0">支持多会话并行 — 点击 + 新建</template>
          <template v-else-if="sessions.length === 1">1 个会话 · 可并行新建更多</template>
          <template v-else>{{ sessions.length }} 个会话</template>
        </span>
      </div>
      <div class="rail-actions">
        <el-tooltip
          content="新建终端会话（支持多会话并行运行）"
          placement="bottom"
          :show-after="400"
        >
          <button
            type="button"
            class="rail-new-btn"
            aria-label="新建终端会话"
            @click="$emit('create-session')"
          >
            <el-icon><Icon :icon="iconMap.plus" /></el-icon>
            <span class="rail-new-label">新建</span>
          </button>
        </el-tooltip>
        <el-button
          class="rail-tool-button is-danger"
          circle
          size="small"
          aria-label="重置终端工作区"
          @click="$emit('reset-workspace')"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="terminal-rail__list">
      <!-- Empty state -->
      <div
        v-if="!sessions.length"
        class="rail-empty"
      >
        <span class="rail-empty-icon">
          <el-icon><Icon :icon="iconMap.terminal" /></el-icon>
        </span>
        <span class="rail-empty-text">暂无会话</span>
        <button
          type="button"
          class="rail-empty-btn"
          @click="$emit('create-session')"
        >
          + 新建终端会话
        </button>
      </div>
      <div
        v-for="session in sessions"
        :key="session.id"
        :class="[
          'session-card',
          { 'is-active': session.id === activeSessionId, 'has-unread': session.hasUnread }
        ]"
      >
        <button
          type="button"
          class="session-card__select"
          :aria-current="session.id === activeSessionId ? 'true' : undefined"
          @click="$emit('activate', session.id)"
        >
          <span class="session-card__head">
            <span class="session-card__title">
              <span class="session-card__name">{{ session.title }}</span>
              <span
                v-if="session.hasUnread"
                class="session-card__unread"
                aria-label="有新输出"
                title="有新输出"
              />
            </span>
          </span>

          <span class="session-card__foot">
            <span class="session-card__id">{{ session.id.slice(0, 8) }}</span>
            <span>{{ formatRelativeTime(session.lastActivityTime) }}</span>
          </span>
        </button>

        <div class="session-card__tools">
          <el-tooltip
            content="中断"
            placement="top"
            :show-after="300"
          >
            <el-button
              class="rail-tool-button is-interrupt"
              circle
              size="small"
              :aria-label="`中断终端 ${session.title || session.id}`"
              @click="$emit('interrupt-session', session.id)"
            >
              <el-icon><Icon :icon="iconMap.stop" /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip
            content="清屏"
            placement="top"
            :show-after="300"
          >
            <el-button
              class="rail-tool-button"
              circle
              size="small"
              :aria-label="`清屏 ${session.title || session.id}`"
              @click="$emit('clear-screen', session.id)"
            >
              <el-icon><Icon :icon="iconMap.remove" /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip
            content="关闭"
            placement="top"
            :show-after="300"
          >
            <el-button
              class="rail-tool-button is-close"
              circle
              size="small"
              :aria-label="`关闭终端 ${session.title || session.id}`"
              @click="$emit('close-session', session.id)"
            >
              <el-icon><Icon :icon="iconMap.close" /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { formatTerminalRelativeTime } from './terminalWorkspaceModel.js'

defineProps({
  iconMap: {
    type: Object,
    required: true
  },
  sessions: {
    type: Array,
    required: true
  },
  activeSessionId: {
    type: String,
    default: ''
  }
})

defineEmits([
  'activate',
  'create-session',
  'reset-workspace',
  'close-session',
  'interrupt-session',
  'clear-screen'
])

// Reactive tick — causes formatRelativeTime to re-evaluate every 30 s
const tick = ref(0)
let _timer = null
onMounted(() => {
  _timer = setInterval(() => {
    tick.value++
  }, 30000)
})
onUnmounted(() => {
  clearInterval(_timer)
})

const formatRelativeTime = (timestamp) => {
  void tick.value // reactive dependency
  return formatTerminalRelativeTime(timestamp)
}
</script>

<style scoped>
.terminal-rail {
  --workspace-surface: var(--app-card-background);
  --workspace-muted-surface: var(--app-control-background-soft);
  --workspace-control-surface: var(--app-control-background);
  --workspace-soft-border: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  padding: 8px 7px;
  border-radius: 0;
  border: 0;
  border-right: 1px solid color-mix(in srgb, var(--el-border-color) 24%, transparent);
  background: color-mix(in srgb, var(--workspace-muted-surface) 66%, transparent);
  overflow: hidden;
}

.terminal-rail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--workspace-soft-border) 76%, transparent);
}

.terminal-rail__head > div:first-child {
  min-width: 0;
}

.rail-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.rail-new-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 26px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 34%, transparent);
  background: color-mix(in srgb, var(--workspace-surface) 82%, transparent);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    border-color 0.15s;
  height: 26px;
}

.rail-new-btn:hover {
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, transparent);
}

.rail-new-btn .el-icon {
  font-size: 14px;
}

.rail-new-label {
  display: none;
  line-height: 1;
  white-space: nowrap;
}

.rail-title {
  display: block;
  font-size: 12px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.rail-meta {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-rail__list {
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 3px;
  overflow: auto;
  padding-right: 0;
}

.rail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 10px;
  border: 1px dashed color-mix(in srgb, var(--el-border-color) 55%, transparent);
  border-radius: 8px;
  text-align: center;
}

.rail-empty-icon {
  font-size: 22px;
  opacity: 0.45;
  display: flex;
  justify-content: center;
}

.rail-empty-text {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.rail-empty-btn {
  margin-top: 4px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--workspace-soft-border) 92%, transparent);
  background: var(--workspace-control-surface);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.rail-empty-btn:hover {
  background: var(--app-control-background-hover);
}

.session-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  min-height: 58px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  overflow: hidden;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.session-card:hover {
  border-color: transparent;
  background: color-mix(in srgb, var(--workspace-surface) 72%, transparent);
}

.session-card.is-active {
  border-color: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--workspace-surface));
  box-shadow: inset 2px 0 0 var(--el-color-primary);
}

.session-card:focus-within {
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  box-shadow: inset 2px 0 0 var(--el-color-primary);
}

.session-card__select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  min-height: 56px;
  display: grid;
  align-content: center;
  gap: 8px;
  padding: 6px 7px 6px 9px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.session-card__head,
.session-card__title,
.session-card__tools,
.session-card__foot {
  display: flex;
  align-items: center;
}

.session-card__head {
  padding-right: 70px;
  min-width: 0;
}

.session-card__title {
  flex: 1 1 auto;
  gap: 6px;
  min-width: 0;
}

.session-card__unread {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--el-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 13%, transparent);
}

.session-card__name {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-card__tools {
  position: absolute;
  top: 6px;
  right: 6px;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
}

.session-card:hover .session-card__tools,
.session-card.is-active .session-card__tools {
  opacity: 1;
  pointer-events: auto;
}

.session-card__foot {
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.session-card.is-active .session-card__foot,
.session-card:hover .session-card__foot {
  padding-right: 0;
}

.session-card__id {
  max-width: 74px;
  font-family: var(--app-font-mono, 'SFMono-Regular', Consolas, monospace);
  color: var(--el-text-color-secondary);
}

.session-card__foot span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal-rail :deep(.el-button.el-button--small) {
  height: 22px;
  min-height: 22px;
  width: 22px;
  border-radius: 5px;
}

.terminal-rail :deep(.el-button + .el-button) {
  margin-left: 0;
}

.rail-tool-button.is-interrupt,
.rail-tool-button.is-close,
.rail-tool-button.is-danger {
  --el-button-text-color: var(--el-color-danger);
  --el-button-border-color: color-mix(in srgb, var(--el-color-danger) 24%, transparent);
  --el-button-bg-color: color-mix(
    in srgb,
    var(--el-color-danger) 7%,
    var(--workspace-control-surface)
  );
  --el-button-hover-text-color: var(--el-color-danger);
  --el-button-hover-border-color: color-mix(in srgb, var(--el-color-danger) 38%, transparent);
  --el-button-hover-bg-color: color-mix(
    in srgb,
    var(--el-color-danger) 11%,
    var(--workspace-control-surface)
  );
  --el-button-active-text-color: var(--el-color-danger-dark-2);
  --el-button-active-border-color: color-mix(in srgb, var(--el-color-danger) 44%, transparent);
  --el-button-active-bg-color: color-mix(
    in srgb,
    var(--el-color-danger) 14%,
    var(--workspace-control-surface)
  );
}

:global(html:not(.dark) .terminal-rail) {
  --workspace-surface: var(--app-card-background);
  --workspace-muted-surface: var(--app-control-background-soft);
  --workspace-control-surface: var(--app-control-background);
  --workspace-soft-border: color-mix(in srgb, var(--el-border-color) 20%, transparent);
}

@media (max-width: 1100px) {
  .terminal-rail {
    grid-template-rows: auto auto;
    padding: 8px;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 24%, transparent);
  }

  .terminal-rail__list {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    overflow: visible;
  }
}
</style>
