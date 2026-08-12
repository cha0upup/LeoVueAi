<template>
  <div>
    <el-tree
      class="db-tree"
      :data="data"
      accordion
      :load="loadNode"
      highlight-current
      lazy
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data: nodeData }">
        <div
          class="node-row"
          :class="getNodeClass(node.level)"
        >
          <div class="node-content">
            <el-icon
              class="node-icon"
              :class="getIconClass(node.level)"
            >
              <Icon :icon="node.level === 1 ? iconMap.folderOpened : iconMap.document" />
            </el-icon>
            <span class="node-label">{{ nodeData.label }}</span>
          </div>
        </div>
      </template>
    </el-tree>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

import { icons } from '@/utils/icons.js'
import { getDatabaseObjectLabel } from './database-domain.js'

const iconMap = icons

const props = defineProps({
  namespaces: { type: Array, default: () => [] },
  loadTables: { type: Function, required: true }
})

const emit = defineEmits(['select-object'])

const data = computed(() => props.namespaces.map((namespace, index) => ({
  id: `namespace-${getDatabaseObjectLabel(namespace.objectRef, namespace.name)}-${index}`,
  label: namespace.name || getDatabaseObjectLabel(namespace.objectRef),
  objectRef: namespace.objectRef,
  children: [{}]
})))

const loadNode = async (node, resolve) => {
  if (node.level === 0) return resolve(data.value)
  if (node.level >= 2 || !node.data?.objectRef) return resolve([])

  const tables = await props.loadTables(node.data.objectRef)
  resolve(tables.map((table, index) => ({
    id: `${node.data.id}-${table.name}-${index}`,
    label: table.name || '',
    schema: table.schema || '',
    objectRef: table.objectRef
  })))
}

const handleNodeClick = (_data, node) => {
  if ((node.level === 1 || node.level === 2) && node.data?.objectRef) {
    emit('select-object', node.data.objectRef)
  }
}

const getNodeClass = (level) => {
  if (level === 1) return 'database-node'
  if (level === 2) return 'table-node'
  return ''
}

const getIconClass = (level) => {
  if (level === 1) return 'database-icon'
  if (level === 2) return 'table-icon'
  return ''
}
</script>

<style scoped>
/* 树形结构样式 */
.db-tree {
  --db-tree-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --db-tree-selected-surface: color-mix(
    in srgb,
    var(--app-card-active-background) 88%,
    var(--el-bg-color-overlay)
  );
  --db-tree-soft-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
}

:global(html:not(.dark) .db-tree),
:global(html[data-theme='light'] .db-tree) {
  --db-tree-muted-surface: #f2f2f2;
  --db-tree-selected-surface: #e7e8e9;
  --db-tree-soft-border: color-mix(in srgb, var(--el-border-color) 74%, transparent);
}

:global(html.dark .db-tree),
:global(html[data-theme='dark'] .db-tree) {
  --db-tree-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --db-tree-selected-surface: color-mix(
    in srgb,
    var(--app-card-active-background) 84%,
    var(--el-bg-color-overlay)
  );
  --db-tree-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

.db-tree :deep(.el-tree-node__content) {
  height: 30px;
  border-radius: 5px;
  margin: 1px 0;
  transition: all 0.2s ease;
}

.db-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: color-mix(in srgb, var(--el-color-primary) 9%, transparent);
  color: var(--el-color-primary);
}

.db-tree :deep(.el-tree-node.is-current > .el-tree-node__content .node-icon) {
  color: var(--el-color-primary);
}

/* 节点行样式 */
.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 6px 0 0;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.node-icon {
  flex-shrink: 0;
  font-size: clamp(0.9375rem, 1vw, 1rem);
}

.node-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

/* 数据库节点特殊样式 */
.node-row.database-node .node-label {
  font-weight: 600;
}

/* 表节点特殊样式 */
.node-row.table-node .node-label {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

/* 列节点特殊样式 */
.node-row.column-node .node-label {
  font-weight: 400;
  color: var(--el-text-color-secondary);
  font-size: 0.8125rem;
}
</style>
