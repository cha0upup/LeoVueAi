<template>
  <div class="container-manage-page">
    <div
      class="container-panel"
      :class="{ 'is-sidebar-collapsed': sidebarCollapsed }"
    >
      <header class="container-toolbar">
        <div class="toolbar-title">
          <el-button
            text
            class="sidebar-toggle"
            :aria-label="sidebarCollapsed ? '展开 Context 列表' : '收起 Context 列表'"
            :title="sidebarCollapsed ? '展开 Context 列表' : '收起 Context 列表'"
            :aria-expanded="!sidebarCollapsed"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <Icon :icon="iconMap.menu" />
          </el-button>
          <strong>容器管理</strong>
          <el-tooltip
            v-if="selectedRuntime"
            :content="runtimeDescription"
            placement="bottom"
          >
            <span
              class="runtime-label"
              tabindex="0"
            >{{ selectedRuntime.family }} {{ selectedRuntime.productVersion }}</span>
          </el-tooltip>
        </div>
        <div class="toolbar-actions">
          <el-button
            size="small"
            :loading="exporting"
            :disabled="!runtimes.length || exporting"
            @click="exportContainerInfo"
          >
            <Icon :icon="iconMap.download" /> 导出全部
          </el-button>
          <el-button
            size="small"
            :loading="loading"
            @click="fetchRuntimeInfo"
          >
            <Icon :icon="iconMap.refresh" /> 刷新
          </el-button>
        </div>
      </header>
      <el-alert
        v-if="error && runtimes.length"
        :title="error"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-alert
        v-for="diagnostic in diagnostics"
        :key="diagnostic"
        :title="diagnostic"
        type="info"
        :closable="false"
        show-icon
      />

      <div
        v-if="loading && !runtimes.length"
        class="loading-container"
      >
        <el-skeleton
          :rows="8"
          animated
        />
      </div>
      <div
        v-else-if="error && !runtimes.length"
        class="empty-container"
      >
        <el-result
          icon="error"
          :title="error"
          sub-title="请检查网络连接或重试"
        >
          <template #extra>
            <el-button @click="fetchRuntimeInfo">
              重试
            </el-button>
          </template>
        </el-result>
      </div>
      <div
        v-else-if="contexts.length || unboundFrameworks.length"
        class="workspace-shell"
      >
        <aside
          class="context-sidebar"
          aria-label="Context 与框架导航"
        >
          <div class="context-list-head">
            <strong>Context</strong><span>{{ contexts.length }}</span>
          </div>
          <el-input
            v-model="contextSearchKeyword"
            clearable
            placeholder="搜索 Context"
            aria-label="搜索 Context"
          >
            <template #prefix>
              <Icon :icon="iconMap.search" />
            </template>
          </el-input>
          <el-scrollbar class="context-scrollbar">
            <div class="context-items">
              <button
                v-for="context in filteredContexts"
                :key="getContextKey(context)"
                type="button"
                class="context-item"
                :class="{ active: selectedKey === getContextKey(context) }"
                :aria-current="selectedKey === getContextKey(context) ? 'true' : undefined"
                @click="selectedKey = getContextKey(context)"
              >
                <span class="context-name">{{ getContextDisplayName(context) }}</span>
                <span class="context-asset-count">{{ getContextAssetScore(context) }} 项</span>
                <span class="context-subtitle">{{ context.host || context.basePath || '/' }}</span>
              </button>
              <p
                v-if="!filteredContexts.length"
                class="sidebar-empty"
              >
                没有匹配的 Context
              </p>
            </div>
            <div
              v-if="unboundFrameworks.length"
              class="framework-group"
            >
              <div class="context-list-head">
                <strong>框架视图</strong><span>只读</span>
              </div>
              <button
                v-for="framework in unboundFrameworks"
                :key="framework.key"
                type="button"
                class="context-item"
                :class="{ active: selectedKey === framework.key }"
                :aria-current="selectedKey === framework.key ? 'true' : undefined"
                @click="selectedKey = framework.key"
              >
                <span class="context-name">{{ framework.family }}</span>
                <span class="context-subtitle">归属未确定</span>
              </button>
            </div>
          </el-scrollbar>
        </aside>
        <main class="context-detail">
          <el-select
            v-model="selectedKey"
            class="compact-context-picker"
            aria-label="选择 Context 或框架"
            placeholder="选择 Context 或框架"
            filterable
            @change="contextSearchKeyword = ''"
          >
            <el-option-group label="Context">
              <el-option
                v-for="context in contexts"
                :key="getContextKey(context)"
                :value="getContextKey(context)"
                :label="`${getContextDisplayName(context)} · ${context.host || '/'}`"
              />
            </el-option-group>
            <el-option-group
              v-if="unboundFrameworks.length"
              label="框架视图 · 只读"
            >
              <el-option
                v-for="framework in unboundFrameworks"
                :key="framework.key"
                :value="framework.key"
                :label="framework.family"
              />
            </el-option-group>
          </el-select>
          <div
            v-if="selectedContext || selectedFramework"
            class="context-overview"
          >
            <div class="context-heading">
              <h3>{{ selectedContext ? getContextDisplayName(selectedContext) : selectedFramework.family }}</h3>
              <span
                v-if="selectedContext"
                class="context-location"
              >{{ selectedContext.host }}<template v-if="selectedContext.workDir"> · {{ selectedContext.workDir }}</template></span>
              <span
                v-else
                class="readonly-label"
              >只读</span>
            </div>
            <el-button
              v-if="selectedContext"
              text
              size="small"
              title="导出当前 Context"
              aria-label="导出当前 Context"
              :disabled="exporting"
              @click="exportContextExcel(selectedContext)"
            >
              <Icon :icon="iconMap.download" />
            </el-button>
          </div>
          <p
            v-if="selectedFramework"
            class="framework-note"
          >
            尚未确定所属 Context，此视图仅供查看。
          </p>
          <ContextDetail
            v-if="selectedContext || selectedFramework"
            :key="`${sessionId}:${selectedKey}`"
            :context="selectedContext"
            :framework-info="frameworkInfo"
            :session-id="sessionId"
            @refresh="fetchRuntimeInfo"
            @view-bytecode="viewBytecode"
            @view-detail="viewAssetDetail"
          />
          <el-empty
            v-else
            description="请选择一个 Context 查看组件"
            :image-size="96"
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
    <el-drawer
      v-model="assetDetailVisible"
      :title="selectedAsset?.title || '组件详情'"
      size="min(560px, 92vw)"
      append-to-body
    >
      <template v-if="selectedAsset">
        <div class="asset-detail-actions">
          <el-button
            size="small"
            @click="copyAssetDetails"
          >
            <Icon :icon="iconMap.copy" /> 复制详情
          </el-button>
          <el-button
            v-if="selectedAsset.className"
            size="small"
            type="primary"
            @click="viewBytecode(selectedAsset.className)"
          >
            <Icon :icon="iconMap.code" /> 查看字节码
          </el-button>
        </div>
        <dl class="asset-detail-fields">
          <div
            v-for="[label, value] in selectedAsset.fields"
            :key="label"
          >
            <dt>{{ label }}</dt><dd>{{ detailValue(value) }}</dd>
          </div>
        </dl>
      </template>
    </el-drawer>
    <ClassBytecodeDialog
      v-model="bytecodeDialogVisible"
      :session-id="sessionId"
      :class-name="selectedClassName"
      @close="selectedClassName = ''"
    />
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'

import { inspectWebRuntimeApi } from '@/services/api.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import ContextDetail from './ContextDetail.vue'
import ClassBytecodeDialog from './ClassBytecodeDialog.vue'
import {
  filterRuntimeContexts,
  getContextAssetScore,
  getContextDisplayName,
  getContextKey,
  normalizeWebRuntimePayload
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
const selectedKey = ref(null)
const diagnostics = ref([])
const sidebarCollapsed = ref(false)
const selectedAsset = ref(null)
const assetDetailVisible = ref(false)
const bytecodeDialogVisible = ref(false)
const selectedClassName = ref('')
const loading = ref(false)
const exporting = ref(false)
const error = ref(null)
const contextSearchKeyword = ref('')
const requestGuard = createLatestRequestGuard(['info', 'export'])
let mounted = true

const filteredContexts = computed(() =>
  filterRuntimeContexts(contexts.value, contextSearchKeyword.value)
)
const unboundFrameworks = computed(() => runtimes.value.flatMap(runtime =>
  runtime.frameworks.filter(framework => !framework.contextId).map(framework => ({
    ...framework,
    runtimeId: runtime.runtimeId,
    key: `framework:${runtime.runtimeId}:${framework.frameworkId}`
  }))
))
const selectedContext = computed(() => filteredContexts.value.find(context => getContextKey(context) === selectedKey.value) || null)
const selectedFramework = computed(() => unboundFrameworks.value.find(framework => framework.key === selectedKey.value) || null)
const selectedRuntime = computed(() =>
  runtimes.value.find(runtime => runtime.runtimeId === (selectedContext.value?.runtimeId || selectedFramework.value?.runtimeId)) || runtimes.value[0] || null
)
const frameworkInfo = computed(() => selectedContext.value?.frameworkInfo || selectedFramework.value)
const runtimeDescription = computed(() => selectedRuntime.value
  ? `版本适配：${selectedRuntime.value.profileId} · ${selectedRuntime.value.namespace}` : '')
const detailValue = value => Array.isArray(value) ? value.join('\n') || '—' : String(value ?? '') || '—'
const viewAssetDetail = asset => {
  selectedAsset.value = asset
  assetDetailVisible.value = true
}
const copyAssetDetails = async () => {
  if (!selectedAsset.value) return
  try {
    await navigator.clipboard.writeText(selectedAsset.value.fields.map(([label, value]) => `${label}: ${detailValue(value)}`).join('\n'))
    showSuccess('组件详情已复制')
  } catch {
    showError('复制失败，请手动选择内容复制')
  }
}

const viewBytecode = className => {
  if (!className) return
  selectedClassName.value = className
  bytecodeDialogVisible.value = true
}
const clearContainerState = () => {
  contexts.value = []
  runtimes.value = []
  selectedKey.value = null
  diagnostics.value = []
  contextSearchKeyword.value = ''
  error.value = null
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
    const diagnosticLabels = {
      RUNTIME_VERSION_UNKNOWN: '容器版本未识别，容器组件仅供查看'
    }
    diagnostics.value = normalized.diagnostics.filter(value => value !== 'FRAMEWORK_CONTEXT_UNRESOLVED').map(value => diagnosticLabels[value] || String(value))
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
  return runExport(buildContextExportSpec(context))
}

const exportContainerInfo = () => {
  if (!runtimes.value.length) return Promise.resolve(false)
  return runExport(buildAllContextsExportSpec(contexts.value, runtimes.value.flatMap(runtime => runtime.frameworks)))
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

watch([filteredContexts, unboundFrameworks], ([contextList, frameworks]) => {
  if (!contextList.some(context => getContextKey(context) === selectedKey.value) &&
      !frameworks.some(framework => framework.key === selectedKey.value)) {
    selectedKey.value = getContextKey(contextList[0]) || frameworks[0]?.key || null
  }
})
watch(() => [props.sessionId, selectedKey.value], () => {
  bytecodeDialogVisible.value = false
  selectedClassName.value = ''
  assetDetailVisible.value = false
  selectedAsset.value = null
})

onUnmounted(() => {
  mounted = false
  requestGuard.invalidate()
})
</script>

<style scoped>
.container-manage-page {
  height: 100%;
  min-height: 0;
  container-type: inline-size;
  --container-muted-surface: var(--app-control-background-soft, var(--el-fill-color-light));
  --container-strong-surface: var(--app-card-background, var(--el-bg-color));
  --container-soft-border: var(--el-border-color-lighter);
}
.container-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 10px; padding: 6px; overflow: hidden; }
.container-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 6px; flex-wrap: wrap; }
.toolbar-title, .toolbar-actions { display: flex; align-items: center; gap: 8px; min-width: 0; }
.toolbar-title { font-size: 14px; flex-wrap: wrap; }
.toolbar-title strong { white-space: nowrap; }
.runtime-label { color: var(--el-text-color-secondary); font-size: 12px; cursor: help; }
.toolbar-actions { margin-left: auto; }
.toolbar-actions :deep(.el-button + .el-button) { margin-left: 0; }
.toolbar-actions :deep(.iconify), .asset-detail-actions :deep(.iconify) { margin-right: 4px; }
.workspace-shell { flex: 1; min-height: 0; display: grid; grid-template-columns: 200px minmax(0, 1fr); border: 1px solid var(--container-soft-border); border-radius: 10px; overflow: hidden; background: var(--container-strong-surface); }
.context-sidebar { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 12px; padding: 14px 10px; border-right: 1px solid var(--container-soft-border); }
.context-list-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 0 4px; }
.context-list-head span { color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; }
.context-scrollbar { flex: 1; min-height: 0; }
.context-items { display: flex; flex-direction: column; gap: 4px; }
.context-item { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 6px; padding: 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--el-text-color-primary); text-align: left; cursor: pointer; }
.context-item:hover { background: var(--container-muted-surface); }
.context-item.active { background: color-mix(in srgb, var(--el-color-primary) 9%, var(--container-strong-surface)); border-color: color-mix(in srgb, var(--el-color-primary) 25%, transparent); }
.context-item.active .context-name { color: var(--el-color-primary); }
.context-item:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.context-name { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.context-asset-count { font-size: 11px; color: var(--el-text-color-secondary); align-self: center; }
.context-subtitle { grid-column: 1 / -1; font-size: 12px; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
.framework-group { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--container-soft-border); }
.framework-group .context-list-head { margin-bottom: 8px; }
.sidebar-empty { margin: 10px 4px; font-size: 12px; color: var(--el-text-color-secondary); }
.context-detail { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; padding: 16px; }
.context-overview { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.context-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; min-width: 0; }
.context-heading h3 { font-size: 16px; margin: 0; overflow-wrap: anywhere; }
.context-location { font-size: 12px; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
.readonly-label { color: var(--el-text-color-secondary); background: var(--container-muted-surface); border-radius: 4px; padding: 2px 6px; font-size: 11px; }
.framework-note { margin: 0; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; }
.compact-context-picker { display: none; width: 100%; }
.is-sidebar-collapsed .workspace-shell { grid-template-columns: minmax(0, 1fr); }
.is-sidebar-collapsed .context-sidebar { display: none; }
.is-sidebar-collapsed .compact-context-picker { display: block; }
.loading-container, .empty-container { flex: 1; min-height: 0; display: grid; place-items: center; }
.loading-container { padding: 20px; }
.asset-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.asset-detail-actions :deep(.el-button + .el-button) { margin-left: 0; }
.asset-detail-fields { margin: 0; }
.asset-detail-fields > div { padding: 14px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.asset-detail-fields dt { color: var(--el-text-color-secondary); font-size: 12px; margin-bottom: 6px; }
.asset-detail-fields dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; font-family: monospace; font-size: 13px; }
@container (max-width: 900px) {
  .workspace-shell { grid-template-columns: 172px minmax(0, 1fr); }
  .context-detail { padding: 12px; }
}
@container (max-width: 640px) {
  .workspace-shell { grid-template-columns: minmax(0, 1fr); }
  .context-sidebar, .sidebar-toggle { display: none; }
  .compact-context-picker { display: block; }
  .runtime-label { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
</style>
