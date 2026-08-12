<template>
  <div
    v-loading="loading"
    class="tree-wrapper"
  >
    <!-- Empty state -->
    <EmptyState
      v-if="!loading && !puppets.length"
      :title="emptyTitle"
      :description="emptyDescription"
      :icon="iconMap.server"
      workbench
      compact
    />

    <el-tree
      v-else
      ref="puppetTree"
      :key="tableKey"
      :data="puppets"
      node-key="puppetId"
      lazy
      :load="handleLoad"
      :props="treeProps"
      :filter-node-method="filterNode"
      :current-node-key="currentPuppetId"
      :expand-on-click-node="false"
      :show-checkbox="batchMode"
      check-strictly
      highlight-current
      class="host-tree"
      :class="{ 'batch-mode': batchMode }"
      @check="handleCheck"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div
          class="tree-node"
          @dblclick="handleQuickEnter(data)"
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
                :class="getStatusDotClass(data)"
              />
            </div>

            <!-- Center: two lines -->
            <div class="node-content">
              <div class="node-line1">
                <span class="node-name">{{ data.puppetName || '-' }}</span>
                <el-tag
                  v-if="isChildHost(data)"
                  size="small"
                  effect="light"
                  type="warning"
                  class="role-tag"
                >
                  子机
                </el-tag>
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
              <div class="node-line2">
                <span class="node-link">{{ getHostSubtitle(data) }}</span>
              </div>
            </div>

            <!-- Right: state + heartbeat stacked -->
            <div class="node-right">
              <StatusIndicator
                :status="getIndicatorStatus(data)"
                :label="getStateText(data)"
                compact
              />
              <span class="node-heartbeat">{{ formatHeartbeat(data.lastHeartbeat) }}</span>
            </div>

            <!-- Quick enter (hover) -->
            <button
              class="quick-enter"
              type="button"
              title="进入控制台"
              @click.stop="handleQuickEnter(data)"
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

const iconMap = icons

const props = defineProps({
  puppets: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  tableKey: { type: Number, default: 0 },
  loadChildren: { type: Function, required: true },
  keyword: { type: String, default: '' },
  currentPuppetId: { type: String, default: '' },
  connectionResults: { type: Object, default: () => ({}) },
  testingPuppetIds: { type: Array, default: () => [] },
  batchMode: { type: Boolean, default: false },
  sessionsByPuppetId: { type: Object, default: () => ({}) },
  projectMemberships: { type: Object, default: () => ({}) },
  emptyTitle: { type: String, default: '暂无主机' },
  emptyDescription: { type: String, default: '添加第一台主机以开始使用控制台' }
})

const emit = defineEmits(['row-click', 'add-entity', 'selection-change'])

const puppetTree = ref(null)

const treeProps = {
  label: 'puppetName',
  children: 'children',
  isLeaf: (data) => !data?.hasChildren
}

const isChildHost = (row) => row?.parentPuppetId && row.parentPuppetId !== 'root'

const getHostIcon = (row) => {
  return isChildHost(row) ? iconMap.connection : iconMap.server
}

const getConnectionResult = (row) => {
  const puppetId = row?.puppetId
  return puppetId ? props.connectionResults?.[puppetId] : null
}

const isTestingPuppet = (row) => {
  const puppetId = row?.puppetId
  return Boolean(puppetId && props.testingPuppetIds.includes(puppetId))
}

const getHostSessions = (row) => {
  const puppetId = row?.puppetId
  return puppetId ? props.sessionsByPuppetId?.[puppetId] || [] : []
}

const getProjectMemberships = (row) => {
  const puppetId = row?.puppetId
  return puppetId ? props.projectMemberships?.[puppetId] || [] : []
}

const getHostSubtitle = (row) => {
  const name = String(row?.puppetName || '').trim()
  const link = String(row?.connLink || '').trim()
  if (!link) return '未配置连接地址'
  if (name === link) return isChildHost(row) ? '挂载于上级主机' : '根主机'
  return link
}

const getStatusDotClass = (row) => {
  if (getHostSessions(row).length) return 'online'
  if (isTestingPuppet(row)) return 'testing'
  const result = getConnectionResult(row)
  if (result) return result.success ? 'online' : 'error'
  if (!row.connLink) return 'offline'
  return 'muted'
}

const getStateText = (row) => {
  const liveCount = getHostSessions(row).length
  if (liveCount) return `${liveCount} 会话`
  if (isTestingPuppet(row)) return '测试中'
  const result = getConnectionResult(row)
  if (result) return result.success ? '成功' : '失败'
  return row.connLink ? '未测试' : '离线'
}

const getIndicatorStatus = (row) => {
  if (getHostSessions(row).length) return 'online'
  if (isTestingPuppet(row)) return 'running'
  const result = getConnectionResult(row)
  if (result) return result.success ? 'success' : 'failed'
  return row.connLink ? 'untested' : 'offline'
}

const handleLoad = (node, resolve) => {
  if (node.level === 0) {
    resolve([])
    return
  }
  props.loadChildren(node.data, node, resolve)
}

const handleNodeClick = (data) => {
  emit('row-click', data)
}

const handleQuickEnter = (data) => {
  emit('add-entity', data)
}

const handleCheck = (data, checkedInfo = {}) => {
  emit('selection-change', checkedInfo.checkedNodes || [])
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
  const name = String(data?.puppetName || '').toLowerCase()
  const link = String(data?.connLink || '').toLowerCase()
  const sessionMatch = getHostSessions(data).some((session) =>
    String(session?.sessionId || '').toLowerCase().includes(query)
  )
  return name.includes(query) || link.includes(query) || sessionMatch
}

const clearSelection = () => {
  puppetTree.value?.setCurrentKey(null)
  clearChecked()
}

const clearChecked = () => {
  puppetTree.value?.setCheckedKeys?.([])
  emit('selection-change', [])
}

const selectAll = async (puppetIds) => {
  puppetTree.value?.setCheckedKeys?.(puppetIds)
  await nextTick()
  const checkedNodes = puppetTree.value?.getCheckedNodes?.() || []
  emit('selection-change', checkedNodes)
}

watch(
  () => props.keyword,
  (value) => {
    puppetTree.value?.filter?.(value)
  },
  { immediate: true }
)

watch(
  () => props.currentPuppetId,
  (value) => {
    if (value) {
      puppetTree.value?.setCurrentKey(value)
    }
  },
  { immediate: true }
)

defineExpose({
  clearSelection,
  clearChecked,
  selectAll
})
</script>

<style scoped>
.tree-wrapper {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 2px 6px 8px;
}

/* ─── Tree base ─── */
.host-tree {
  background: transparent;
}

.host-tree :deep(.el-tree-node__content) {
  position: relative;
  align-items: flex-start;
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
  margin-right: 6px;
  margin-left: 24px;
  margin-top: 18px;
  transform: translateY(-50%);
}

.host-tree :deep(.el-checkbox__inner) {
  border-radius: 4px;
  width: 14px;
  height: 14px;
}

.host-tree:not(.batch-mode) :deep(.el-tree-node__content > .el-checkbox) {
  display: none;
}

.host-tree :deep(.el-tree-node__expand-icon) {
  position: absolute;
  top: 15px;
  left: 3px;
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
  width: 100%;
  min-width: 0;
  min-height: 50px;
  padding: 7px 8px 7px 30px;
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

.host-tree.batch-mode .node-card {
  padding-left: 8px;
}

/* ─── Icon shell ─── */
.node-icon-shell {
  position: relative;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 6%, var(--pm-panel-soft, var(--app-control-background-soft)));
  border: 1px solid color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 12%, transparent);
  color: var(--pm-blue, var(--el-color-primary));
}

.is-child .node-icon-shell {
  background: color-mix(in srgb, var(--el-color-warning) 10%, var(--pm-panel-soft, var(--app-control-background-soft)));
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
  background: var(--pm-green, var(--el-color-success));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pm-green, var(--el-color-success)) 24%, transparent);
}

.node-dot.offline {
  background: var(--pm-placeholder, var(--el-text-color-placeholder));
  box-shadow: none;
}

.node-dot.warning {
  background: var(--el-color-warning);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-warning) 22%, transparent);
}

.node-dot.error {
  background: var(--el-color-danger);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-danger) 22%, transparent);
}

.node-dot.testing {
  background: var(--pm-blue, var(--el-color-primary));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pm-blue, var(--el-color-primary)) 22%, transparent);
  animation: dotPulse 1s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.8); }
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

/* ─── Right column (state + heartbeat) ─── */
.node-right {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 54px;
}

.node-heartbeat {
  font-size: 10px;
  color: var(--pm-placeholder, var(--el-text-color-placeholder));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
}

/* ─── Quick enter button ─── */
.quick-enter {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pm-muted, var(--el-text-color-secondary));
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.node-card:hover .quick-enter {
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
  .node-right {
    display: none;
  }

  .quick-enter {
    display: none;
  }
}
</style>
