<template>
  <div class="database-container">
    <div class="database-panel">
      <el-tabs
        v-model="activeTabId"
        type="card"
        editable
        @edit="handleTabEdit"
      >
        <el-tab-pane
          v-for="databaseTab in databaseTabs"
          :key="databaseTab.id"
          :name="databaseTab.id"
        >
          <template #label>
            <span
              v-if="databaseTab.title === TAB_CONSTANTS.HOME_TAB_TITLE"
              class="tab-label"
            >
              <el-icon><Icon :icon="iconMap.database" /></el-icon>
              {{ databaseTab.title }}
            </span>
            <el-tooltip
              v-else
              placement="bottom"
            >
              <template #content>
                <div class="conn-tooltip">
                  <div>连接：{{ databaseTab.title || '-' }}</div>
                  <div>类型：{{ getConnectionType(databaseTab) || '-' }}</div>
                  <div>用户：{{ getConnectionUser(databaseTab) || '-' }}</div>
                  <div>驱动：{{ getTabDriverClass(databaseTab) || '-' }}</div>
                  <div class="mono wrap">
                    URL：{{ getConnectionUrl(databaseTab) || '-' }}
                  </div>
                </div>
              </template>
              <span class="tab-label">
                <el-icon><Icon :icon="iconMap.connection" /></el-icon>
                <span class="tab-conn-name">{{ databaseTab.title }}</span>
              </span>
            </el-tooltip>
          </template>
          <component
            :is="databaseTab.component"
            v-bind="databaseTab.props"
            @add-data-tab="addDatabaseTab"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { markRaw, ref, toRefs } from 'vue'
import DatabaseHome from './DatabaseHome.vue'
import DatabaseConsole from './DatabaseConsole.vue'
import { v4 as uuidV4 } from 'uuid'
import {
  DATABASE_TAB_CONSTANTS as TAB_CONSTANTS,
  formatDatabaseConnectionTarget
} from '@/utils/database.js'
import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'

const iconMap = icons
const DatabaseHomeView = markRaw(DatabaseHome)
const DatabaseConsoleView = markRaw(DatabaseConsole)

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const { sessionId } = toRefs(props)

const activeTabId = ref(TAB_CONSTANTS.HOME_TAB_ID)
const databaseTabs = ref([
  {
    id: TAB_CONSTANTS.HOME_TAB_ID,
    title: TAB_CONSTANTS.HOME_TAB_TITLE,
    name: TAB_CONSTANTS.HOME_TAB_ID,
    component: DatabaseHomeView,
    props: { sessionId: sessionId.value }
  }
])

const getTabConnection = (databaseTab) => databaseTab?.props?.initialConnection || {}

const getTabDriverClass = (databaseTab) => {
  const connection = getTabConnection(databaseTab)
  return (
    connection.runtimeOptions?.java?.driverClass ||
    connection.runtimeOptions?.php?.pdoDriver ||
    (connection.dialect ? '自动适配' : '-')
  )
}

const getConnectionType = (databaseTab) => getTabConnection(databaseTab).dialect || ''

const getConnectionUser = (databaseTab) => getTabConnection(databaseTab).username || ''

const getConnectionUrl = (databaseTab) => {
  const connection = getTabConnection(databaseTab)
  return databaseTab?.url || formatDatabaseConnectionTarget(connection)
}

const handleTabEdit = (targetName, action) => {
  if (action === 'remove' && targetName !== TAB_CONSTANTS.HOME_TAB_ID) {
    removeDatabaseTab(targetName)
  }
}

const addDatabaseTab = (payload) => {
  if (!payload || typeof payload !== 'object') return
  const connectionId = payload.connectionId
  const url = payload.url
  const connectionName = payload.connectionName || url
  const initialConnection = payload.connection || {}

  const existingTab = databaseTabs.value.find((tab) => {
    if (tab.id === TAB_CONSTANTS.HOME_TAB_ID) {
      return false
    }

    return (
      (connectionId && tab.props?.connectionId === connectionId) ||
      (url && tab.url === url) ||
      (connectionName && tab.title === connectionName)
    )
  })

  if (existingTab) {
    activeTabId.value = existingTab.id
    return
  }

  const connectionTab = {
    id: uuidV4(),
    title: connectionName,
    name: connectionId,
    url,
    component: DatabaseConsoleView,
    props: { sessionId: sessionId.value, connectionId, initialConnection }
  }
  databaseTabs.value.push(connectionTab)
  activeTabId.value = connectionTab.id
}

const removeDatabaseTab = (targetTabId) => {
  const tabs = databaseTabs.value
  if (activeTabId.value === targetTabId) {
    const currentIndex = tabs.findIndex((tab) => tab.id === targetTabId)
    const nextTab = tabs[currentIndex + 1] || tabs[currentIndex - 1] || tabs[0]
    if (nextTab) {
      activeTabId.value = nextTab.id
    }
  }
  databaseTabs.value = tabs.filter((tab) => tab.id !== targetTabId)
}
</script>

<style scoped>
.database-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 0;
  background: transparent;
  --database-panel-surface: transparent;
  --database-tab-active-surface: var(--app-control-background-soft);
  --database-soft-border: color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

:global(html:not(.dark) .database-container),
:global(html[data-theme='light'] .database-container) {
  --database-panel-surface: transparent;
  --database-tab-active-surface: var(--app-control-background-soft);
  --database-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
}

:global(html.dark .database-container),
:global(html[data-theme='dark'] .database-container) {
  --database-panel-surface: transparent;
  --database-tab-active-surface: var(--app-control-background-soft);
  --database-soft-border: color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.database-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  background: var(--database-panel-surface);
  backdrop-filter: none;
}

.database-panel :deep(.el-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.database-panel :deep(.el-tabs__header) {
  min-height: 36px;
  margin: 0;
  padding: 0 8px;
  background: var(--app-card-background);
}

.database-panel :deep(.el-tabs__nav-wrap) {
  padding: 0;
}

.database-panel :deep(.el-tabs--card > .el-tabs__header) {
  border-bottom: 1px solid var(--database-soft-border);
}

.database-panel :deep(.el-tabs--card > .el-tabs__header .el-tabs__nav) {
  border: none;
  gap: 2px;
}

.database-panel :deep(.el-tabs--card > .el-tabs__header .el-tabs__item) {
  height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: 0;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  background: transparent;
  transition: all 0.2s ease;
}

.database-panel :deep(.el-tabs--card > .el-tabs__header .el-tabs__item:hover) {
  color: var(--el-text-color-primary);
}

.database-panel :deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 650;
  background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  box-shadow: inset 0 -2px 0 var(--el-color-primary);
}

.database-panel :deep(.el-tabs--card > .el-tabs__header .el-tabs__item .is-icon-close) {
  border-radius: 50%;
}

.database-panel :deep(.el-tabs__nav-next),
.database-panel :deep(.el-tabs__nav-prev) {
  line-height: 40px;
}

.database-panel :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.database-panel :deep(.el-tab-pane) {
  height: 100%;
  overflow: hidden;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.tab-conn-name {
  display: inline-block;
  max-width: min(22vw, 240px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-tooltip {
  max-width: clamp(25rem, 32.5vw, 32.5rem);
  font-size: var(--el-font-size-extra-small);
}

.conn-tooltip .wrap {
  white-space: normal;
  word-break: break-all;
}

.mono {
  font-family: var(--el-font-family-mono);
}

@media (max-width: 768px) {
  .database-container {
    padding: 0;
    background: transparent;
  }

  .database-panel {
    border-radius: 0;
  }

  .database-panel :deep(.el-tabs) {
    padding: 0;
  }

  .database-panel :deep(.el-tabs--card > .el-tabs__header .el-tabs__item) {
    padding: 0 12px;
  }

  .tab-conn-name {
    max-width: 140px;
  }
}
</style>
