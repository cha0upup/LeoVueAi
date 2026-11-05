<template>
  <div
    class="terminal-console"
    :class="{ 'is-sidebar-collapsed': compactSessions || !sessions.length }"
    @keydown.capture="handleShortcut"
  >
    <header class="terminal-toolbar">
      <div class="toolbar-identity">
        <slot name="toolbar-start" />
        <span class="terminal-mark"><Icon :icon="icon" /></span>
        <strong>{{ title }}</strong>
        <span
          v-if="activeSession"
          class="identity-divider"
          aria-hidden="true"
        >/</span>
        <span
          v-if="activeSession"
          class="active-session-endpoint"
          :title="activeSession.endpoint || activeSession.title"
        >{{ activeSession.endpoint || activeSession.title }}</span>
        <span
          v-if="activeSession?.connectionType === 'ssh'"
          class="relay-label"
        >
          <Icon :icon="icons.connection" /> 经 Agent
        </span>
      </div>
      <div class="toolbar-actions">
        <el-button
          v-if="sessionListToggle"
          text
          class="sidebar-toggle toolbar-icon"
          :class="{ 'is-selected': !sidebarCollapsed }"
          :disabled="!sessions.length"
          :aria-expanded="!sidebarCollapsed"
          :aria-label="sidebarCollapsed ? '展开会话列表' : '收起会话列表'"
          :title="sidebarCollapsed ? '展开会话列表' : '切换为标签视图'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <Icon :icon="icons.list" />
        </el-button>
        <span
          class="toolbar-separator"
          aria-hidden="true"
        />
        <el-button
          text
          class="toolbar-icon"
          :class="{ 'is-selected': searchVisible }"
          :disabled="!activeSession"
          aria-label="查找终端输出"
          title="查找终端输出（Ctrl/⌘+F）"
          :aria-expanded="searchVisible"
          @click="openSearch"
        >
          <Icon :icon="icons.search" />
        </el-button>
        <el-button
          text
          class="clear-button"
          :disabled="!activeSession"
          aria-label="清屏"
          title="清空显示，保留会话"
          @click="clearActiveViewport"
        >
          清屏
        </el-button>
        <el-button
          text
          class="interrupt-button"
          :disabled="!canInterrupt"
          title="中断当前命令（Ctrl+C）"
          @click="interruptActiveSession"
        >
          <Icon :icon="icons.stop" /><span>中断</span>
        </el-button>
        <el-dropdown
          trigger="click"
          @command="handleAction"
        >
          <el-button
            text
            class="toolbar-icon"
            aria-label="终端更多操作"
            title="更多操作"
          >
            <Icon :icon="icons.more" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                command="close"
                :disabled="!activeSession"
              >
                关闭当前会话
              </el-dropdown-item>
              <el-dropdown-item
                command="reset"
                divided
                :disabled="!sessions.length"
              >
                {{ resetLabel }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <slot name="actions" />
      </div>
    </header>

    <div
      class="terminal-body"
      :class="{ 'is-empty': !sessions.length }"
    >
      <TerminalSessionRail
        v-if="sessions.length"
        :sessions="sessions"
        :active-session-id="activeSessionId"
        :now="clockNow"
        :compact="compactSessions"
        @activate="activateSession"
        @close-session="removeSession"
      />
      <section
        class="terminal-stage"
        aria-label="终端输出"
      >
        <div
          v-if="searchVisible && activeSession"
          class="terminal-search"
          role="search"
          aria-label="查找终端输出"
          @keydown.esc.stop.prevent="closeSearch"
          @keydown.enter.stop.prevent="searchInActiveSession($event.shiftKey ? 'prev' : 'next')"
        >
          <el-input
            ref="searchInput"
            :model-value="searchKeyword"
            size="small"
            clearable
            placeholder="查找终端输出"
            aria-label="查找终端输出"
            @update:model-value="handleSearchKeywordChange($event || '')"
          />
          <span
            class="search-result"
            role="status"
            aria-live="polite"
          >{{
            searchResultLabel
          }}</span>
          <el-button
            text
            :disabled="!searchResult.resultCount || !searchKeyword.trim()"
            aria-label="上一个匹配"
            title="上一个匹配（Shift+Enter）"
            @click="searchInActiveSession('prev')"
          >
            <Icon :icon="icons.arrowUp" />
          </el-button>
          <el-button
            text
            :disabled="!searchResult.resultCount || !searchKeyword.trim()"
            aria-label="下一个匹配"
            title="下一个匹配（Enter）"
            @click="searchInActiveSession('next')"
          >
            <Icon :icon="icons.arrowDown" />
          </el-button>
          <el-button
            text
            aria-label="关闭查找"
            title="关闭查找（Esc）"
            @click="closeSearch"
          >
            <Icon :icon="icons.close" />
          </el-button>
        </div>
        <div
          v-if="!sessions.length"
          class="terminal-empty"
        >
          <slot name="empty">
            <h3>暂无终端会话</h3>
          </slot>
        </div>
        <TerminalViewport
          v-for="session in sessions"
          v-show="session.id === activeSessionId"
          :key="session.id"
          :ref="(instance) => setViewportRef(instance, session.id)"
          :active="session.id === activeSessionId"
          @ready="handleViewportReady(session.id)"
          @input="handleTerminalInput($event, session)"
          @resize="handleTerminalResize($event, session)"
          @activity="markSessionActive(session)"
          @search-results="handleSearchResults(session.id, $event)"
        />
        <slot
          v-if="activeSession"
          name="session-overlay"
          :session="activeSession"
        />
        <footer
          v-if="activeSession"
          class="terminal-status"
        >
          <span
            class="session-status"
            :class="{
              'is-warning':
                activeSession.routingMismatch || activeSession.ended || activeSession.processExited,
              'is-pending': activeSession.pty == null
            }"
          ><i aria-hidden="true" />{{ sessionStatus }}</span>
          <span
            class="status-divider"
            aria-hidden="true"
          />
          <span class="status-protocol">{{
            activeSession.connectionType === 'ssh' ? 'SSH' : 'Agent'
          }}</span>
          <span
            class="mode-summary"
            :title="modeSummary || activeCapability.details"
          >{{
            activeCapability.mode
          }}</span>
          <span
            class="terminal-dimensions"
            :title="activeCapability.resizeMode"
          >{{ activeSession.cols }} × {{ activeSession.rows }}</span>
          <span class="terminal-transport">{{ activeCapability.streamMode }}</span>
          <span class="terminal-last-active">交互于 {{ activeSessionTimeLabel }}</span>
          <el-popover
            placement="top-start"
            title="会话详情"
            :width="360"
            trigger="click"
          >
            <template #reference>
              <el-button
                text
                size="small"
                aria-label="查看会话详情"
              >
                详情 <Icon :icon="icons.info" />
              </el-button>
            </template>
            <dl class="session-details">
              <dt>会话 ID</dt>
              <dd>{{ activeSession.id }}</dd>
              <dt>后端</dt>
              <dd>{{ activeSession.backend }}</dd>
              <template v-if="activeSession.connectionType === 'ssh'">
                <dt>SSH 主机</dt>
                <dd>{{ activeSession.endpoint }}</dd>
              </template>
              <dt>尺寸</dt>
              <dd>{{ activeCapability.resizeMode }}</dd>
              <dt>传输方式</dt>
              <dd>{{ activeCapability.streamMode }}</dd>
              <dt>最后交互</dt>
              <dd>{{ activeSessionTimeLabel }}</dd>
            </dl>
            <p class="capability-details">
              {{ activeCapability.details }}
            </p>
          </el-popover>
          <span class="terminal-shortcut"><kbd>Ctrl+C</kbd> 中断</span>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { showSuccess } from '@/utils/messageUtils.js'
import TerminalSessionRail from './TerminalSessionRail.vue'
import TerminalViewport from './TerminalViewport.vue'
import { describeTerminalCapability } from './terminalWorkspaceModel.js'

const props = defineProps({
  sessionId: { type: String, required: true },
  workspace: { type: Object, required: true },
  title: { type: String, default: '终端' },
  icon: { type: String, default: icons.terminal },
  sessionListToggle: { type: Boolean, default: true },
  resetLabel: { type: String, default: '重置全部会话' },
  resetMessage: { type: String, default: '将关闭当前所有终端并创建一个新的会话。' }
})
const {
  sessions,
  activeSessionId,
  activeSession,
  activeSessionTimeLabel,
  clockNow,
  searchKeyword,
  setViewportRef,
  activateSession,
  removeSession,
  closeActiveSession,
  clearActiveViewport,
  interruptActiveSession,
  resetWorkspace,
  markSessionActive,
  handleViewportReady,
  handleTerminalInput,
  handleTerminalResize,
  handleSearchKeywordChange,
  searchInActiveSession,
  focusActiveViewport
} = props.workspace
const sidebarCollapsed = ref(true)
const compactSessions = computed(() => !props.sessionListToggle || sidebarCollapsed.value)
const searchVisible = ref(false)
const searchInput = ref(null)
const searchResult = ref({ resultIndex: -1, resultCount: 0 })
const activeCapability = computed(() => describeTerminalCapability(activeSession.value))
const sessionStatus = computed(() => {
  const session = activeSession.value
  if (session?.routingMismatch) return '会话路由异常'
  if (session?.ended) return '已结束'
  if (session?.processExited) return '正在结束'
  return session?.pty == null ? '初始化中' : '已就绪'
})
const canInterrupt = computed(
  () =>
    activeSession.value?.pty != null &&
    !activeSession.value.processExited &&
    !activeSession.value.ended
)
const modeSummary = computed(
  () =>
    ({
      PIPE: 'PIPE · 交互能力受限',
      PTY: activeSession.value?.resizable === false ? 'PTY · 固定尺寸' : 'PTY · 完整交互',
      COMMAND: '命令模式 · 不支持交互输入'
    })[activeCapability.value.mode] || ''
)
const searchResultLabel = computed(() => {
  if (!searchKeyword.value.trim()) return ''
  const { resultIndex, resultCount } = searchResult.value
  if (!resultCount) return '无匹配'
  return resultIndex < 0 ? `${resultCount}+ 项` : `${resultIndex + 1} / ${resultCount}`
})
function handleSearchResults(sessionId, result) {
  if (sessionId === activeSessionId.value) searchResult.value = result
}
async function openSearch() {
  if (!activeSession.value) return
  searchVisible.value = true
  await nextTick()
  searchInput.value?.focus()
  searchInput.value?.select()
}
function closeSearch() {
  searchVisible.value = false
  handleSearchKeywordChange('')
  focusActiveViewport()
}
function handleShortcut(event) {
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.key.toLowerCase() === 'f' &&
    activeSession.value
  ) {
    event.preventDefault()
    event.stopPropagation()
    openSearch()
  }
}
async function handleAction(action) {
  if (action === 'close') closeActiveSession()
  else if (action === 'reset') {
    const hostSessionId = props.sessionId
    const confirmed = await confirmAction({
      title: props.resetLabel,
      message: props.resetMessage,
      confirmButtonText: '确认'
    })
    if (!confirmed || props.sessionId !== hostSessionId) return
    await resetWorkspace()
    showSuccess('终端会话已更新')
  }
}

watch(activeSessionId, () => {
  searchVisible.value = false
  searchResult.value = { resultIndex: -1, resultCount: 0 }
})
</script>
<style scoped>
.terminal-console {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  color: var(--el-text-color-primary);
  background: var(--app-card-background);
}
.terminal-toolbar,
.toolbar-identity,
.toolbar-actions {
  display: flex;
  align-items: center;
  min-width: 0;
}
.terminal-toolbar {
  flex: 0 0 46px;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-divider-color);
}
.toolbar-identity {
  flex: 1;
  gap: 9px;
  overflow: hidden;
}
.toolbar-identity strong {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}
.terminal-mark {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 20px;
}
.identity-divider {
  color: var(--el-border-color);
}
.active-session-endpoint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-family-code);
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.relay-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.toolbar-actions {
  flex-shrink: 0;
  gap: 4px;
}
.toolbar-separator {
  height: 16px;
  margin: 0 4px;
  border-left: 1px solid var(--app-divider-color);
}
.terminal-console :deep(.el-button + .el-button) {
  margin-left: 0;
}
.terminal-console :deep(.el-button.is-text) {
  min-height: 28px;
  height: 28px;
  padding: 5px 7px;
  font-size: 12px;
}
.terminal-console :deep(.toolbar-icon) {
  width: 28px;
  padding: 5px;
}
.terminal-console :deep(.el-button .iconify) {
  font-size: 16px;
}
.terminal-console :deep(.el-button.is-selected) {
  color: var(--el-color-primary);
  background: var(--app-selected-background);
}
.interrupt-button :deep(.iconify) {
  margin-right: 3px;
}
.terminal-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: 204px minmax(0, 1fr);
}
.is-sidebar-collapsed .terminal-body {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
}
.terminal-body.is-empty {
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
}
.terminal-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #07111b;
}
.terminal-search {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 3px;
  width: min(400px, calc(100% - 28px));
  padding: 5px;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  background: var(--app-card-background);
  box-shadow: var(--shadow-overlay);
}
.terminal-search .el-input {
  flex: 1;
  min-width: 60px;
}
.search-result {
  padding: 0 3px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.terminal-status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding: 0 12px;
  font-size: 11px;
  white-space: nowrap;
  background: var(--app-card-background);
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--app-divider-color);
}
.session-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular);
}
.session-status i {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--el-color-success);
}
.session-status.is-warning {
  color: var(--el-color-warning);
}
.session-status.is-pending {
  color: var(--el-text-color-secondary);
}
.session-status.is-warning i,
.session-status.is-pending i {
  background: currentColor;
}
.status-divider {
  height: 10px;
  border-left: 1px solid var(--app-border-color);
}
.status-protocol {
  color: var(--el-text-color-regular);
  font-weight: 500;
}
.mode-summary,
.terminal-dimensions,
.terminal-transport {
  font-family: var(--font-family-code);
  font-size: 10px;
}
.terminal-last-active {
  margin-left: auto;
}
.terminal-status :deep(.el-button.is-text) {
  height: 26px;
  min-height: 26px;
  padding: 0 3px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.terminal-status :deep(.el-button .iconify) {
  font-size: 13px;
}
.terminal-shortcut {
  font-size: 10px;
}
.terminal-shortcut kbd {
  font: inherit;
}
.session-details {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 12px;
  font-size: 12px;
}
.session-details dt {
  color: var(--el-text-color-secondary);
}
.session-details dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.capability-details {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.terminal-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 32px 20px;
  color: #e6edf3;
  text-align: center;
}
.terminal-empty :deep(> .iconify) {
  color: #7dd3fc;
  font-size: 32px;
}
.terminal-empty :deep(h3) {
  margin: 12px 0 0;
  font-size: 18px;
  font-weight: 500;
}
.terminal-empty :deep(p) {
  margin: 10px 0 24px;
  color: #9aabba;
  font-size: 12px;
  line-height: 1.7;
}
@container (max-width: 660px) {
  .relay-label,
  .terminal-transport,
  .terminal-shortcut {
    display: none;
  }
  .terminal-toolbar {
    gap: 6px;
    padding-inline: 10px;
  }
  .toolbar-identity {
    gap: 7px;
  }
  .terminal-body {
    grid-template-columns: 164px minmax(0, 1fr);
  }
}
@container (max-width: 460px) {
  .active-session-endpoint,
  .identity-divider,
  .clear-button {
    display: none;
  }
  .terminal-toolbar {
    flex-basis: 42px;
    padding-inline: 8px;
  }
  .toolbar-actions {
    gap: 2px;
  }
  .toolbar-separator {
    margin-inline: 1px;
  }
  .terminal-body {
    grid-template-columns: 140px minmax(0, 1fr);
  }
  .terminal-status {
    gap: 7px;
    padding-inline: 8px;
  }
  .terminal-last-active {
    display: none;
  }
  .terminal-status :deep(.el-popover__reference) {
    margin-left: auto;
  }
}
</style>
