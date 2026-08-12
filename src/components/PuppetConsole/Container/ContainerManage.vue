<template>
  <div class="container-manage-page">
    <div class="container-panel">
      <div class="container-toolbar">
        <div class="toolbar-title">
          <el-icon>
            <Icon :icon="iconMap.server" />
          </el-icon>
          <span>容器管理</span>
          <el-tag
            v-if="contexts.length"
            size="small"
            effect="plain"
            round
          >
            {{ contexts.length }} 个 Context
          </el-tag>
          <el-tag
            v-if="selectedRuntime"
            size="small"
            type="info"
            effect="plain"
          >
            {{ selectedRuntime.family }} {{ selectedRuntime.productVersion }}
          </el-tag>
          <el-tag
            v-if="selectedRuntime?.profileId"
            size="small"
            effect="plain"
          >
            {{ selectedRuntime.profileId }} · {{ selectedRuntime.namespace }}
          </el-tag>
        </div>

        <div class="toolbar-actions">
          <el-button
            type="success"
            size="small"
            :loading="exporting"
            :disabled="!contexts.length || exporting"
            @click="exportContainerInfo"
          >
            <el-icon>
              <Icon :icon="iconMap.download" />
            </el-icon>
            导出全部信息
          </el-button>
          <el-button
            type="primary"
            size="small"
            :loading="loading"
            @click="refreshRuntimeInfo"
          >
            <el-icon>
              <Icon :icon="iconMap.refresh" />
            </el-icon>
            刷新信息
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="error && contexts.length"
        class="refresh-alert"
        :title="error"
        type="warning"
        :closable="false"
        show-icon
      />

      <div
        v-if="loading && contexts.length === 0"
        class="loading-container"
      >
        <el-skeleton
          :rows="8"
          animated
        />
      </div>

      <div
        v-else-if="error && !contexts.length"
        class="error-container"
      >
        <el-result
          icon="error"
          :title="error"
          sub-title="请检查网络连接或重试"
        >
          <template #extra>
            <el-button
              type="primary"
              @click="fetchRuntimeInfo"
            >
              <el-icon>
                <Icon :icon="iconMap.refresh" />
              </el-icon>
              重试
            </el-button>
          </template>
        </el-result>
      </div>

      <div
        v-else-if="contexts.length > 0"
        class="workspace-shell"
      >
        <aside class="context-sidebar">
          <div class="context-list-panel">
            <div class="context-list-head">
              <strong>Context</strong>
              <span>{{ filteredContexts.length }} / {{ contexts.length }}</span>
            </div>

            <el-input
              v-model="contextSearchKeyword"
              clearable
              placeholder="搜索 Context / 路径 / 工作目录"
              class="context-search-input"
            >
              <template #prefix>
                <el-icon>
                  <Icon :icon="iconMap.search" />
                </el-icon>
              </template>
            </el-input>

            <el-scrollbar class="context-scrollbar">
              <div class="context-items">
                <button
                  v-for="(context, index) in filteredContexts"
                  :key="context.name || `context-${index}`"
                  type="button"
                  class="context-item"
                  :class="{ active: getContextKey(selectedContext) === getContextKey(context) }"
                  @click="selectContext(context)"
                >
                  <div class="context-main">
                    <el-icon class="context-icon">
                      <Icon :icon="iconMap.server" />
                    </el-icon>
                    <div class="context-copy">
                      <div class="context-title-row">
                        <span class="context-name">{{ getContextDisplayName(context) }}</span>
                        <code>{{ context.basePath || '/' }}</code>
                      </div>
                      <span class="context-subtitle">{{ context.workDir || '未提供工作目录' }}</span>
                    </div>
                  </div>
                  <div
                    class="context-metrics"
                    aria-label="入口组件统计"
                  >
                    <span>S {{ context.allServlet?.length || 0 }}</span>
                    <span>F {{ context.allFilter?.length || 0 }}</span>
                    <span>V {{ context.allValve?.length || 0 }}</span>
                    <span>L {{ context.allListener?.length || 0 }}</span>
                  </div>
                  <div class="context-actions">
                    <button
                      type="button"
                      class="icon-action"
                      title="导出 Context"
                      aria-label="导出 Context"
                      :disabled="exporting"
                      @click.stop="exportContextExcel(context)"
                    >
                      <Icon :icon="iconMap.download" />
                    </button>
                  </div>
                </button>

                <el-empty
                  v-if="filteredContexts.length === 0"
                  description="没有匹配的 Context"
                  :image-size="96"
                />
              </div>
            </el-scrollbar>
          </div>
        </aside>

        <main class="context-detail">
          <div
            v-if="selectedContext"
            class="context-overview-strip"
          >
            <div class="overview-main">
              <el-icon>
                <Icon :icon="iconMap.package" />
              </el-icon>
              <div>
                <strong>{{ getContextDisplayName(selectedContext) }}</strong>
                <span>{{ selectedContext.workDir || '未提供工作目录' }}</span>
              </div>
            </div>
            <div class="overview-fields">
              <span>
                <small>访问路径</small>
                <code>{{ selectedContext.basePath || '/' }}</code>
              </span>
              <span>
                <small>组件</small>
                <code>{{ getContextAssetScore(selectedContext) }}</code>
              </span>
              <span v-if="detectedFramework?.family">
                <small>框架</small>
                <code>{{ detectedFramework.family }}</code>
              </span>
              <button
                type="button"
                class="icon-action is-large"
                title="导出 Context"
                aria-label="导出 Context"
                :disabled="exporting"
                @click="exportContextExcel(selectedContext)"
              >
                <Icon :icon="iconMap.download" />
              </button>
            </div>
          </div>

          <ContextDetail
            v-if="selectedContext"
            :context="selectedContext"
            :framework-info="frameworkInfo"
            :session-id="sessionId"
            @refresh="fetchRuntimeInfo"
          />
          <el-empty
            v-else
            description="请选择一个 Context 查看资产明细"
            :image-size="120"
          />
        </main>
      </div>

      <div
        v-else
        class="empty-container"
      >
        <el-empty
          description="暂无 Context 信息"
          :image-size="120"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'

import { inspectWebRuntimeApi } from '@/services/api.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import ContextDetail from './ContextDetail.vue'
import {
  filterRuntimeContexts,
  getContextAssetScore,
  getContextDisplayName,
  getContextKey,
  normalizeWebRuntimePayload,
  sortRuntimeContexts
} from './containerManageModel.js'
import {
  buildAllContextsExportSpec,
  buildContextExportSpec,
  writeWorkbookSpec
} from './containerExport.js'

const iconMap = icons
const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const runtimes = ref([])
const contexts = ref([])
const selectedContext = ref(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref(null)
const contextSearchKeyword = ref('')
const requestGuard = createLatestRequestGuard(['info', 'export'])
let mounted = true

const filteredContexts = computed(() =>
  filterRuntimeContexts(contexts.value, contextSearchKeyword.value)
)
const selectedRuntime = computed(() =>
  runtimes.value.find(runtime => runtime.runtimeId === selectedContext.value?.runtimeId) || runtimes.value[0] || null
)
const frameworkInfo = computed(() => selectedContext.value?.frameworkInfo || null)
const detectedFramework = computed(() =>
  frameworkInfo.value || selectedRuntime.value?.frameworks?.[0] || null
)

const clearContainerState = () => {
  contexts.value = []
  runtimes.value = []
  selectedContext.value = null
  contextSearchKeyword.value = ''
  error.value = null
}

const reconcileSelectedContext = contexts => {
  const currentKey = getContextKey(selectedContext.value)
  selectedContext.value = contexts.find(context => getContextKey(context) === currentKey) || contexts[0] || null
}

const fetchRuntimeInfo = async () => {
  const sessionId = props.sessionId
  if (!sessionId) {
    clearContainerState()
    return null
  }

  const sequence = requestGuard.next('info')
  loading.value = true
  error.value = null
  try {
    const response = await inspectWebRuntimeApi({ sessionId })
    if (!mounted || !requestGuard.isCurrent('info', sequence) || sessionId !== props.sessionId) return null
    const normalized = normalizeWebRuntimePayload(response.data)
    if (!normalized.ok) {
      error.value = normalized.error
      showError(normalized.error)
      return null
    }

    runtimes.value = normalized.runtimes
    contexts.value = normalized.contexts
    reconcileSelectedContext(sortRuntimeContexts(normalized.contexts))
    return normalized
  } catch (requestError) {
    if (!mounted || !requestGuard.isCurrent('info', sequence) || sessionId !== props.sessionId) return null
    error.value = '获取 Web Runtime 信息失败'
    showError(`获取 Web Runtime 信息失败：${requestError?.message || '未知错误'}`)
    return null
  } finally {
    if (requestGuard.isCurrent('info', sequence)) loading.value = false
  }
}

const refreshRuntimeInfo = () => fetchRuntimeInfo()
const selectContext = context => { selectedContext.value = context }

const runExport = async spec => {
  if (exporting.value) return false
  const sequence = requestGuard.next('export')
  exporting.value = true
  try {
    await writeWorkbookSpec(spec)
    if (!mounted || !requestGuard.isCurrent('export', sequence)) return false
    showSuccess('容器信息已导出')
    return true
  } catch (exportError) {
    if (mounted && requestGuard.isCurrent('export', sequence)) {
      showError(`导出容器信息失败：${exportError?.message || '未知错误'}`)
    }
    return false
  } finally {
    if (requestGuard.isCurrent('export', sequence)) exporting.value = false
  }
}

const exportContextExcel = context => {
  if (!context) return Promise.resolve(false)
  return runExport(buildContextExportSpec(context, frameworkInfo.value))
}

const exportContainerInfo = () => {
  if (!contexts.value.length) return Promise.resolve(false)
  return runExport(buildAllContextsExportSpec(contexts.value, frameworkInfo.value))
}

watch(
  () => props.sessionId,
  sessionId => {
    requestGuard.invalidate(['info'])
    loading.value = false
    clearContainerState()
    if (sessionId) fetchRuntimeInfo()
  },
  { immediate: true }
)

watch(filteredContexts, contexts => {
  if (!contexts.length) {
    selectedContext.value = null
    return
  }
  const currentKey = getContextKey(selectedContext.value)
  selectedContext.value = contexts.find(context => getContextKey(context) === currentKey) || contexts[0]
})

onUnmounted(() => {
  mounted = false
  requestGuard.invalidate()
})
</script>

<style scoped>
@import '@/styles/container-shell-shared.css';

.container-manage-page {
  height: 100%;
  min-height: 0;
  padding: 0;
  background: transparent;
  --container-muted-surface: var(--app-control-background-soft);
  --container-strong-surface: var(--app-card-background);
  --container-soft-border: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  --container-primary: var(--el-color-primary);
  --container-primary-soft: color-mix(in srgb, var(--el-color-primary) 14%, var(--app-card-background));
  --container-primary-border: color-mix(in srgb, var(--el-color-primary) 36%, var(--el-border-color));
}

:global(html:not(.dark) .container-manage-page),
:global(html[data-theme='light'] .container-manage-page) {
  --container-muted-surface: var(--app-control-background-soft);
  --container-strong-surface: var(--app-card-background);
  --container-soft-border: color-mix(in srgb, var(--el-border-color) 18%, transparent);
  --container-primary-soft: color-mix(in srgb, var(--el-color-primary) 14%, var(--app-card-background));
  --container-primary-border: color-mix(in srgb, var(--el-color-primary) 38%, var(--el-border-color));
}

:global(html.dark .container-manage-page),
:global(html[data-theme='dark'] .container-manage-page) {
  --container-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 84%,
    var(--el-bg-color-overlay)
  );
  --container-strong-surface: color-mix(
    in srgb,
    var(--app-card-background) 90%,
    var(--el-bg-color-overlay)
  );
  --container-soft-border: color-mix(in srgb, var(--el-border-color) 18%, transparent);
  --container-primary-soft: color-mix(in srgb, var(--el-color-primary) 24%, var(--app-card-background));
  --container-primary-border: color-mix(in srgb, var(--el-color-primary) 48%, var(--el-border-color));
}

.container-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0;
  background: transparent;
  padding: 6px;
  gap: 10px;
}

.container-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius-container);
  background: color-mix(in srgb, var(--container-muted-surface) 90%, transparent);
  border: 0;
  flex-shrink: 0;
  gap: 12px;
}

.toolbar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.toolbar-title .el-icon {
  color: var(--container-primary);
}

.toolbar-title :deep(.el-tag) {
  --el-tag-bg-color: var(--container-primary-soft);
  --el-tag-border-color: var(--container-primary-border);
  --el-tag-text-color: var(--container-primary);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.refresh-alert {
  flex-shrink: 0;
}

.loading-container,
.error-container,
.empty-container {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-container {
  padding: 20px;
  align-items: flex-start;
}

.workspace-shell {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.context-sidebar {
  width: 312px;
  flex-shrink: 0;
  min-height: 0;
}

.context-list-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid var(--container-soft-border);
  border-radius: var(--radius-container);
  background: var(--container-strong-surface);
}

.context-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 28px;
}

.context-list-head strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.2;
}

.context-list-head span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.context-scrollbar {
  flex: 1;
  min-height: 0;
}

.context-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
  min-height: 100%;
}

.context-item {
  position: relative;
  width: 100%;
  min-width: 0;
  padding: 9px 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid var(--container-soft-border);
  border-radius: var(--radius-control);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.context-item::before {
  content: '';
  position: absolute;
  inset: 8px auto 8px 0;
  width: 3px;
  border-radius: 999px;
  background: transparent;
}

.context-item:hover,
.context-item.active {
  background: var(--container-primary-soft);
}

.context-item.active {
  border-color: var(--container-primary-border);
}

.context-item.active::before {
  background: var(--el-color-primary);
}

.context-item:focus-visible,
.icon-action:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.context-main {
  min-width: 0;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.context-icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--container-primary-soft);
  color: var(--container-primary);
  font-size: 14px;
}

.context-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.context-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.context-title-row code,
.overview-fields code {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--container-muted-surface);
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-family: inherit;
}

.context-name {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-subtitle {
  font-size: 12px;
  line-height: 1.25;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-metrics {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 4px 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.context-actions {
  display: flex;
  justify-content: flex-end;
}

.icon-action {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--container-primary-border);
  border-radius: 8px;
  background: var(--container-primary-soft);
  color: var(--container-primary);
  cursor: pointer;
}

.icon-action:hover {
  background: color-mix(in srgb, var(--el-color-primary) 22%, var(--app-card-background));
  color: var(--container-primary);
}

.icon-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.context-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.context-overview-strip {
  min-height: 58px;
  flex: 0 0 auto;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--container-soft-border);
  border-radius: var(--radius-container);
  background: var(--container-strong-surface);
}

.overview-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.overview-main .el-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--container-primary);
  background: var(--container-primary-soft);
}

.overview-main div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.overview-main strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.15;
}

.overview-main span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-fields {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.overview-fields span {
  min-height: 34px;
  padding: 5px 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--container-primary-soft) 72%, var(--app-card-background));
  border: 1px solid color-mix(in srgb, var(--container-primary-border) 72%, transparent);
}

.overview-fields small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.icon-action.is-large {
  width: 34px;
  height: 34px;
}

.toolbar-actions :deep(.el-button) {
  border-radius: var(--radius-control);
  font-weight: 600;
}

.toolbar-actions :deep(.el-button--primary),
.toolbar-actions :deep(.el-button--success) {
  box-shadow: none;
  background: var(--el-button-bg-color) !important;
  border-color: var(--el-button-border-color) !important;
  color: var(--el-button-text-color) !important;
}

.toolbar-actions :deep(.el-button--primary) {
  --el-button-bg-color: var(--el-color-primary);
  --el-button-border-color: var(--el-color-primary);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: var(--el-color-primary-light-3);
  --el-button-hover-border-color: var(--el-color-primary-light-3);
  --el-button-hover-text-color: #fff;
}

.toolbar-actions :deep(.el-button--success) {
  --el-button-bg-color: var(--el-color-success);
  --el-button-border-color: var(--el-color-success);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: var(--el-color-success-light-3);
  --el-button-hover-border-color: var(--el-color-success-light-3);
  --el-button-hover-text-color: #fff;
}

@media (max-width: 768px) {
  .container-manage-page {
    padding: 0;
    background: transparent;
  }

  .container-panel {
    border-radius: 20px;
    padding: 12px;
  }

  .container-toolbar {
    padding: 12px;
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .workspace-shell {
    flex-direction: column;
  }

  .context-sidebar {
    width: 100%;
  }

  .context-item {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .context-actions {
    display: none;
  }

  .context-overview-strip {
    align-items: flex-start;
    flex-direction: column;
  }

  .overview-fields {
    justify-content: flex-start;
  }
}
</style>
