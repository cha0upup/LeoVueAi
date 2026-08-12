<template>
  <div class="context-detail-container">
    <div class="asset-workbench">
      <div class="asset-switcher">
        <button
          v-for="tab in tabDefinitions"
          :key="tab.key"
          type="button"
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

      <div class="asset-panel-shell">
        <component
          :is="activeComponent"
          v-if="activeComponent"
          v-bind="activeComponentProps"
          @refresh="emit('refresh')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import ServletList from './ServletList.vue'
import FilterList from './FilterList.vue'
import ValveList from './ValveList.vue'
import ListenerList from './ListenerList.vue'
import ControllerList from './ControllerList.vue'
import InterceptorList from './InterceptorList.vue'

const iconMap = icons

// Props
const props = defineProps({
  context: {
    type: Object,
    required: true
  },
  frameworkInfo: {
    type: Object,
    required: false,
    default: null
  },
  sessionId: {
    type: String,
    required: true
  }
})

// 定义事件
const emit = defineEmits(['refresh'])

// 响应式数据
const activeTab = ref('servlet')

const tabDefinitions = computed(() => {
  return [
    {
      key: 'servlet',
      label: 'Servlet',
      icon: iconMap.code,
      count: props.context.allServlet?.length || 0,
      visible: props.context.capabilities?.servlet?.inspect === true
    },
    {
      key: 'filter',
      label: 'Filter',
      icon: iconMap.filter,
      count: props.context.allFilter?.length || 0,
      visible: props.context.capabilities?.filter?.inspect === true
    },
    {
      key: 'controller',
      label: '控制器',
      icon: iconMap.code,
      count: props.frameworkInfo?.allController?.length || 0,
      visible: props.context.capabilities?.controller?.inspect === true && Boolean(props.frameworkInfo)
    },
    {
      key: 'interceptor',
      label: '拦截器',
      icon: iconMap.shield,
      count: props.frameworkInfo?.allMappedInterceptor?.length || 0,
      visible: props.context.capabilities?.interceptor?.inspect === true && Boolean(props.frameworkInfo)
    },
    {
      key: 'valve',
      label: 'Valve',
      icon: iconMap.shield,
      count: props.context.allValve?.length || 0,
      visible: props.context.capabilities?.valve?.inspect === true
    },
    {
      key: 'listener',
      label: 'Listener',
      icon: iconMap.shield,
      count: props.context.allListener?.length || 0,
      visible: props.context.capabilities?.listener?.inspect === true
    }
  ].filter((item) => item.visible !== false)
})

const activeComponent = computed(() => {
  switch (activeTab.value) {
    case 'servlet':
      return ServletList
    case 'filter':
      return FilterList
    case 'controller':
      return ControllerList
    case 'interceptor':
      return InterceptorList
    case 'valve':
      return ValveList
    case 'listener':
      return ListenerList
    default:
      return null
  }
})

const activeComponentProps = computed(() => {
  switch (activeTab.value) {
    case 'servlet':
      return {
        servlets: props.context.allServlet || [],
        contextName: props.context.name,
        removable: props.context.capabilities?.servlet?.remove === true,
        sessionId: props.sessionId
      }
    case 'filter':
      return {
        filters: props.context.allFilter || [],
        contextName: props.context.name,
        removable: props.context.capabilities?.filter?.remove === true,
        sessionId: props.sessionId
      }
    case 'controller':
      return {
        controllers: props.frameworkInfo?.allController || [],
        contextName: props.context.name,
        removable: props.context.capabilities?.controller?.remove === true,
        sessionId: props.sessionId
      }
    case 'interceptor':
      return {
        interceptors: props.frameworkInfo?.allMappedInterceptor || [],
        contextName: props.context.name,
        removable: props.context.capabilities?.interceptor?.remove === true,
        sessionId: props.sessionId
      }
    case 'valve':
      return {
        valves: props.context.allValve || [],
        contextName: props.context.name,
        removable: props.context.capabilities?.valve?.remove === true,
        sessionId: props.sessionId
      }
    case 'listener':
      return {
        listeners: props.context.allListener || [],
        contextName: props.context.name,
        removable: props.context.capabilities?.listener?.remove === true,
        sessionId: props.sessionId
      }
    default:
      return {}
  }
})

watch(
  tabDefinitions,
  (tabs) => {
    if (!tabs.some((tab) => tab.key === activeTab.value)) {
      activeTab.value = tabs[0]?.key || 'servlet'
    }
  },
  { immediate: true }
)
</script>

<style scoped>
@import '@/styles/container-shell-shared.css';

.context-detail-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.asset-workbench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.asset-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.asset-switch {
  min-width: 106px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--container-soft-border);
  background: var(--container-strong-surface);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.asset-switch .el-icon {
  color: var(--el-text-color-secondary);
}

.asset-switch:hover,
.asset-switch.active {
  transform: none;
  border-color: var(--container-soft-border);
  background: var(--container-muted-surface);
  box-shadow: none;
}

.asset-switch-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.asset-switch-count {
  margin-left: auto;
  min-width: 24px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--container-muted-surface);
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}

.asset-panel-shell {
  flex: 1;
  min-height: 0;
  background: var(--container-strong-surface, var(--app-card-background));
  border: 1px solid var(--container-soft-border);
  border-radius: 14px;
  padding: 10px;
  box-shadow: none;
}

@media (max-width: 768px) {
  .asset-panel-shell {
    padding: 12px;
  }
}
</style>
