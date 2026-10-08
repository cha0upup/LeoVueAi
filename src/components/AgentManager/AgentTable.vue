<template>
  <div
    v-loading="loading"
    class="tree-wrapper"
  >
    <!-- Empty state -->
    <EmptyState
      v-if="!loading && !agents.length"
      :title="emptyTitle"
      :description="emptyDescription"
      :icon="iconMap.server"
      workbench
      compact
    />

    <el-tree
      v-else
      ref="agentTree"
      :key="tableKey"
      :data="agents"
      node-key="agentId"
      lazy
      :load="handleLoad"
      :props="treeProps"
      :filter-node-method="filterNode"
      :current-node-key="currentAgentId"
      :expand-on-click-node="false"
      show-checkbox
      check-strictly
      highlight-current
      class="host-tree"
      @check="handleCheck"
      @node-click="emit('row-click', $event)"
      @node-expand="publishVisibleAgents"
      @node-collapse="publishVisibleAgents"
    >
      <template #default="{ data }">
        <div
          class="tree-node"
          @dblclick="emit('enter-console', data)"
        >
          <div
            class="node-card"
            :class="{ 'is-child': isChildHost(data) }"
          >
            <!-- Left: icon -->
            <div class="node-icon-shell">
              <el-icon class="node-icon">
                <Icon :icon="getHostIcon(data)" />
              </el-icon>
              <span
                class="node-dot"
                :class="{ online: getHostSessions(data).length }"
                :title="getHostSessions(data).length ? '有在线会话' : '无在线会话'"
              />
            </div>

            <!-- Center: two lines -->
            <div class="node-content">
              <div class="node-line1">
                <span
                  class="node-name"
                  :title="getHostDisplayName(data)"
                >{{ getHostDisplayName(data) }}</span>
                <el-tag
                  v-if="isChildHost(data)"
                  size="small"
                  effect="light"
                  type="warning"
                  class="role-tag"
                >
                  子机
                </el-tag>
              </div>
              <div class="node-line2">
                <span
                  class="node-link"
                  :title="data.connLink"
                >{{ data.connLink || '未配置连接地址' }}</span>
              </div>
              <span
                v-if="getProjectMemberships(data).length"
                class="node-projects"
              >
                <span
                  v-for="project in getProjectMemberships(data).slice(0, 2)"
                  :key="project.projectId"
                  class="node-project-tag"
                  :class="{ archived: project.status === 'archived' }"
                  :title="project.projectName"
                >
                  {{ project.projectName }}
                </span>
                <span
                  v-if="getProjectMemberships(data).length > 2"
                  class="node-project-more"
                >+{{ getProjectMemberships(data).length - 2 }}</span>
              </span>
            </div>

            <!-- Sessions and connection test are independent states. -->
            <div class="node-right">
              <StatusIndicator
                :status="getHostSessions(data).length ? 'online' : 'offline'"
                :label="getHostSessions(data).length ? `${getHostSessions(data).length} 会话` : '无会话'"
                compact
              />
              <span
                class="node-test"
                :class="{ failed: getConnectionResult(data)?.success === false, testing: isTestingAgent(data) }"
                :title="getConnectionStatusTitle(data)"
              >
                {{ getConnectionStatusText(data) }}
              </span>
            </div>

            <!-- Quick enter (hover) -->
            <button
              class="quick-enter"
              type="button"
              title="进入控制台"
              @click.stop="emit('enter-console', data)"
            >
              <el-icon><Icon icon="ep:arrow-right" /></el-icon>
            </button>
          </div>
        </div>
      </template>
    </el-tree>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { icons } from '@/utils/icons.js'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { getHostDisplayName, getHostIcon, isChildHost } from './agentDetailUtils.js'
import { collectVisibleAgents } from './agentTreeSelection.js'

const iconMap = icons

const props = defineProps({
  agents: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  tableKey: { type: Number, default: 0 },
  loadChildren: { type: Function, required: true },
  keyword: { type: String, default: '' },
  currentAgentId: { type: String, default: '' },
  connectionResults: { type: Object, default: () => ({}) },
  testingAgentIds: { type: Array, default: () => [] },
  checkedAgentIds: { type: Array, default: () => [] },
  selectionDisabled: { type: Boolean, default: false },
  sessionsByAgentId: { type: Object, default: () => ({}) },
  projectMemberships: { type: Object, default: () => ({}) },
  emptyTitle: { type: String, default: '暂无主机' },
  emptyDescription: { type: String, default: '添加第一台主机以开始使用控制台' }
})

const emit = defineEmits(['row-click', 'enter-console', 'toggle-selection', 'visible-agents-change'])

const agentTree = ref(null)

const treeProps = {
  label: 'agentName',
  children: 'children',
  disabled: () => props.selectionDisabled,
  isLeaf: (data) => !data?.hasChildren
}

const getConnectionResult = (row) => {
  const agentId = row?.agentId
  return agentId ? props.connectionResults?.[agentId] : null
}

const isTestingAgent = (row) => {
  const agentId = row?.agentId
  return Boolean(agentId && props.testingAgentIds.includes(agentId))
}

const getHostSessions = (row) => {
  const agentId = row?.agentId
  return agentId ? props.sessionsByAgentId?.[agentId] || [] : []
}

const getProjectMemberships = (row) => {
  const agentId = row?.agentId
  return agentId ? props.projectMemberships?.[agentId] || [] : []
}

const getConnectionStatusText = (row) => {
  if (isTestingAgent(row)) return '测试中…'
  const result = getConnectionResult(row)
  if (result) return result.success ? '测试成功' : '测试失败'
  return row?.connLink ? '未测试' : '未配置地址'
}

const getConnectionStatusTitle = (row) =>
  `连接测试：${getConnectionStatusText(row)} · 最近心跳：${formatHeartbeat(row.lastHeartbeat)}`

const publishVisibleAgents = async () => {
  await nextTick()
  emit('visible-agents-change', collectVisibleAgents(props.agents, (id) => agentTree.value?.getNode?.(id)))
}

const syncChecked = () => agentTree.value?.setCheckedKeys?.(props.checkedAgentIds)

const syncTreeState = async () => {
  await nextTick()
  syncChecked()
  agentTree.value?.filter?.(props.keyword)
  publishVisibleAgents()
}

const handleLoad = (node, resolve) => {
  const complete = (rows) => {
    resolve(rows)
    return syncTreeState()
  }
  if (node.level === 0) {
    complete(props.agents)
    return
  }
  if (!node.data?.hasChildren) {
    complete([])
    return
  }
  props.loadChildren(node.data, node, complete)
}

const handleCheck = (data, checkedInfo = {}) => {
  if (props.selectionDisabled) {
    syncChecked()
    return
  }
  emit('toggle-selection', data, (checkedInfo.checkedKeys || []).includes(data.agentId))
}

const formatHeartbeat = (ts) => {
  if (!ts) return '从未心跳'
  const date = new Date(ts)
  if (isNaN(date.getTime())) return '—'
  const delta = Date.now() - date.getTime()
  if (delta < 60000) return '刚刚'
  if (delta < 3600000) return `${Math.floor(delta / 60000)}分钟前`
  if (delta < 86400000) return `${Math.floor(delta / 3600000)}小时前`
  return `${Math.floor(delta / 86400000)}天前`
}

const filterNode = (keyword, data) => {
  if (!keyword) return true
  const query = String(keyword).toLowerCase().trim()
  const name = String(data?.agentName || '').toLowerCase()
  const link = String(data?.connLink || '').toLowerCase()
  const sessionMatch = getHostSessions(data).some((session) =>
    String(session?.sessionId || '')
      .toLowerCase()
      .includes(query)
  )
  return name.includes(query) || link.includes(query) || sessionMatch
}

const clearSelection = () => {
  agentTree.value?.setCurrentKey(null)
}

const getLoadedAgent = (agentId) => agentTree.value?.getNode?.(agentId)?.data || null

watch(
  [() => props.checkedAgentIds, () => props.agents, () => props.tableKey, () => props.keyword],
  syncTreeState,
  { immediate: true, flush: 'post' }
)

watch(
  () => props.currentAgentId,
  (value) => {
    if (value) {
      agentTree.value?.setCurrentKey(value)
    }
  },
  { immediate: true }
)

defineExpose({
  clearSelection,
  getLoadedAgent
})
</script>

<style scoped>
.tree-wrapper {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 2px 0 8px;
}

/* ─── Tree base ─── */
.host-tree {
  background: transparent;
}

.host-tree :deep(.el-tree-node__content) {
  position: relative;
  align-items: center;
  height: auto;
  min-width: 0;
  padding: 0 !important;
  margin: 0 0 4px;
  background: transparent;
}

.host-tree :deep(.el-tree-node__content:hover) {
  background: transparent;
}

.host-tree :deep(.el-tree-node__content > .el-checkbox) {
  margin-right: 4px;
  margin-left: var(--agent-expand-gutter, 22px);
  height: 50px;
}

.host-tree :deep(.el-checkbox__inner) {
  border-radius: 4px;
  width: 14px;
  height: 14px;
}

.host-tree :deep(.el-tree-node__expand-icon) {
  position: absolute;
  top: 15px;
  left: 1px;
  z-index: 1;
  margin: 0;
  padding: 4px;
  color: var(--pm-placeholder, var(--el-text-color-placeholder));
  font-size: 12px;
}

.host-tree :deep(.el-tree-node__children) {
  margin-left: 10px;
  padding-left: 6px;
  border-left: 1px solid var(--pm-border, var(--el-border-color));
}

.host-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: transparent !important;
}

.host-tree :deep(.el-tree-node.is-current > .el-tree-node__content .node-card) {
  border-color: transparent;
  background: var(--app-selected-background);
  box-shadow: inset 3px 0 0 var(--pm-blue, var(--el-color-primary));
}

/* ─── Node ─── */
.tree-node {
  flex: 1;
  width: 100%;
  min-width: 0;
}

.node-card {
  display: flex;
  align-items: center;
  gap: 9px;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 50px;
  padding: 8px;
  border-radius: var(--radius-tag);
  border: 1px solid transparent;
  border-bottom-color: var(--app-divider-color);
  background: transparent;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.node-card:hover {
  border-color: transparent;
  box-shadow: none;
  background: var(--app-hover-background);
}

.node-card.is-child {
  background: transparent;
}

/* ─── Icon shell ─── */
.node-icon-shell {
  position: relative;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: var(--radius-control);
  background: color-mix(
    in srgb,
    var(--pm-blue, var(--el-color-primary)) 6%,
    var(--pm-panel-soft, var(--app-control-background-soft))
  );
  border: 1px solid color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 12%, transparent);
  color: var(--pm-blue, var(--el-color-primary));
}

.is-child .node-icon-shell {
  background: color-mix(
    in srgb,
    var(--el-color-warning) 10%,
    var(--pm-panel-soft, var(--app-control-background-soft))
  );
  border-color: color-mix(in srgb, var(--el-color-warning) 20%, transparent);
  color: var(--el-color-warning);
}

.node-icon {
  font-size: 16px;
}

.node-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 2px solid var(--pm-panel, var(--app-surface-background));
  background: var(--el-text-color-placeholder);
}

.node-dot.online {
  background: var(--el-color-success);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-success) 20%, transparent);
}

/* ─── Content (two lines) ─── */
.node-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.node-line1 {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.node-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--pm-ink, var(--el-text-color-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

:deep(.role-tag) {
  flex: 0 0 auto;
  height: 18px;
  border-radius: var(--radius-tag);
  font-size: 10px;
  font-weight: 600;
  padding: 0 6px;
}

.node-projects {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 1 auto;
  overflow: hidden;
}

.node-project-tag {
  max-width: 68px;
  padding: 1px 5px;
  overflow: hidden;
  border-radius: 999px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  font-size: 9px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-project-tag.archived {
  color: var(--el-text-color-placeholder);
  background: var(--app-hover-background);
}

.node-project-more {
  flex: 0 0 auto;
  color: var(--el-text-color-placeholder);
  font-size: 9px;
}

.node-line2 {
  display: flex;
  align-items: center;
  min-width: 0;
}

.node-link {
  font-size: 10.5px;
  color: var(--pm-muted, var(--el-text-color-secondary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* ─── Right column ─── */
.node-right {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 54px;
}

.node-test {
  font-size: 10px;
  color: var(--pm-placeholder, var(--el-text-color-placeholder));
  white-space: nowrap;
}

.node-test.failed {
  color: var(--el-color-danger);
}

.node-test.testing {
  color: var(--el-color-primary);
}

/* ─── Quick enter button ─── */
.quick-enter {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: var(--pm-panel-strong, var(--app-card-background));
  color: var(--pm-muted, var(--el-text-color-secondary));
  cursor: pointer;
  pointer-events: none;
  opacity: 0;
  transition: all 0.15s ease;
}

.node-card:hover .quick-enter,
.node-card:focus-within .quick-enter {
  pointer-events: auto;
  opacity: 1;
}

.quick-enter:hover {
  border-color: color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 30%, transparent);
  background: color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 8%, transparent);
  color: var(--pm-blue, var(--el-color-primary));
}

.quick-enter:focus-visible {
  opacity: 1;
  outline: 2px solid color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 40%, transparent);
  outline-offset: 1px;
}

/* ─── Responsive ─── */
@media (max-width: 720px) {
  .quick-enter {
    display: none;
  }
}
</style>
