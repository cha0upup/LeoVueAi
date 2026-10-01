<template>
  <section
    class="sessions-panel"
    aria-labelledby="live-sessions-title"
  >
    <header class="sessions-header">
      <div class="sessions-heading">
        <span
          class="sessions-icon"
          aria-hidden="true"
        >
          <el-icon><Icon :icon="iconMap.session" /></el-icon>
        </span>
        <div>
          <span class="sessions-kicker">Live Sessions</span>
          <h3 id="live-sessions-title">
            存活会话
          </h3>
        </div>
      </div>
      <StatusIndicator
        :status="sessions.length ? 'online' : 'offline'"
        :label="sessions.length ? `${sessions.length} 个在线` : '暂无在线会话'"
        compact
      />
    </header>

    <div
      v-if="sessions.length"
      class="session-list"
      aria-label="当前主机的在线会话"
    >
      <div
        class="session-list__head"
        aria-hidden="true"
      >
        <span>会话标识</span>
        <span>最近活跃</span>
        <span>能力</span>
        <span class="u-sr-only">操作</span>
      </div>
      <article
        v-for="session in sessions"
        :key="session.sessionId"
        class="session-row"
        :class="{ 'is-active': activeSessionId === session.sessionId }"
      >
        <button
          type="button"
          class="session-main"
          :aria-label="`选择会话 ${session.sessionId}`"
          @click="$emit('select', session)"
        >
          <span
            class="session-state"
            aria-hidden="true"
          />
          <span class="session-identity">
            <strong>{{ shortSessionId(session.sessionId) }}</strong>
            <code :title="session.sessionId">{{ session.sessionId }}</code>
          </span>
        </button>

        <span class="session-active-time">
          {{ formatRelativeTime(session.lastActiveTime || session.updateTime) }}
        </span>
        <span class="session-capabilities">
          {{ session.capabilities?.length || 0 }} 项
        </span>

        <div class="session-actions">
          <el-tooltip
            content="进入现有会话"
            placement="top"
          >
            <button
              type="button"
              class="session-action is-primary"
              :aria-label="`进入会话 ${session.sessionId}`"
              @click="$emit('open', session)"
            >
              <el-icon><Icon :icon="iconMap.arrowRight" /></el-icon>
            </button>
          </el-tooltip>
          <el-tooltip
            content="关闭会话"
            placement="top"
          >
            <button
              type="button"
              class="session-action is-danger"
              :disabled="deletingSessionIds.includes(session.sessionId)"
              :aria-label="`关闭会话 ${session.sessionId}`"
              @click="$emit('delete', session)"
            >
              <el-icon
                :class="{ 'u-spin': deletingSessionIds.includes(session.sessionId) }"
              >
                <Icon :icon="deletingSessionIds.includes(session.sessionId) ? iconMap.loading : iconMap.delete" />
              </el-icon>
            </button>
          </el-tooltip>
        </div>
      </article>
    </div>

    <div
      v-else
      class="session-empty"
    >
      <span class="session-empty__icon">
        <el-icon><Icon :icon="iconMap.session" /></el-icon>
      </span>
      <div>
        <strong>当前没有存活会话</strong>
        <p>进入控制台后，新会话会自动挂载到这台主机下。</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue'

import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { icons } from '@/utils/icons.js'

defineProps({
  sessions: {
    type: Array,
    default: () => []
  },
  activeSessionId: {
    type: String,
    default: ''
  },
  deletingSessionIds: {
    type: Array,
    default: () => []
  }
})

defineEmits(['select', 'open', 'delete'])

const iconMap = icons

const shortSessionId = (sessionId) => {
  const value = String(sessionId || '')
  return value ? `会话 ${value.slice(0, 8)}` : '未命名会话'
}

const formatRelativeTime = (timestamp) => {
  const time = Number(timestamp)
  if (!time || Number.isNaN(time)) return '活跃时间未知'
  const delta = Math.max(0, Date.now() - time)
  if (delta < 60000) return '刚刚活跃'
  if (delta < 3600000) return `${Math.floor(delta / 60000)} 分钟前`
  if (delta < 86400000) return `${Math.floor(delta / 3600000)} 小时前`
  return `${Math.floor(delta / 86400000)} 天前`
}
</script>

<style scoped>
.sessions-panel {
  margin: 0 16px 12px;
  border-top: 1px solid var(--app-divider-color);
  border-bottom: 1px solid var(--app-divider-color);
  background: var(--app-container-background);
}

.sessions-header {
  min-height: 48px;
  padding: 8px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sessions-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}

.sessions-icon,
.session-empty__icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-control);
  color: var(--el-color-primary);
  background: var(--app-selected-background);
}

.sessions-kicker {
  display: block;
  color: var(--el-text-color-placeholder);
  font-family: var(--font-family-code);
  font-size: 10px;
  line-height: 1.2;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sessions-heading h3 {
  margin: 1px 0 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.25;
}

.session-list {
  padding: 0 0 8px;
}

.session-list__head,
.session-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 88px 64px 64px;
  align-items: center;
}

.session-list__head {
  min-height: 28px;
  padding: 0 8px 0 12px;
  border-top: 1px solid var(--app-divider-color);
  border-bottom: 1px solid var(--app-divider-color);
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 600;
}

.session-row {
  min-width: 0;
  min-height: 48px;
  border-bottom: 1px solid var(--app-divider-color);
  background: transparent;
  transition: background var(--motion-fast);
}

.session-row:hover {
  background: var(--app-hover-background);
}

.session-row.is-active {
  background: var(--app-selected-background);
  box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.session-main {
  min-width: 0;
  flex: 1;
  align-self: stretch;
  padding: 6px 10px 6px 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.session-main:focus-visible,
.session-action:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-outline-offset);
}

.session-state {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--el-color-success);
  box-shadow: 0 0 0 3px var(--status-success-bg);
}

.session-identity {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-identity strong {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.session-identity code {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-family: var(--font-family-code);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-active-time,
.session-capabilities {
  padding-right: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  white-space: nowrap;
}

.session-capabilities {
  color: var(--el-text-color-secondary);
  font-family: var(--font-family-code);
}

.session-actions {
  padding-right: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.session-action {
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.session-action:hover:not(:disabled) {
  border-color: var(--app-divider-color);
  background: var(--app-container-background);
}

.session-action.is-primary:hover:not(:disabled) {
  color: var(--el-color-primary);
}

.session-action.is-danger:hover:not(:disabled) {
  color: var(--el-color-danger);
}

.session-action:disabled {
  opacity: var(--disabled-opacity);
  cursor: not-allowed;
}

.session-empty {
  min-height: 58px;
  padding: 8px 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.session-empty strong {
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.session-empty p {
  margin: 2px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

@media (max-width: 900px) {
  .session-list__head,
  .session-row {
    grid-template-columns: minmax(160px, 1fr) 74px 56px 64px;
  }
}

@media (max-width: 720px) {
  .session-list__head,
  .session-row {
    grid-template-columns: minmax(150px, 1fr) 72px 64px;
  }

  .session-list__head span:nth-child(3),
  .session-capabilities {
    display: none;
  }
}
</style>
