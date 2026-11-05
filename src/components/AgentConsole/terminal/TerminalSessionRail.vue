<template>
  <aside
    class="terminal-rail"
    :class="{ 'is-compact': compact }"
    aria-label="终端会话列表"
  >
    <div class="rail-heading">
      <span>会话</span>
      <span class="session-count">{{ sessions.length }}</span>
    </div>
    <div
      ref="sessionList"
      class="session-list"
    >
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        :class="{ 'is-active': session.id === activeSessionId, 'is-ended': session.ended }"
      >
        <button
          type="button"
          class="session-select"
          :aria-current="session.id === activeSessionId ? 'true' : undefined"
          :title="`${session.connectionType === 'ssh' ? 'SSH' : 'Agent'} · ${session.endpoint || session.title}${session.ended ? ' · 已结束' : ''}`"
          @click="$emit('activate', session.id)"
        >
          <Icon
            class="session-icon"
            :icon="session.connectionType === 'ssh' ? icons.connection : icons.terminal"
          />
          <span class="session-copy">
            <span class="session-title">
              <span class="session-name">{{ session.title }}</span>
              <i
                v-if="session.hasUnread"
                class="unread-dot"
                aria-label="有新输出"
                title="有新输出"
              />
            </span>
            <span class="session-meta">{{ session.ended ? '已结束' : (session.endpoint || formatTerminalRelativeTime(session.lastActivityTime, now)) }}</span>
          </span>
          <span
            class="session-kind"
            :class="{ 'is-ssh': session.connectionType === 'ssh' }"
          >{{ session.connectionType === 'ssh' ? 'SSH' : 'Agent' }}</span>
          <span
            v-if="compact && session.ended"
            class="ended-label"
          >已结束</span>
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
import { nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { formatTerminalRelativeTime } from './terminalWorkspaceModel.js'

const props = defineProps({
  sessions: { type: Array, required: true },
  activeSessionId: { type: String, default: '' },
  now: { type: Number, required: true },
  compact: { type: Boolean, default: true }
})
defineEmits(['activate', 'close-session'])
const sessionList = ref(null)
watch(() => [props.activeSessionId, props.compact], async () => {
  await nextTick()
  sessionList.value?.querySelector?.('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}, { immediate: true })
</script>

<style scoped>
.terminal-rail {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--app-divider-color);
  background: var(--app-surface-background-soft);
}
.rail-heading { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; height: 38px; padding: 0 14px; font-size: 11px; font-weight: 500; color: var(--el-text-color-secondary); }
.session-count { display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 3px; border: 1px solid var(--app-divider-color); border-radius: 4px; font-family: var(--font-family-code); font-size: 10px; }
.session-list { min-height: 0; min-width: 0; overflow-y: auto; padding: 0 6px 6px; scrollbar-width: thin; }
.session-item { position: relative; margin-bottom: 3px; border: 1px solid transparent; border-radius: 5px; }
.session-item:hover { background: var(--app-control-background-hover); }
.session-item.is-active { border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--app-divider-color)); background: var(--app-card-background); box-shadow: inset 2px 0 var(--el-color-primary); }
.session-select {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 10px 28px 10px 8px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.session-select:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.session-icon { flex-shrink: 0; font-size: 16px; color: var(--el-text-color-secondary); }
.is-active .session-icon { color: var(--el-color-primary); }
.session-copy { flex: 1; min-width: 0; }
.session-title { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; }
.session-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.is-active .session-name { font-weight: 500; color: var(--el-text-color-primary); }
.session-meta { display: block; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; color: var(--el-text-color-secondary); }
.session-kind { flex-shrink: 0; padding: 2px 4px; border-radius: 3px; background: var(--app-control-background); font-size: 9px; line-height: 1.3; color: var(--el-text-color-secondary); }
.session-kind.is-ssh { background: color-mix(in srgb, var(--el-color-primary) 8%, transparent); color: var(--el-color-primary); }
.unread-dot { flex-shrink: 0; width: 5px; height: 5px; border-radius: 50%; background: var(--el-color-primary); }
.session-close { position: absolute; top: 50%; right: 3px; transform: translateY(-50%); width: 22px; height: 22px; min-height: 22px; padding: 3px; opacity: 0; }
.session-close :deep(.iconify) { font-size: 13px; }
.session-item:hover .session-close, .session-item:focus-within .session-close, .session-item.is-active .session-close { opacity: 1; }
.is-ended .session-icon, .is-ended .session-name { color: var(--el-text-color-secondary); }
.is-ended .session-meta, .ended-label { color: var(--el-color-warning); }
.is-compact { border-right: 0; border-bottom: 1px solid var(--app-divider-color); }
.is-compact .rail-heading { display: none; }
.is-compact .session-list { display: flex; gap: 2px; overflow-x: auto; overflow-y: hidden; padding: 0 8px; scrollbar-width: thin; }
.is-compact .session-item { flex: 0 0 auto; max-width: 260px; margin: 0; border-width: 0 1px; border-color: transparent; border-radius: 0; }
.is-compact .session-item.is-active { border-color: var(--app-divider-color); background: var(--app-card-background); box-shadow: inset 0 -2px var(--el-color-primary); }
.is-compact .session-select { gap: 7px; height: 38px; padding: 0 31px 0 10px; }
.is-compact .session-copy { flex: 0 1 auto; }
.is-compact .session-meta { display: none; }
.is-compact .session-kind { order: -1; background: transparent; padding: 0; font-size: 9px; }
.is-compact .session-icon { display: none; }
.is-compact .session-name { max-width: 165px; }
.is-compact .session-close { right: 4px; }
.ended-label { font-size: 10px; }
@media (hover: none) { .session-close { opacity: 1; } }
</style>
