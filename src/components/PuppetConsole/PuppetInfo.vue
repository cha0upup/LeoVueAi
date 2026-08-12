<template>
  <div class="info-page">
    <div class="info-panel">
      <div class="info-toolbar">
        <div class="toolbar-primary">
          <div class="identity-shell">
            <div class="identity-title-row">
              <h2 class="identity-title">
                {{ hostTitle }}
              </h2>
              <StatusIndicator
                :status="connectionStatus.online ? 'online' : 'offline'"
                :label="connectionStatus.text"
                compact
              />
              <el-tag
                v-if="hasMiddlewareInfo"
                type="warning"
                round
              >
                {{ basicInfo.MiddlewareInfo?.MiddlewareType || '中间件' }}
              </el-tag>
              <el-tag
                v-if="hasJavaInfo"
                type="success"
                round
              >
                {{ basicInfo.JavaRuntimeInfo?.JavaVersion || 'Java' }}
              </el-tag>
              <el-tag
                v-if="hasPhpInfo"
                type="success"
                round
              >
                PHP {{ basicInfo.PhpRuntimeInfo?.PHPVersion || '' }}
              </el-tag>
            </div>
            <div class="identity-meta">
              <span>{{ basicInfo.OSInfo?.OSName || '未知系统' }}</span>
              <span class="meta-divider" />
              <span>{{ basicInfo.OSInfo?.OSVersion || '版本未知' }}</span>
              <span class="meta-divider" />
              <span>{{ basicInfo.UserInfo?.UserName || '未知用户' }}</span>
              <span class="meta-divider" />
              <span>PID {{ basicInfo.ProcessInfo?.ProcessId || '-' }}</span>
              <span
                v-if="lastUpdatedAt"
                class="refresh-time"
              >更新于 {{ lastUpdatedAt }}</span>
            </div>
          </div>
        </div>

        <div class="toolbar-actions">
          <div class="view-switcher">
            <button
              v-for="option in viewOptions"
              :key="option.key"
              type="button"
              class="view-button"
              :class="{ active: activeView === option.key }"
              @click="activeView = option.key"
            >
              <el-icon>
                <Icon :icon="option.icon" />
              </el-icon>
              {{ option.label }}
            </button>
          </div>
          <el-button
            type="primary"
            size="small"
            :loading="loading"
            @click="refreshInfo"
          >
            <el-icon>
              <Icon :icon="iconMap.refresh" />
            </el-icon>
            刷新信息
          </el-button>
        </div>
      </div>

      <div
        v-if="loading"
        class="state-container"
      >
        <el-skeleton
          :rows="8"
          animated
        />
      </div>

      <div
        v-else-if="error"
        class="state-container"
      >
        <el-result
          icon="error"
          :title="error"
          sub-title="请检查会话状态后重试"
        >
          <template #extra>
            <el-button
              type="primary"
              @click="fetchBasicInfo"
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
        v-else
        class="info-content"
      >
        <OverviewSection
          v-if="activeView === 'overview'"
          :basic-info="basicInfo"
        />
        <RuntimeSection
          v-else-if="activeView === 'runtime'"
          :basic-info="basicInfo"
        />
        <ResourcesSection
          v-else-if="activeView === 'resources'"
          :basic-info="basicInfo"
        />
        <EnvironmentSection
          v-else
          :basic-info="basicInfo"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { getBasicInfoApi } from '@/services/api.js'
import OverviewSection from './info/OverviewSection.vue'
import RuntimeSection from './info/RuntimeSection.vue'
import ResourcesSection from './info/ResourcesSection.vue'
import EnvironmentSection from './info/EnvironmentSection.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const basicInfo = ref({
  OSInfo: {},
  NetworkInfo: [],
  HardwareInfo: {},
  UserInfo: {},
  MiddlewareInfo: {},
  JavaRuntimeInfo: {},
  PhpRuntimeInfo: {},
  EnvironmentInfo: {},
  FileSystemInfo: [],
  ProcessInfo: {}
})

const loading = ref(false)
const error = ref(null)
const activeView = ref('overview')
const envExpanded = ref(false)
const lastUpdatedAt = ref('')
const connectionStatus = ref({
  online: true,
  text: '已连接',
  type: 'primary'
})

const viewOptions = [
  { key: 'overview', label: '概览', icon: iconMap.info },
  { key: 'runtime', label: '运行态', icon: iconMap.process },
  { key: 'resources', label: '资源', icon: iconMap.cpu },
  { key: 'environment', label: '环境', icon: iconMap.document }
]

const hostTitle = computed(
  () =>
    basicInfo.value.OSInfo?.HostName ||
    basicInfo.value.ProcessInfo?.ProcessName ||
    basicInfo.value.OSInfo?.OSName ||
    '基础信息'
)

const hasMiddlewareInfo = computed(() =>
  Boolean(
    basicInfo.value.MiddlewareInfo?.MiddlewareType ||
      basicInfo.value.MiddlewareInfo?.ServerInfo ||
      basicInfo.value.MiddlewareInfo?.ContextPath
  )
)

const hasJavaInfo = computed(() =>
  Boolean(
    basicInfo.value.JavaRuntimeInfo?.JavaVersion ||
      basicInfo.value.JavaRuntimeInfo?.JavaHome ||
      basicInfo.value.JavaRuntimeInfo?.JavaVendor
  )
)

const hasPhpInfo = computed(() => Boolean(basicInfo.value.PhpRuntimeInfo?.PHPVersion))

const fetchBasicInfo = async () => {
  if (!props.sessionId) return

  error.value = null

  await executeRequest(
    async () => {
      const response = await getBasicInfoApi({ sessionId: props.sessionId })
      basicInfo.value = response.data.BasicInfo || {}
      connectionStatus.value = {
        online: true,
        text: '已连接',
        type: 'success'
      }
      lastUpdatedAt.value = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      return response
    },
    {
      loadingRef: loading,
      successMessage: null,
      errorMessage: '获取主机信息失败',
      onError: () => {
        error.value = '获取主机信息失败'
        connectionStatus.value = {
          online: false,
          text: '连接失败',
          type: 'danger'
        }
      }
    }
  )
}

const refreshInfo = () => {
  fetchBasicInfo()
}

watch(
  () => props.sessionId,
  (newSessionId) => {
    if (newSessionId) {
      envExpanded.value = false
      activeView.value = 'overview'
      fetchBasicInfo()
    }
  }
)

onMounted(() => {
  if (props.sessionId) {
    fetchBasicInfo()
  }
})
</script>

<style scoped>
.info-page {
  height: 100%;
  min-height: 0;
}

.info-panel {
  --info-surface: color-mix(in srgb, var(--app-card-background) 94%, var(--el-bg-color-overlay));
  --info-surface-soft: color-mix(
    in srgb,
    var(--app-control-background-soft) 88%,
    var(--el-bg-color-overlay)
  );
  --info-surface-muted: color-mix(
    in srgb,
    var(--app-control-background) 90%,
    var(--el-bg-color-overlay)
  );
  --info-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  background: var(--app-container-background);
  overflow: hidden;
}

:global(html:not(.dark) .info-panel),
:global(html[data-theme='light'] .info-panel) {
  --info-surface: var(--app-surface-background);
  --info-surface-soft: #f5f5f4;
  --info-surface-muted: #fafaf9;
  --info-border: color-mix(in srgb, var(--el-border-color) 78%, transparent);
}

.info-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--info-border);
  background: var(--app-container-background);
}

.toolbar-primary,
.toolbar-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar-primary {
  flex: 1;
  min-width: 0;
}

.toolbar-actions {
  flex-shrink: 0;
  align-items: flex-end;
}

.identity-shell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.identity-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.identity-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--el-text-color-primary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.identity-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.identity-meta > span:not(.meta-divider) {
  min-width: 0;
  overflow-wrap: anywhere;
}

.meta-divider {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-text-color-secondary) 42%, transparent);
}

.refresh-time {
  margin-left: 6px;
  color: var(--el-color-primary);
  font-weight: 600;
}

.view-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: var(--radius-control);
  background: var(--info-surface-soft);
  border: 1px solid var(--info-border);
}

.view-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  min-height: 28px;
  border-radius: var(--radius-tag);
  padding: 0 12px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.view-button:hover {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, white);
}

.view-button.active {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, white);
  box-shadow: none;
}

.view-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.state-container {
  padding: 18px;
}

.info-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--app-container-background);
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.content-card,
.metric-card {
  border: 1px solid var(--info-border);
  border-radius: var(--radius-container);
  background: var(--info-surface);
  box-shadow: none;
}

.content-card {
  padding: 16px;
  min-width: 0;
}

.section-heading,
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-heading h3,
.card-header h3 {
  margin: 2px 0 0;
  font-size: 16px;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.section-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.section-subtitle,
.table-title {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 13px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--info-border);
  background: transparent;
}

.kv-label,
.metric-label,
.usage-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}

.kv-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.kv-value.mono {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}
.empty-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
}

.metric-icon-shell {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, white);
  color: var(--el-color-primary);
}

.metric-icon {
  font-size: 20px;
}

.metric-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-value {
  font-size: 18px;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.metric-helper {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.content-card-wide {
  grid-column: 1 / -1;
}

.storage-list,
.usage-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.storage-item,
.usage-panel {
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
}

.storage-top,
.network-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.storage-top strong,
.network-card-top strong {
  display: block;
  color: var(--el-text-color-primary);
}

.storage-top span,
.network-card-meta,
.storage-meta,
.usage-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.storage-meta,
.usage-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.network-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  min-width: 0;
}

.network-card {
  padding: 12px 13px;
  border-radius: 14px;
  border: 1px solid var(--info-border);
  background: var(--info-surface-soft);
  min-width: 0;
  overflow: hidden;
}

.ip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  min-width: 0;
}

.network-card-top > :first-child,
.network-card-meta {
  min-width: 0;
}

.network-card-top strong,
.network-card-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-card .ip-list :deep(.el-tag) {
  max-width: 100%;
  height: auto;
  line-height: 1.35;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.network-card .ip-list :deep(.el-tag__content) {
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.usage-dual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.table-shell {
  border: 1px solid var(--info-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--info-surface-soft);
}

.compact-table {
  margin-top: 12px;
}

.compact-table .table-title {
  padding: 12px 12px 0;
  margin-bottom: 0;
}

.usage-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}

.usage-inline :deep(.el-progress) {
  flex: 1;
}

.mono-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.truncate-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.table-shell :deep(.el-table) {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: var(--info-surface);
  --el-table-row-hover-bg-color: color-mix(
    in srgb,
    var(--el-color-primary) 5%,
    var(--info-surface-soft)
  );
}

.table-shell :deep(.el-table),
.table-shell :deep(.el-table__inner-wrapper),
.table-shell :deep(.el-table tr),
.table-shell :deep(.el-table td),
.table-shell :deep(.el-table th) {
  background: transparent;
}

.table-shell :deep(.el-table__inner-wrapper::before) {
  background: transparent;
}

.table-shell :deep(.el-table td),
.table-shell :deep(.el-table th) {
  padding-top: 7px;
  padding-bottom: 7px;
}

@media (max-width: 1200px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .info-toolbar,
  .content-grid,
  .usage-dual-grid,
  .kv-grid {
    grid-template-columns: 1fr;
  }

  .info-toolbar {
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
    align-items: stretch;
  }

  .view-switcher {
    width: 100%;
    overflow-x: auto;
  }
}

@media (max-width: 640px) {
  .info-content,
  .info-toolbar {
    padding-left: 12px;
    padding-right: 12px;
  }

  .metric-grid,
  .network-card-list {
    grid-template-columns: 1fr;
  }

  .identity-title {
    font-size: 18px;
  }

  .storage-meta,
  .usage-meta {
    flex-direction: column;
  }
}
</style>
