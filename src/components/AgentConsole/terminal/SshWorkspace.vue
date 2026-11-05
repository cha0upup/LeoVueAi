<template>
  <div
    ref="root"
    class="ssh-workspace"
  >
    <button
      v-if="!connectionsCollapsed"
      class="connections-backdrop"
      aria-label="收起 SSH 连接列表"
      @click="connectionsCollapsed = true"
    />
    <aside
      v-if="!connectionsCollapsed"
      class="ssh-connections"
      aria-label="已保存的 SSH 连接"
    >
      <div class="connections-heading">
        <strong>已保存连接 <small>{{ profiles.length }}</small></strong>
        <div>
          <el-button
            text
            :loading="loading"
            aria-label="刷新 SSH 连接"
            @click="refreshProfiles"
          >
            <Icon :icon="icons.refresh" />
          </el-button>
          <el-button
            text
            aria-label="收起连接列表"
            @click="connectionsCollapsed = true"
          >
            <Icon :icon="icons.arrowLeft" />
          </el-button>
        </div>
      </div>
      <el-input
        v-model="query"
        placeholder="搜索名称、地址或账号"
        aria-label="搜索 SSH 连接"
        clearable
      />
      <el-alert
        v-if="listError"
        :title="listError"
        type="error"
        :closable="false"
      />
      <div
        class="connections-list"
        :aria-busy="loading"
      >
        <div
          v-for="profile in filteredProfiles"
          :key="profile.profileId"
          class="connection-row"
          :class="{
            'is-active': matchesActive(profile),
            'is-pending': pendingIds.has(profile.profileId)
          }"
        >
          <button
            type="button"
            class="connection-open"
            :aria-label="`${existing(profile) ? '打开' : '连接'} ${profile.name || profile.host}`"
            :title="`${profile.username}@${profile.host}:${profile.port}`"
            @click="connect(profile)"
          >
            <span class="connection-name"><i
              :class="{
                connected: !!existing(profile),
                pending: pendingIds.has(profile.profileId)
              }"
            />{{ profile.name || profile.host }}</span>
            <span class="connection-endpoint">{{ profile.username }}@{{ profile.host }}:{{ profile.port }}</span>
            <span class="connection-state">{{
              pendingIds.has(profile.profileId)
                ? '连接中…'
                : existing(profile)
                  ? '已连接 · 点击打开'
                  : '点击连接'
            }}<small>{{ profile.authType === 'privateKey' ? '私钥' : '密码' }}</small></span>
          </button>
          <el-dropdown
            trigger="click"
            @command="(action) => profileAction(action, profile)"
          >
            <el-button
              text
              class="connection-menu"
              :aria-label="`${profile.name || profile.host}的连接操作`"
              @click.stop
            >
              <Icon :icon="icons.more" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="new"
                  :disabled="pendingIds.has(profile.profileId)"
                >
                  新开会话
                </el-dropdown-item>
                <el-dropdown-item command="edit">
                  编辑配置
                </el-dropdown-item>
                <el-dropdown-item
                  command="delete"
                  divided
                  :disabled="deletingIds.has(profile.profileId)"
                >
                  删除配置
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div
          v-if="!filteredProfiles.length"
          class="connections-empty"
        >
          {{ loading ? '正在读取连接…' : query ? '没有匹配的连接' : '尚无连接配置' }}
          <el-button
            v-if="!query && !loading"
            text
            type="primary"
            @click="editProfile()"
          >
            新建连接
          </el-button>
        </div>
      </div>
      <div class="connections-note">
        <Icon :icon="icons.connection" /> 经当前 Agent 中转
      </div>
    </aside>
    <TerminalWorkspaceView
      class="ssh-terminal"
      :session-id="sessionId"
      :workspace="terminal"
      title="SSH"
      :icon="icons.connection"
      :session-list-toggle="false"
      reset-label="关闭全部会话"
      reset-message="将关闭所有 SSH 会话，已保存的连接配置保持不变。"
    >
      <template #toolbar-start>
        <el-button
          text
          class="toolbar-icon"
          aria-label="切换 SSH 连接列表"
          :aria-expanded="!connectionsCollapsed"
          @click="connectionsCollapsed = !connectionsCollapsed"
        >
          <Icon :icon="icons.list" />
        </el-button>
      </template>
      <template #actions>
        <el-button
          type="primary"
          size="small"
          aria-label="新建 SSH 连接"
          @click="editProfile()"
        >
          <Icon :icon="icons.plus" /> 新建连接
        </el-button>
      </template>
      <template #empty>
        <div class="ssh-welcome">
          <Icon :icon="icons.connection" />
          <h3>SSH 工作区</h3>
          <p>
            {{ profiles.length ? '点击左侧连接，即可打开终端。' : '保存一次配置，后续一键连接。' }}
          </p>
          <el-button
            v-if="profiles.length && connectionsCollapsed"
            @click="connectionsCollapsed = false"
          >
            选择连接
          </el-button>
          <el-button
            v-else-if="!profiles.length"
            type="primary"
            @click="editProfile()"
          >
            新建连接
          </el-button>
        </div>
      </template>
      <template #session-overlay="{ session }">
        <div
          v-if="!session.viewportReady && !session.ended"
          class="ssh-session-state"
          role="status"
        >
          <span class="connecting-indicator" />
          <h3>正在连接</h3>
          <p>{{ session.endpoint }}</p>
          <el-button @click="terminal.removeSession(session.id)">
            取消连接
          </el-button>
        </div>
        <div
          v-else-if="session.ended"
          class="ssh-session-state"
          role="alert"
        >
          <Icon :icon="icons.info" />
          <h3>{{ session.viewportReady ? '会话已结束' : '连接未建立' }}</h3>
          <p>{{ session.endReason }}</p>
          <div>
            <el-button
              type="primary"
              :loading="pendingIds.has(session.profileId)"
              :disabled="pendingIds.has(session.profileId)"
              @click="retrySession(session)"
            >
              重连
            </el-button>
            <el-button
              v-if="profiles.some((profile) => profile.profileId === session.profileId)"
              @click="editProfile({ profileId: session.profileId })"
            >
              编辑配置
            </el-button>
          </div>
        </div>
      </template>
    </TerminalWorkspaceView>
    <SshProfileDialog
      v-model="editorVisible"
      :session-id="sessionId"
      :profile-id="editorId"
      @saved="saved"
      @connect="connect"
    />
  </div>
</template>

<script setup>
import { computed, inject, onUnmounted, ref, toRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import TerminalWorkspaceView from './TerminalWorkspaceView.vue'
import SshProfileDialog from './SshProfileDialog.vue'
import { useSshWorkspace } from './useSshWorkspace.js'
const props = defineProps({ sessionId: { type: String, required: true } })
const root = ref(null),
  connectionsCollapsed = ref(false),
  query = ref(''),
  editorVisible = ref(false),
  editorId = ref('')
const updateBadge = inject('updateSidebarBadge', () => {})
const model = useSshWorkspace({ hostSessionId: toRef(props, 'sessionId') })
const {
  terminal,
  profiles,
  listError,
  loading,
  pendingIds,
  deletingIds,
  refreshProfiles,
  saved,
  retrySession,
  deleteProfile,
  existing
} = model
const filteredProfiles = computed(() => {
  const text = query.value.trim().toLowerCase()
  return profiles.value.filter((profile) =>
    [profile.name, profile.host, profile.username, profile.port]
      .join(' ')
      .toLowerCase()
      .includes(text)
  )
})
function matchesActive(profile) {
  return (
    terminal.activeSession.value?.profileId === profile.profileId &&
    terminal.activeSession.value.endpoint === `${profile.username}@${profile.host}:${profile.port}`
  )
}
function connect(profile, options) {
  if (root.value?.clientWidth < 650) connectionsCollapsed.value = true
  return model.openProfile(profile, options)
}
function editProfile(profile) {
  editorId.value = profile?.profileId || ''
  editorVisible.value = true
}
function profileAction(action, profile) {
  if (action === 'new') connect(profile, { forceNew: true })
  else if (action === 'edit') editProfile(profile)
  else if (action === 'delete') deleteProfile(profile)
}
watch(
  () => props.sessionId,
  () => {
    editorVisible.value = false
    editorId.value = ''
    query.value = ''
  }
)
watch(
  () => terminal.sessions.value.length,
  (count) => updateBadge('ssh', count || undefined),
  { immediate: true }
)
onUnmounted(() => updateBadge('ssh', undefined))
</script>

<style scoped>
.ssh-workspace {
  position: relative;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  container-type: inline-size;
  color: var(--el-text-color-primary);
  background: var(--app-card-background);
}
.ssh-connections {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 224px;
  flex-shrink: 0;
  min-height: 0;
  padding: 10px;
  box-sizing: border-box;
  border-right: 1px solid var(--app-divider-color);
  background: var(--app-surface-background-soft);
}
.connections-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 26px;
  font-size: 12px;
}
.connections-heading strong {
  font-weight: 500;
}
.connections-heading small {
  margin-left: 4px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 400;
}
.connections-heading :deep(.el-button) {
  height: 24px;
  width: 24px;
  padding: 4px;
  margin: 0;
}
.connections-heading :deep(.iconify) {
  font-size: 15px;
}
.connections-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}
.connection-row {
  position: relative;
  margin-bottom: 5px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
}
.connection-row:hover {
  background: var(--app-hover-background);
}
.connection-row.is-active,
.connection-row.is-pending {
  background: var(--app-card-background);
  border-color: var(--el-color-primary-light-7);
  box-shadow: inset 2px 0 var(--el-color-primary);
}
.connection-open {
  width: 100%;
  padding: 10px 28px 10px 9px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  font: inherit;
  border-radius: inherit;
}
.connection-open:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.connection-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-name i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
  flex-shrink: 0;
}
.connection-name i.connected {
  background: var(--el-color-success);
}
.connection-name i.pending {
  background: var(--el-color-primary);
}
.connection-endpoint {
  display: block;
  margin: 6px 0 7px;
  font-family: var(--font-family-code);
  font-size: 10px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-state {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-secondary);
}
.connection-state small {
  font-size: 10px;
}
.connection-row :deep(.el-dropdown) {
  position: absolute;
  right: 3px;
  top: 7px;
}
.connection-menu {
  width: 23px;
  height: 24px;
  padding: 4px;
}
.connections-empty {
  padding: 20px 3px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.connections-empty :deep(.el-button) {
  display: block;
  margin: 8px auto 0;
}
.connections-note {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 2px;
  font-size: 10px;
  color: var(--el-text-color-secondary);
}
.ssh-terminal {
  flex: 1;
  min-width: 0;
}
.ssh-welcome {
  text-align: center;
}
.ssh-welcome > .iconify {
  font-size: 32px;
  color: #7dd3fc;
}
.ssh-welcome h3 {
  margin: 16px 0 10px;
  font-size: 18px;
  font-weight: 500;
}
.ssh-welcome p {
  margin-bottom: 20px;
  color: #93a6b7;
  font-size: 12px;
}
.ssh-session-state {
  position: absolute;
  inset: 0 0 28px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 28px;
  background: #07111bf5;
  color: #e6edf3;
  text-align: center;
}
.ssh-session-state > .iconify {
  font-size: 26px;
  color: #7dd3fc;
}
.ssh-session-state > div {
  display: flex;
  gap: 8px;
}
.ssh-session-state h3 {
  margin: 14px 0 6px;
  font-size: 16px;
  font-weight: 500;
}
.ssh-session-state p {
  max-width: 520px;
  max-height: 140px;
  overflow: auto;
  color: #9aabba;
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  margin: 8px 0 22px;
}
.connecting-indicator {
  height: 20px;
  width: 20px;
  border: 2px solid #2c4559;
  border-top-color: #7dd3fc;
  border-radius: 50%;
  animation: ssh-spin 1s linear infinite;
}
.connections-backdrop {
  display: none;
}
@keyframes ssh-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .connecting-indicator {
    animation: none;
  }
}
@container (max-width: 650px) {
  .ssh-connections {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 12;
    width: min(260px, 85%);
    box-shadow: var(--shadow-overlay);
  }
  .connections-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 11;
    border: 0;
    background: #0005;
  }
}
</style>
