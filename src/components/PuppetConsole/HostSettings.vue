<template>
  <div class="host-settings-page">
    <div class="host-settings-panel">
      <div class="settings-toolbar">
        <div class="toolbar-copy">
          <h2 class="settings-title">
            主机设置
          </h2>
          <p class="settings-subtitle">
            管理控制台通用参数与当前会话组件能力
          </p>
        </div>
      </div>

      <div class="settings-content">
        <el-tabs
          v-model="activeTab"
          class="settings-tabs"
        >
          <el-tab-pane
            label="通用设置"
            name="general"
          >
            <div class="tab-pane-body">
              <div class="general-settings-grid">
                <div class="settings-card">
                  <div class="card-header stacked">
                    <div>
                      <div class="card-title">
                        会话控制
                      </div>
                      <p class="card-subtitle">
                        切换当前会话绑定的 HostId，变更后控制台会自动刷新。
                      </p>
                    </div>
                  </div>
                  <HostIdManager
                    :session-id="currentSessionId"
                    label="当前 HostId"
                    @hostid-changed="emit('hostid-changed')"
                  />
                </div>

                <div class="settings-card">
                  <div class="card-header stacked compact-card-header">
                    <div>
                      <div class="card-title">
                        显示与列表
                      </div>
                      <p class="card-subtitle">
                        控制控制台中列表视图的默认分页密度。
                      </p>
                    </div>
                  </div>
                  <el-form
                    label-width="110px"
                    label-position="left"
                    class="compact-settings-form"
                  >
                    <el-form-item label="列表每页条数">
                      <el-input-number
                        v-model="localSettings.listPageSize"
                        :min="10"
                        :max="500"
                        :step="10"
                        controls-position="right"
                      />
                      <span class="item-tip">应用于容器管理中的各类列表。</span>
                    </el-form-item>
                  </el-form>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane
            label="组件管理"
            name="component"
          >
            <div class="tab-pane-body">
              <div class="settings-card component-card">
                <div class="card-header">
                  <div>
                    <div class="card-title">
                      组件管理
                    </div>
                    <p class="card-subtitle">
                      查看可用组件与加载状态。绿色为已加载，灰色为可用未加载。
                    </p>
                  </div>
                  <div class="card-header-actions">
                    <el-input
                      v-model="componentSearch"
                      placeholder="搜索组件..."
                      size="small"
                      clearable
                      style="width: 180px"
                    >
                      <template #prefix>
                        <el-icon><Icon icon="mdi:magnify" /></el-icon>
                      </template>
                    </el-input>
                    <el-button
                      type="primary"
                      size="small"
                      :loading="componentLoading"
                      @click="handleRefreshComponents"
                    >
                      <template #icon>
                        <Icon :icon="iconMap.refresh" />
                      </template>
                      刷新
                    </el-button>
                  </div>
                </div>

                <div
                  v-if="availableComponents.length"
                  class="component-stats"
                >
                  <el-tag
                    size="small"
                    type="success"
                  >
                    已加载 {{ loadedSet.size }}
                  </el-tag>
                  <el-tag
                    size="small"
                    type="info"
                  >
                    可用 {{ availableComponents.length }}
                  </el-tag>
                  <el-tag
                    v-if="componentSearch"
                    size="small"
                  >
                    匹配 {{ filteredComponents.length }}
                  </el-tag>
                </div>

                <div
                  v-loading="componentLoading"
                  class="component-list"
                >
                  <div
                    v-if="!availableComponents.length && !componentError"
                    class="component-empty"
                  >
                    <span>暂未加载组件列表，可点击上方"刷新"。</span>
                  </div>
                  <div
                    v-else-if="componentError"
                    class="component-empty error-text"
                  >
                    {{ componentError }}
                  </div>
                  <el-scrollbar
                    v-else
                    class="component-scroll"
                  >
                    <div class="component-grid">
                      <div
                        v-for="comp in filteredComponents"
                        :key="comp"
                        class="component-item"
                        :class="{ 'component-loaded': loadedSet.has(comp) }"
                      >
                        <div class="component-meta">
                          <div
                            class="component-name"
                            :title="comp"
                          >
                            <el-icon
                              v-if="loadedSet.has(comp)"
                              color="var(--el-color-success)"
                              style="margin-right: 4px"
                            >
                              <Icon icon="mdi:check-circle" />
                            </el-icon>
                            <el-icon
                              v-else
                              color="var(--el-text-color-placeholder)"
                              style="margin-right: 4px"
                            >
                              <Icon icon="mdi:circle-outline" />
                            </el-icon>
                            {{ comp }}
                          </div>
                        </div>
                        <div class="component-actions">
                          <el-button
                            v-if="loadedSet.has(comp)"
                            type="primary"
                            size="small"
                            text
                            :loading="reloadingSet.has(comp)"
                            @click="handleReload(comp)"
                          >
                            重新加载
                          </el-button>
                          <el-button
                            v-else
                            type="success"
                            size="small"
                            text
                            :loading="reloadingSet.has(comp)"
                            @click="handleLoadNew(comp)"
                          >
                            加载
                          </el-button>
                        </div>
                      </div>
                    </div>
                  </el-scrollbar>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <div class="settings-footer">
        <el-button
          type="primary"
          @click="handleSave"
        >
          <template #icon>
            <Icon :icon="iconMap.check" />
          </template>
          保存设置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

import { Icon } from '@iconify/vue'
import { executeRequest } from '@/utils/apiUtils.js'
import { getLoadedComponentsApi, reloadComponentApi, loadComponentApi } from '@/services/api.js'
import { icons } from '@/utils/icons.js'
import HostIdManager from '@/components/PuppetConsole/HostIdManager.vue'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import { PUPPET_CONSOLE_SETTINGS_STORAGE_KEY } from '@/constants/app.js'

const props = defineProps({
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['hostid-changed', 'update:settings'])

const iconMap = icons
const activeTab = ref('general')

const localSettings = reactive({
  listPageSize: props.settings.listPageSize ?? 50
})

watch(
  () => props.settings.listPageSize,
  (value) => {
    if (typeof value === 'number' && value > 0) {
      localSettings.listPageSize = value
    }
  }
)

const persistSettings = () => {
  safeLocalStorage.setJSON(PUPPET_CONSOLE_SETTINGS_STORAGE_KEY, {
    listPageSize: localSettings.listPageSize
  })
}

const componentSearch = ref('')
const loadedComponents = ref([])
const availableComponents = ref([])
const componentLoading = ref(false)
const componentError = ref('')
const reloadingSet = ref(new Set())

const loadedSet = computed(() => new Set(loadedComponents.value))

const filteredComponents = computed(() => {
  const all = availableComponents.value
  if (!componentSearch.value) return all
  const q = componentSearch.value.toLowerCase()
  return all.filter(name => name.toLowerCase().includes(q))
})

const currentSessionId = computed(() => props.settings.sessionId || '')

const fetchComponents = async () => {
  loadedComponents.value = []
  availableComponents.value = []
  componentError.value = ''

  if (!currentSessionId.value) {
    componentError.value = '当前无有效会话，无法获取组件列表。'
    return
  }

  await executeRequest(
    async () => {
      const response = await getLoadedComponentsApi({
        sessionId: currentSessionId.value
      })
      const data = response?.data || {}

      const loaded = Array.isArray(data.components) ? data.components : []
      const available = Array.isArray(data.available) ? data.available : []

      loadedComponents.value = loaded

      // 合并已加载 + 可用，去重后排序
      const merged = new Set([...loaded, ...available])
      availableComponents.value = [...merged].sort()

      if (!availableComponents.value.length) {
        componentError.value = '当前会话未发现任何组件。'
      }
      return response
    },
    {
      loadingRef: componentLoading,
      successMessage: null,
      errorMessage: '获取组件列表失败',
      onError: () => {
        componentError.value = '获取组件列表失败'
      }
    }
  )
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'component' && !availableComponents.value.length && !componentError.value) {
      fetchComponents()
    }
  }
)

watch(
  () => currentSessionId.value,
  () => {
    loadedComponents.value = []
    availableComponents.value = []
    componentError.value = ''
    reloadingSet.value = new Set()
    if (activeTab.value === 'component') {
      fetchComponents()
    }
  }
)

const handleRefreshComponents = () => {
  fetchComponents()
}

const handleReload = async (classname) => {
  if (!currentSessionId.value) {
    showWarning('当前无有效会话，无法重新加载组件')
    return
  }

  reloadingSet.value.add(classname)
  try {
    await executeRequest(
      async () => {
        const response = await reloadComponentApi({
          sessionId: currentSessionId.value,
          classname
        })
        const data = response?.data || {}
        if (data.code === 200 && data.reloaded === true) {
          showSuccess(data.msg || '组件重新加载成功')
        } else if (data.code === 200 && data.cached === true) {
          showWarning('命中组件加载缓存，本次没有重新部署组件')
        } else {
          showError(data.msg || '组件重新加载失败')
        }
        return response
      },
      {
        loadingRef: null,
        successMessage: null,
        errorMessage: '组件重新加载失败'
      }
    )
  } finally {
    reloadingSet.value.delete(classname)
  }
}

const handleLoadNew = async (classname) => {
  if (!currentSessionId.value) {
    showWarning('当前无有效会话，无法加载组件')
    return
  }

  reloadingSet.value.add(classname)
  try {
    await executeRequest(
      async () => {
        const response = await loadComponentApi({
          sessionId: currentSessionId.value,
          params: { classname }
        })
        const data = response?.data || {}
        const inner = (data.code !== undefined && data.data) ? data.data : data
        if (inner.code === 200 || data.code === 200) {
          showSuccess(inner.msg || data.msg || '组件加载成功')
          loadedComponents.value = [...loadedComponents.value, classname]
        } else {
          showError(inner.msg || data.msg || '组件加载失败')
        }
        return response
      },
      {
        loadingRef: null,
        successMessage: null,
        errorMessage: '组件加载失败'
      }
    )
  } finally {
    reloadingSet.value.delete(classname)
  }
}

const handleSave = () => {
  const pageSize = Number(localSettings.listPageSize) || 50
  emit('update:settings', { ...props.settings, listPageSize: pageSize })
  persistSettings()
  showSuccess('主机设置已保存')
}
</script>

<style scoped>
.host-settings-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  --host-settings-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 94%,
    var(--el-bg-color-overlay)
  );
  --host-settings-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --host-settings-raised-surface: color-mix(
    in srgb,
    var(--app-card-background) 92%,
    var(--el-bg-color-overlay)
  );
  --host-settings-soft-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
}

:global(html:not(.dark) .host-settings-page),
:global(html[data-theme='light'] .host-settings-page) {
  --host-settings-panel-surface: var(--app-surface-background);
  --host-settings-muted-surface: #f2f2f2;
  --host-settings-raised-surface: var(--app-surface-background);
  --host-settings-soft-border: color-mix(in srgb, var(--el-border-color) 74%, transparent);
}

:global(html.dark .host-settings-page),
:global(html[data-theme='dark'] .host-settings-page) {
  --host-settings-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 86%,
    var(--el-bg-color-overlay)
  );
  --host-settings-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --host-settings-raised-surface: color-mix(
    in srgb,
    var(--app-card-background) 88%,
    var(--el-bg-color-overlay)
  );
  --host-settings-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

.host-settings-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--host-settings-panel-surface);
  box-shadow: none;
}

.settings-toolbar {
  padding: 14px 16px;
  border-bottom: 1px solid var(--host-settings-soft-border);
  background: var(--host-settings-muted-surface);
}

.settings-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.settings-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.settings-content {
  flex: 1;
  min-height: 0;
  padding: 10px 14px 0;
  overflow: hidden;
}

.settings-tabs {
  height: 100%;
}

.settings-tabs :deep(.el-tabs__header) {
  margin: 0 0 14px;
}

.settings-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--host-settings-soft-border);
}

.settings-tabs :deep(.el-tabs__item) {
  height: 38px;
  padding: 0 14px;
  border-radius: 12px 12px 0 0;
  font-weight: 600;
}

.settings-tabs :deep(.el-tabs__content) {
  height: calc(100% - 52px);
  overflow: hidden;
}

.settings-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-pane-body {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.general-settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  gap: 14px;
  align-items: start;
}

.settings-card {
  padding: 18px;
  border: 1px solid var(--host-settings-soft-border);
  border-radius: var(--radius-container);
  background: var(--host-settings-raised-surface);
  box-shadow: none;
}

.component-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-header.stacked {
  margin-bottom: 12px;
}

.compact-card-header {
  margin-bottom: 10px;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.card-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.item-tip {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.compact-settings-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.compact-settings-form :deep(.el-form-item__content) {
  flex-wrap: wrap;
  row-gap: 8px;
}

.component-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.component-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  color: var(--el-text-color-secondary);
  text-align: center;
  font-size: 12px;
}

.error-text {
  color: var(--el-color-danger);
}

.component-scroll {
  flex: 1;
  min-height: 0;
}

.component-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.component-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--host-settings-soft-border);
  border-radius: var(--radius-control);
  background: var(--host-settings-muted-surface);
}

.component-meta {
  min-width: 0;
  flex: 1;
}

.component-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}

.card-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.component-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.component-actions {
  flex-shrink: 0;
}

.component-loaded {
  border-color: color-mix(in srgb, var(--el-color-success) 30%, transparent);
  background: color-mix(in srgb, var(--el-color-success) 6%, var(--host-settings-muted-surface));
}

.settings-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--host-settings-soft-border);
  background: var(--host-settings-panel-surface);
}

.settings-footer :deep(.el-button) {
  border-radius: var(--radius-control);
  font-weight: 600;
}

@media (max-width: 768px) {
  .settings-content {
    padding: 10px 12px 0;
  }

  .general-settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-card {
    padding: 14px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .component-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
