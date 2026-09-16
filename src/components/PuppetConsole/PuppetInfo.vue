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
                :status="connectionStatus.status"
                :label="connectionStatus.label"
                compact
              />
              <el-tag
                v-if="hasMiddlewareInfo(basicInfo)"
                type="warning"
                round
              >
                {{ basicInfo.MiddlewareInfo?.MiddlewareType || '中间件' }}
              </el-tag>
              <el-tag
                v-if="hasJavaInfo(basicInfo)"
                type="success"
                round
              >
                {{ basicInfo.JavaRuntimeInfo?.JavaVersion || 'Java' }}
              </el-tag>
              <el-tag
                v-if="hasPhpInfo(basicInfo)"
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
              >{{ cacheMode ? '快照时间' : '采集时间' }} {{ lastUpdatedAt }}</span>
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
            @click="fetchBasicInfo"
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

      <el-empty
        v-else-if="!hasInfo"
        :description="cacheMode ? '暂无缓存快照' : '暂无基础信息'"
      />

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
import { computed, inject, ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'
import { useBasicInfo } from './info/useBasicInfo.js'
import { hasJavaInfo, hasPhpInfo, hasMiddlewareInfo } from './info/infoModel.js'
import OverviewSection from './info/OverviewSection.vue'
import RuntimeSection from './info/RuntimeSection.vue'
import ResourcesSection from './info/ResourcesSection.vue'
import EnvironmentSection from './info/EnvironmentSection.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

const iconMap = icons
const props = defineProps({ sessionId: { type: String, required: true } })
const cacheMode = inject('cacheMode', ref(false))
const { basicInfo, loading, error, load, reset } = useBasicInfo()
const activeView = ref('overview')
const hasInfo = computed(() => Object.keys(basicInfo.value).length > 0)
const lastUpdatedAt = computed(() => {
  const timestamp = basicInfo.value.collectTime || basicInfo.value.saveTime
  return timestamp ? formatDate(timestamp) : ''
})
const connectionStatus = computed(() => {
  if (loading.value) return { status: 'waiting', label: cacheMode.value ? '读取缓存' : '连接中' }
  if (error.value) return { status: 'failed', label: cacheMode.value ? '缓存读取失败' : '连接失败' }
  if (cacheMode.value) return { status: 'offline', label: '缓存快照' }
  return hasInfo.value
    ? { status: 'online', label: '已连接' }
    : { status: 'unconfigured', label: '暂无信息' }
})
const hostTitle = computed(
  () =>
    basicInfo.value.OSInfo?.HostName ||
    basicInfo.value.ProcessInfo?.ProcessName ||
    basicInfo.value.OSInfo?.OSName ||
    '基础信息'
)
const viewOptions = [
  { key: 'overview', label: '概览', icon: iconMap.info },
  { key: 'runtime', label: '运行态', icon: iconMap.process },
  { key: 'resources', label: '资源', icon: iconMap.cpu },
  { key: 'environment', label: '环境', icon: iconMap.document }
]
const fetchBasicInfo = () => load(props.sessionId)
watch(
  [() => props.sessionId, cacheMode],
  () => {
    reset()
    activeView.value = 'overview'
    fetchBasicInfo()
  },
  { immediate: true }
)
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

@media (max-width: 980px) {
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
  .identity-title {
    font-size: 18px;
  }
}
</style>
<style src="./info/infoSections.css"></style>
