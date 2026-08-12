<template>
  <div class="sidebar">
    <section class="connection-strip">
      <div class="connection-strip-main">
        <strong class="connection-strip-title">
          {{ connection.dialect ? connection.dialect.toUpperCase() : '未连接数据库' }}
        </strong>
        <span class="connection-strip-meta">{{ connection.username || '-' }}</span>
      </div>
      <div class="connection-strip-actions">
        <el-tag
          :type="connectionStatusPresentation.type"
          effect="dark"
          round
        >
          {{ connectionStatusPresentation.label }}
        </el-tag>
        <el-button
          v-if="connectionStatus !== 'idle'"
          size="small"
          :type="showConnectionInfo ? 'primary' : 'default'"
          @click="emit('toggle-connection-info')"
        >
          <el-icon><Icon :icon="iconMap.info" /></el-icon>
          {{ showConnectionInfo ? '返回工作区' : '连接信息' }}
        </el-button>
        <el-button
          v-if="canCreateDatabase"
          size="small"
          type="primary"
          :disabled="connectionStatus !== 'ready'"
          @click="emit('open-create-db')"
        >
          <el-icon><Icon :icon="iconMap.plus" /></el-icon>
          新建库
        </el-button>
      </div>
    </section>

    <div class="database-tree-section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon>
            <FolderOpened />
          </el-icon>
          资源浏览
        </h3>
        <div class="header-actions">
          <el-button
            text
            size="small"
            :loading="refreshing"
            :disabled="connectionStatus !== 'ready'"
            @click="emit('refresh-structure')"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            刷新结构
          </el-button>
        </div>
      </div>
      <div class="tree-hint">
        <span>选择数据库、Schema 或表后进入对应面板。</span>
      </div>
      <div
        v-loading="namespacesLoading"
        class="tree-wrapper"
      >
        <DatabaseTree
          v-if="canListDatabases && connectionStatus === 'ready'"
          :key="treeRevision"
          :namespaces="namespaces"
          :load-tables="loadTables"
          @select-object="(objectRef) => emit('select-object', objectRef)"
        />
        <el-empty
          v-else
          :description="treeEmptyDescription"
          :image-size="72"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FolderOpened } from '@element-plus/icons-vue'
import { icons } from '@/utils/icons.js'
import DatabaseTree from './DatabaseTree.vue'
import sqlEngine from './SqlEngine.js'
import { getDatabaseConnectionStatusPresentation } from './useDatabaseConnectionState.js'

const iconMap = icons

const props = defineProps({
  connection: {
    type: Object,
    required: true
  },
  connectionStatus: {
    type: String,
    default: 'idle'
  },
  namespaces: { type: Array, default: () => [] },
  namespacesLoading: { type: Boolean, default: false },
  treeRevision: { type: Number, default: 0 },
  loadTables: { type: Function, required: true },
  showConnectionInfo: {
    type: Boolean,
    default: false
  },
  refreshing: {
    type: Boolean,
    default: false
  }
})

const dialectCapabilities = computed(() => sqlEngine.getCapabilities(props.connection.dialect))
const canCreateDatabase = computed(() => dialectCapabilities.value.createDatabase === true)
const canListDatabases = computed(() => dialectCapabilities.value.listDatabases === true)
const connectionStatusPresentation = computed(() =>
  getDatabaseConnectionStatusPresentation(props.connectionStatus)
)
const treeEmptyDescription = computed(() => {
  if (props.connectionStatus === 'connecting') return '正在连接数据库'
  if (props.connectionStatus === 'error') return '连接失败，请重新连接'
  if (props.connectionStatus !== 'ready') return '请先建立数据库连接'
  return '当前连接使用 SQL 查询模式'
})

const emit = defineEmits([
  'toggle-connection-info',
  'open-create-db',
  'refresh-structure',
  'select-object'
])

</script>

<style scoped>
.sidebar {
  width: clamp(216px, 17vw, 248px);
  background: var(--database-console-panel-surface);
  border: 0;
  border-right: 1px solid var(--database-console-soft-border);
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
  gap: 0;
  padding: 0;
}

.connection-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--database-console-soft-border);
  background: color-mix(
    in srgb,
    var(--database-console-muted-surface) 84%,
    var(--database-console-panel-surface)
  );
}

.connection-strip-main {
  display: flex;
  align-items: center;
  gap: 5px 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.connection-strip-title {
  color: var(--el-text-color-primary);
  font-size: 0.875rem;
  font-weight: 700;
}

.connection-strip-meta {
  color: color-mix(in srgb, var(--el-text-color-primary) 78%, var(--el-color-primary));
  font-size: 0.75rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-strip-actions {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.connection-strip-actions :deep(.el-tag) {
  height: 24px;
  border-radius: 4px;
  font-weight: 600;
}

.connection-strip-actions :deep(.el-tag.el-tag--success) {
  background: color-mix(in srgb, var(--el-color-success-light-8) 80%, white);
  border-color: color-mix(in srgb, var(--el-color-success) 36%, transparent);
  color: var(--el-color-success-dark-2);
}

.connection-strip-actions :deep(.el-tag.el-tag--info) {
  background: color-mix(in srgb, var(--el-color-info-light-8) 80%, white);
  border-color: color-mix(in srgb, var(--el-color-info) 34%, transparent);
  color: var(--el-color-info-dark-2);
}

.database-tree-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  background: var(--database-console-panel-surface);
}

.tree-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5px 7px 8px;
}

.tree-hint {
  padding: 6px 10px 2px;
  color: var(--el-text-color-secondary);
  font-size: 0.75rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--database-console-soft-border);
  background: var(--database-console-muted-surface);
  border-radius: 0;
  margin: 0;
  flex-shrink: 0;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: color-mix(in srgb, var(--el-text-color-primary) 88%, var(--el-color-primary));
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
}

.section-title .el-icon {
  color: var(--el-color-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
  flex-shrink: 0;
}

.header-actions :deep(.el-button.is-text) {
  color: var(--el-color-primary-dark-2);
  font-weight: 600;
}

@media (max-width: 1100px) {
  .sidebar {
    width: 100%;
    height: auto;
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .sidebar {
    padding: 0;
  }
}
</style>
