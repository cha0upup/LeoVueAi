<template>
  <div
    class="terminal-console"
    :class="{ 'is-sidebar-collapsed': sidebarCollapsed || !sessions.length }"
    @keydown.capture="handleShortcut"
  >
    <header class="terminal-toolbar">
      <div class="toolbar-identity">
        <el-button
          text
          class="sidebar-toggle"
          :disabled="!sessions.length"
          :aria-expanded="!sidebarCollapsed"
          :aria-label="sidebarCollapsed ? '展开会话列表' : '收起会话列表'"
          :title="sidebarCollapsed ? '展开会话列表' : '收起会话列表'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <Icon :icon="icons.menu" />
        </el-button>
        <strong class="active-session-title">{{ activeSession?.title || '终端' }}</strong>
        <el-select
          v-if="sessions.length"
          :model-value="activeSessionId"
          class="compact-session-picker"
          aria-label="切换终端会话"
          @change="activateSession"
        >
          <el-option
            v-for="session in sessions"
            :key="session.id"
            :value="session.id"
            :label="`${session.title}${session.ended ? ' · 已结束' : ''}${session.hasUnread ? ' · 有新输出' : ''}`"
          />
        </el-select>
      </div>
      <div class="toolbar-actions">
        <el-dropdown
          v-if="terminalModeOptions.length"
          trigger="click"
          @command="createSession"
        >
          <el-button
            size="small"
            aria-label="新建终端，选择模式"
          >
            <Icon :icon="icons.plus" /> 新建 <Icon :icon="icons.arrowDown" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="option in terminalModeOptions"
                :key="option.value"
                :command="option.value"
                :disabled="option.disabled"
              >
                {{ option.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          v-else
          size="small"
          @click="createSession()"
        >
          <Icon :icon="icons.plus" /> 新建
        </el-button>
        <el-button
          text
          :disabled="!activeSession"
          aria-label="查找终端输出"
          title="查找终端输出（Ctrl/⌘+F）"
          :aria-expanded="searchVisible"
          @click="openSearch"
        >
          <Icon :icon="icons.search" />
        </el-button>
        <el-button
          size="small"
          :disabled="!canInterrupt"
          title="中断当前命令（Ctrl+C）"
          @click="interruptActiveSession"
        >
          <Icon :icon="icons.stop" /> 中断
        </el-button>
        <el-dropdown
          trigger="click"
          @command="handleAction"
        >
          <el-button
            text
            aria-label="终端更多操作"
            title="更多操作"
          >
            <Icon :icon="icons.more" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                command="clear"
                :disabled="!activeSession"
              >
                清屏
              </el-dropdown-item>
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
                重置全部会话
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="terminal-body">
      <TerminalSessionRail
        :sessions="sessions"
        :active-session-id="activeSessionId"
        :now="clockNow"
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
          <Icon :icon="icons.terminal" />
          <h3>暂无终端会话</h3>
          <p>新建一个会话开始操作。</p>
          <el-button
            type="primary"
            @click="createSession()"
          >
            <Icon :icon="icons.plus" /> 新建终端
          </el-button>
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
        <footer
          v-if="activeSession"
          class="terminal-status"
        >
          <span
            class="session-status"
            :class="{ 'is-warning': activeSession.routingMismatch || activeSession.ended }"
          ><i aria-hidden="true" />{{ sessionStatus }}</span>
          <span
            v-if="modeSummary"
            class="mode-summary"
          >{{ modeSummary }}</span>
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
          <span class="terminal-shortcut">Ctrl+C 中断</span>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onUnmounted, ref, toRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { execCommandApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import TerminalSessionRail from './TerminalSessionRail.vue'
import TerminalViewport from './TerminalViewport.vue'
import { describeTerminalCapability } from './terminalWorkspaceModel.js'
import { useTerminalWorkspace } from './useTerminalWorkspace.js'

const props = defineProps({ sessionId: { type: String, required: true } })
const updateSidebarBadge = inject('updateSidebarBadge', () => {})
const runtime = inject('puppetRuntime', ref('java'))
const {
  sessions,
  activeSessionId,
  activeSession,
  activeSessionTimeLabel,
  clockNow,
  terminalModeOptions,
  searchKeyword,
  setViewportRef,
  createSession,
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
} = useTerminalWorkspace({
  hostSessionId: toRef(props, 'sessionId'),
  runtime,
  executeCommand: execCommandApi,
  onError: showError
})
const sidebarCollapsed = ref(true)
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
  if (action === 'clear') clearActiveViewport()
  else if (action === 'close') closeActiveSession()
  else if (action === 'reset') {
    const hostSessionId = props.sessionId
    const confirmed = await confirmAction({
      title: '重置全部会话',
      message: '将关闭当前所有终端并创建一个新的会话。',
      confirmButtonText: '重置'
    })
    if (!confirmed || props.sessionId !== hostSessionId) return
    await resetWorkspace()
    showSuccess('终端工作台已重置')
  }
}
watch(activeSessionId, () => {
  searchVisible.value = false
  searchResult.value = { resultIndex: -1, resultCount: 0 }
})
watch(
  () => sessions.value.length,
  (count) => updateSidebarBadge('terminal', count || undefined),
  { immediate: true }
)
onUnmounted(() => updateSidebarBadge('terminal', undefined))
</script>

<style scoped>
.terminal-console {
  height: 100%;
  min-height: 0;
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
  gap: 8px;
  min-width: 0;
}
.terminal-toolbar {
  flex: 0 0 auto;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.toolbar-identity {
  flex: 1;
}
.active-session-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toolbar-actions {
  flex-shrink: 0;
}
.terminal-console :deep(.el-button + .el-button) {
  margin-left: 0;
}
.terminal-console :deep(.el-button.is-text) {
  padding: 6px;
  height: 28px;
}
.terminal-console :deep(.el-button .iconify) {
  font-size: 16px;
}
.compact-session-picker {
  display: none;
  width: 150px;
  max-width: 100%;
}
.terminal-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
}
.terminal-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #07111b;
}
.is-sidebar-collapsed .terminal-body {
  grid-template-columns: minmax(0, 1fr);
}
.is-sidebar-collapsed .terminal-rail {
  display: none;
}
.is-sidebar-collapsed .compact-session-picker {
  display: block;
}
.is-sidebar-collapsed .toolbar-identity:has(.compact-session-picker) .active-session-title {
  display: none;
}
.terminal-search {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  width: min(430px, calc(100% - 24px));
  padding: 6px;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--app-card-background);
  box-shadow: var(--el-box-shadow-light);
}
.terminal-search .el-input {
  flex: 1;
  min-width: 60px;
}
.search-result {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.terminal-status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-height: 30px;
  padding: 2px 12px;
  font-size: 12px;
  background: var(--app-card-background);
  border-top: 1px solid var(--el-border-color-lighter);
}
.session-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.session-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
.session-status.is-warning {
  color: var(--el-color-warning);
}
.session-status.is-warning i {
  background: currentColor;
}
.mode-summary,
.terminal-shortcut {
  color: var(--el-text-color-secondary);
}
.terminal-shortcut {
  margin-left: auto;
  font-size: 11px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #e6edf3;
  padding: 24px;
}
.terminal-empty > .iconify {
  font-size: 32px;
  color: #8b949e;
}
.terminal-empty h3 {
  margin: 16px 0 0;
  font-size: 16px;
}
.terminal-empty p {
  color: #8b949e;
  font-size: 13px;
  margin: 8px 0 20px;
}
@container (max-width: 700px) {
  .terminal-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .terminal-rail,
  .sidebar-toggle,
  .toolbar-identity:has(.compact-session-picker) .active-session-title {
    display: none;
  }
  .compact-session-picker {
    display: block;
  }
}
@container (max-width: 440px) {
  .toolbar-identity {
    flex-basis: 100%;
  }
  .compact-session-picker {
    width: 100%;
  }
  .toolbar-actions {
    margin-left: auto;
  }
  .terminal-shortcut {
    display: none;
  }
}
</style>
