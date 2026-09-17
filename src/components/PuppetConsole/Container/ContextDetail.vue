<template>
  <div class="context-detail-container">
    <div class="asset-workbench">
      <div class="asset-toolbar">
        <div
          class="asset-switcher"
          role="tablist"
          aria-label="组件类型"
        >
          <button
            v-for="tab in tabDefinitions"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            class="asset-switch"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <el-icon>
              <Icon :icon="tab.icon" />
            </el-icon>
            <span class="asset-switch-name">{{ tab.label }}</span>
            <span class="asset-switch-count">{{ tab.count }}</span>
          </button>
        </div>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索当前组件"
          aria-label="搜索当前组件"
          clearable
          class="asset-search"
        >
          <template #prefix>
            <Icon :icon="iconMap.search" />
          </template>
        </el-input>
      </div>

      <div
        class="asset-panel-shell"
        role="tabpanel"
        :aria-label="selectedTab?.label"
      >
        <component
          :is="selectedTab.component"
          v-if="selectedTab?.component"
          v-bind="activeComponentProps"
          @refresh="emit('refresh')"
          @view-bytecode="emit('view-bytecode', $event)"
          @view-detail="emit('view-detail', $event)"
        />
        <ContainerAssetPanel
          v-else-if="selectedTab?.key === 'runtime'"
          title="框架运行时组件"
          :total="selectedTab.items.length"
          :filtered="runtimeItems.length"
        >
          <el-table
            :data="runtimeItems"
            height="100%"
            empty-text="暂无运行时组件"
          >
            <el-table-column
              prop="role"
              label="类型"
              min-width="150"
            />
            <el-table-column
              prop="className"
              label="类名"
              min-width="260"
            />
          </el-table>
        </ContainerAssetPanel>
        <el-empty
          v-else
          description="暂无可查看的组件"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { icons as iconMap } from '@/utils/icons.js'
import ServletList from './ServletList.vue'
import FilterList from './FilterList.vue'
import ValveList from './ValveList.vue'
import ListenerList from './ListenerList.vue'
import ControllerList from './ControllerList.vue'
import InterceptorList from './InterceptorList.vue'
import ContainerAssetPanel from './ContainerAssetPanel.vue'

const props = defineProps({
  context: { type: Object, default: null },
  frameworkInfo: { type: Object, default: null },
  sessionId: { type: String, required: true }
})
const emit = defineEmits(['refresh', 'view-bytecode', 'view-detail'])
const searchKeyword = ref('')
const activeTab = ref('servlet')
const assetTypes = [
  { key: 'servlet', label: 'Servlet', icon: iconMap.code, component: ServletList, field: 'allServlet', prop: 'servlets' },
  { key: 'filter', label: 'Filter', icon: iconMap.filter, component: FilterList, field: 'allFilter', prop: 'filters' },
  { key: 'controller', label: '控制器', icon: iconMap.code, component: ControllerList, field: 'allController', prop: 'controllers', framework: true },
  { key: 'interceptor', label: '拦截器', icon: iconMap.shield, component: InterceptorList, field: 'allMappedInterceptor', prop: 'interceptors', framework: true },
  { key: 'valve', label: 'Valve', icon: iconMap.shield, component: ValveList, field: 'allValve', prop: 'valves' },
  { key: 'listener', label: 'Listener', icon: iconMap.shield, component: ListenerList, field: 'allListener', prop: 'listeners' },
  { key: 'runtime', label: '运行时组件', icon: iconMap.package, field: 'runtimeComponents', framework: true }
]
const tabDefinitions = computed(() => assetTypes.flatMap(tab => {
  const source = tab.framework ? props.frameworkInfo : props.context
  if (!source) return []
  const capability = source.capabilities?.[tab.key]
  if (tab.key === 'runtime' ? !source.runtimeComponents?.length : capability?.inspect !== true) return []
  const items = source[tab.field] || []
  return [{ ...tab, items, count: items.length, removable: Boolean(props.context?.contextId) && capability?.remove === true }]
}))
const selectedTab = computed(() => tabDefinitions.value.find(tab => tab.key === activeTab.value))
const runtimeItems = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return (selectedTab.value?.items || []).filter(item =>
    !keyword || [item.role, item.className].some(value => String(value || '').toLowerCase().includes(keyword)))
})
const activeComponentProps = computed(() => ({
  searchKeyword: searchKeyword.value,
  [selectedTab.value?.prop]: selectedTab.value?.items || [],
  contextId: props.context?.contextId || '',
  contextName: props.context ? `${props.context.host || ''} · ${props.context.name || 'ROOT'}` : '',
  removable: selectedTab.value?.removable === true,
  sessionId: props.sessionId
}))
watch(activeTab, () => { searchKeyword.value = '' })
watch(tabDefinitions, tabs => {
  if (!tabs.some(tab => tab.key === activeTab.value)) activeTab.value = tabs[0]?.key || ''
}, { immediate: true })
</script>

<style scoped>
.context-detail-container,
.asset-workbench {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.asset-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding-bottom: 12px;
}
.asset-switcher {
  display: flex;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
}
.asset-switch {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  padding: 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.asset-switch:hover { color: var(--el-color-primary); }
.asset-switch.active {
  border-bottom-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.asset-switch:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.asset-switch-name { font-size: 13px; font-weight: 600; }
.asset-switch-count { font-size: 11px; opacity: 0.8; font-variant-numeric: tabular-nums; }
.asset-search { flex: 0 1 180px; min-width: 140px; margin-left: auto; }
.asset-panel-shell { flex: 1; min-height: 0; overflow: hidden; }
</style>
