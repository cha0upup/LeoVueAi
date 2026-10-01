<template>
  <aside
    class="terminal-rail"
    aria-label="终端会话列表"
  >
    <div class="rail-heading">
      <strong>会话</strong><span>{{ sessions.length }}</span>
    </div>
    <div class="session-list">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        :class="{ 'is-active': session.id === activeSessionId }"
      >
        <button
          type="button"
          class="session-select"
          :aria-current="session.id === activeSessionId ? 'true' : undefined"
          @click="$emit('activate', session.id)"
        >
          <span class="session-title">{{ session.title
          }}<i
            v-if="session.hasUnread"
            class="unread-dot"
            aria-label="有新输出"
            title="有新输出"
          /></span>
          <span class="session-meta">{{
            session.ended ? '已结束' : formatTerminalRelativeTime(session.lastActivityTime, now)
          }}</span>
        </button>
        <el-button
          text
          size="small"
          class="session-close"
          :aria-label="`关闭${session.title}`"
          :title="`关闭${session.title}`"
          @click="$emit('close-session', session.id)"
        >
          <Icon :icon="icons.close" />
        </el-button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatTerminalRelativeTime } from './terminalWorkspaceModel.js'

defineProps({
  sessions: { type: Array, required: true },
  activeSessionId: { type: String, default: '' },
  now: { type: Number, required: true }
})
defineEmits(['activate', 'close-session'])
</script>

<style scoped>
.terminal-rail {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--app-control-background-soft);
}
.rail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 12px;
  font-size: 12px;
}
.rail-heading span {
  color: var(--el-text-color-secondary);
}
.session-list {
  min-height: 0;
  overflow-y: auto;
}
.session-item {
  position: relative;
  margin-bottom: 4px;
  border-radius: 6px;
}
.session-item:hover {
  background: var(--app-control-background);
}
.session-item.is-active {
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--app-card-background));
  box-shadow: inset 2px 0 var(--el-color-primary);
}
.session-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 10px 34px 10px 10px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.session-select:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.session-title {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
}
.session-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.unread-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
.session-close {
  position: absolute;
  right: 4px;
  top: 5px;
  opacity: 0;
}
.session-item:hover .session-close,
.session-item:focus-within .session-close {
  opacity: 1;
}
@media (hover: none) {
  .session-close {
    opacity: 1;
  }
}
</style>
