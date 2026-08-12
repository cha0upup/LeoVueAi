<template>
  <div class="terminal-console">
    <div class="terminal-console__body">
      <TerminalSessionRail
        :icon-map="iconMap"
        :sessions="sessions"
        :active-session-id="activeSessionId"
        @activate="activateSession"
        @create-session="createSession"
        @reset-workspace="handleResetWorkspace"
        @close-session="removeSession"
        @interrupt-session="interruptSession"
        @clear-screen="clearSessionViewport"
      />

      <section class="terminal-stage">
        <div class="terminal-stage__surface">
          <div class="terminal-stage__head">
            <div class="stage-head__primary">
              <span
                class="stage-title-icon"
                aria-hidden="true"
              >
                <el-icon><Icon :icon="iconMap.terminal" /></el-icon>
              </span>
              <div class="stage-identity">
                <span class="stage-title">{{ activeSession?.title || '终端' }}</span>
                <span class="stage-subtitle">进程 {{ activeSessionLabel }}</span>
              </div>
            </div>
            <div class="stage-head__secondary">
              <div class="stage-search">
                <el-input
                  :model-value="searchKeyword"
                  size="small"
                  clearable
                  placeholder="检索终端输出"
                  @update:model-value="(value) => handleSearchKeywordChange(value || '')"
                >
                  <template #prefix>
                    <el-icon><Icon :icon="iconMap.search" /></el-icon>
                  </template>
                </el-input>
                <el-button
                  circle
                  size="small"
                  aria-label="上一个搜索结果"
                  @click="searchInActiveSession('prev')"
                >
                  <el-icon><Icon :icon="iconMap.arrowUp" /></el-icon>
                </el-button>
                <el-button
                  circle
                  size="small"
                  aria-label="下一个搜索结果"
                  @click="searchInActiveSession('next')"
                >
                  <el-icon><Icon :icon="iconMap.arrowDown" /></el-icon>
                </el-button>
              </div>
              <div class="stage-actions">
                <el-button
                  class="stage-action-button is-interrupt"
                  size="small"
                  @click="interruptActiveSession"
                >
                  <el-icon><Icon :icon="iconMap.stop" /></el-icon>
                  中断
                </el-button>
                <el-button
                  class="stage-action-button"
                  size="small"
                  @click="clearActiveViewport"
                >
                  <el-icon><Icon :icon="iconMap.remove" /></el-icon>
                  清屏
                </el-button>
                <el-button
                  class="stage-action-button is-close"
                  size="small"
                  @click="closeActiveSession"
                >
                  <el-icon><Icon :icon="iconMap.close" /></el-icon>
                  关闭
                </el-button>
              </div>
            </div>
          </div>

          <div class="terminal-stage__viewport">
            <TerminalViewport
              v-for="session in sessions"
              v-show="session.id === activeSessionId"
              :key="session.id"
              :ref="(instance) => setViewportRef(instance, session.id)"
              :active="session.id === activeSessionId"
              :terminal-session="session"
              @ready="handleViewportReady(session.id)"
              @input="(data) => handleTerminalInput(data, session)"
              @resize="(size) => handleTerminalResize(size, session)"
              @activity="markSessionActive(session)"
            />
          </div>

          <div class="terminal-stage__foot">
            <div class="stage-foot__block">
              <span class="stage-foot__label">会话 ID</span>
              <span class="stage-foot__value">{{ activeSessionLabel }}</span>
            </div>
            <div class="stage-foot__block">
              <span class="stage-foot__label">最后交互</span>
              <span class="stage-foot__value">{{ activeSessionTimeLabel }}</span>
            </div>
            <div class="stage-foot__block is-compact">
              <span :class="['stage-foot__meta', { 'is-warning': activeCapability.degraded }]">
                {{ activeCapability.mode }}
              </span>
              <span class="stage-foot__divider" />
              <span class="stage-foot__meta">{{ activeCapability.resizeMode }}</span>
              <span class="stage-foot__divider" />
              <span class="stage-foot__meta">{{ activeCapability.streamMode }}</span>
              <span class="stage-foot__divider" />
              <span class="stage-foot__meta">{{ activeSession?.backend || 'detecting' }}</span>
              <span class="stage-foot__divider" />
              <template v-if="activeSession?.routingMismatch">
                <span class="stage-foot__meta is-warning">ROUTE?</span>
                <span class="stage-foot__divider" />
              </template>
              <span class="stage-foot__meta">UTF-8</span>
              <span class="stage-foot__divider" />
              <span class="stage-foot__shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>C</kbd> 中断</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onUnmounted, toRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { execCommandApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import TerminalSessionRail from '@/components/PuppetConsole/terminal/TerminalSessionRail.vue'
import TerminalViewport from '@/components/PuppetConsole/terminal/TerminalViewport.vue'
import { describeTerminalCapability } from './terminalWorkspaceModel.js'
import { useTerminalWorkspace } from './useTerminalWorkspace.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const iconMap = icons
const updateSidebarBadge = inject('updateSidebarBadge', () => {})
const {
  sessions,
  activeSessionId,
  activeSession,
  activeSessionLabel,
  activeSessionTimeLabel,
  searchKeyword,
  setViewportRef,
  createSession,
  activateSession,
  removeSession,
  closeActiveSession,
  clearSessionViewport,
  clearActiveViewport,
  interruptSession,
  interruptActiveSession,
  resetWorkspace,
  markSessionActive,
  handleViewportReady,
  handleTerminalInput,
  handleTerminalResize,
  handleSearchKeywordChange,
  searchInActiveSession
} = useTerminalWorkspace({
  hostSessionId: toRef(props, 'sessionId'),
  executeCommand: execCommandApi,
  onError: showError
})
const activeCapability = computed(() => describeTerminalCapability(activeSession.value))

async function handleResetWorkspace() {
  const confirmed = await confirmAction({
    title: '重置终端工作台',
    message: '将关闭当前所有终端并创建一个新的会话。',
    confirmButtonText: '重置'
  })
  if (!confirmed) return
  await resetWorkspace()
  showSuccess('终端工作台已重置')
}

watch(
  () => sessions.value.length,
  (count) => {
    updateSidebarBadge('terminal', count || undefined)
  },
  { immediate: true }
)

onUnmounted(() => {
  updateSidebarBadge('terminal', undefined)
})
</script>

<style scoped>
.terminal-console {
  --workspace-surface: var(--app-card-background);
  --workspace-muted-surface: var(--app-control-background-soft);
  --workspace-control-surface: var(--app-control-background);
  --workspace-soft-border: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  color: var(--el-text-color-primary);
}

:global(html:not(.dark) .terminal-console),
:global(html[data-theme='light'] .terminal-console) {
  --workspace-surface: var(--app-card-background);
  --workspace-muted-surface: var(--app-control-background-soft);
  --workspace-control-surface: var(--app-control-background);
  --workspace-soft-border: color-mix(in srgb, var(--el-border-color) 20%, transparent);
}

.terminal-console__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(168px, 180px) minmax(0, 1fr);
  gap: 0;
  padding: 0;
  border-radius: 0;
  background: color-mix(in srgb, var(--workspace-muted-surface) 64%, transparent);
  overflow: hidden;
}

.terminal-stage {
  min-height: 0;
  display: flex;
}

.terminal-stage__surface {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border-radius: 0;
  border: 0;
  background: var(--workspace-surface);
  box-shadow: -1px 0 0 color-mix(in srgb, var(--workspace-soft-border) 84%, transparent);
}

.terminal-stage__head,
.terminal-stage__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  background: var(--workspace-surface);
}

.terminal-stage__head {
  min-height: 44px;
  border-bottom: 1px solid color-mix(in srgb, var(--workspace-soft-border) 88%, transparent);
}

.terminal-stage__viewport {
  min-height: 0;
  padding: 0;
  background: var(--app-code-background);
}

.terminal-stage__foot {
  border-top: 1px solid color-mix(in srgb, var(--workspace-soft-border) 88%, transparent);
  justify-content: flex-start;
  min-height: 30px;
  padding: 3px 12px;
  background: color-mix(in srgb, var(--workspace-muted-surface) 44%, transparent);
}

.stage-head__primary,
.stage-head__secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stage-head__primary {
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
}

.stage-title-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 6px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  color: var(--el-color-primary);
  font-size: 14px;
}

.stage-identity {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.stage-head__secondary {
  flex: 1 1 auto;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 6px;
}

.stage-title {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
}

.stage-subtitle {
  min-width: 0;
  max-width: 220px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-search {
  width: clamp(176px, 20vw, 248px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
}

.stage-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stage-foot__block {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.stage-foot__block + .stage-foot__block:not(.is-compact) {
  padding-left: 10px;
  margin-left: 4px;
  border-left: 1px solid color-mix(in srgb, var(--workspace-soft-border) 88%, transparent);
}

.stage-foot__block.is-compact {
  margin-left: auto;
}

.stage-foot__label {
  font-size: 11px;
  letter-spacing: 0;
  color: var(--el-text-color-secondary);
}

.stage-foot__value {
  max-width: 100%;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-foot__meta,
.stage-foot__shortcut {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
}

.stage-foot__meta.is-warning {
  color: var(--el-color-warning);
  font-weight: 700;
}

.stage-foot__divider {
  width: 1px;
  height: 10px;
  background: color-mix(in srgb, var(--workspace-soft-border) 88%, transparent);
}

.stage-foot__shortcut {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.stage-foot__shortcut kbd {
  min-width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 54%, transparent);
  border-radius: 4px;
  background: var(--workspace-control-surface);
  color: var(--el-text-color-secondary);
  font: inherit;
  line-height: 1;
}

.terminal-console :deep(.el-input__wrapper) {
  border-radius: 6px;
  background: var(--workspace-control-surface);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--workspace-soft-border) 92%, transparent);
}

.terminal-console :deep(.el-button) {
  border-radius: 6px;
  font-weight: 600;
  box-shadow: none;
}

.terminal-console :deep(.el-button--small) {
  min-height: 28px;
}

.stage-action-button.is-interrupt,
.stage-action-button.is-close {
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

@media (max-width: 1100px) {
  .terminal-console__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .terminal-stage__head,
  .terminal-stage__foot {
    flex-direction: column;
    align-items: flex-start;
  }

  .stage-search {
    width: 100%;
  }

  .stage-head__secondary {
    width: 100%;
    flex-wrap: wrap;
  }

  .stage-foot__block.is-compact {
    margin-left: 0;
  }
}
</style>
