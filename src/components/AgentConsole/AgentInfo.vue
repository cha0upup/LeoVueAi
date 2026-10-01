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
            </div>
          </div>
        </div>

        <div class="toolbar-actions">
          <div
            class="view-switcher"
            role="group"
            aria-label="基础信息视图"
          >
            <button
              v-for="option in viewOptions"
              :key="option.key"
              type="button"
              class="view-button"
              :class="{ active: activeView === option.key }"
              :aria-pressed="activeView === option.key"
              @click="activeView = option.key"
            >
              <el-icon>
                <Icon :icon="option.icon" />
              </el-icon>
              {{ option.label }}
            </button>
          </div>
          <span
            v-if="lastUpdatedAt"
            class="refresh-time"
          >{{ cacheMode ? '快照时间' : '采集时间' }} {{ lastUpdatedAt }}</span>
          <el-button
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
        v-if="loading && !hasInfo"
        class="state-container"
      >
        <el-skeleton
          :rows="8"
          animated
        />
      </div>

      <div
        v-else-if="error && !hasInfo"
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
        :class="{ 'is-overview': activeView === 'overview' }"
      >
        <div
          v-if="error"
          class="refresh-error"
          role="alert"
        >
          <span>刷新失败，当前保留上次快照：{{ error }}</span>
          <el-button
            text
            type="primary"
            :loading="loading"
            @click="fetchBasicInfo"
          >
            重试
          </el-button>
        </div>
        <OverviewSection
          v-if="activeView === 'overview'"
          :basic-info="basicInfo"
          @navigate="activeView = $event"
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
  if (loading.value) return { status: 'waiting', label: hasInfo.value ? '刷新中' : cacheMode.value ? '读取缓存' : '连接中' }
  if (error.value) return { status: 'failed', label: hasInfo.value ? '刷新失败' : cacheMode.value ? '缓存读取失败' : '连接失败' }
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
.info-page { container: basic-info / inline-size; height: 100%; min-height: 0; }
.info-panel {
  --info-surface: var(--el-bg-color);
  --info-surface-soft: var(--el-fill-color-light);
  --info-border: var(--el-border-color-lighter);
  height: 100%; min-height: 0; display: flex; flex-direction: column;
  color: var(--el-text-color-primary); background: var(--app-container-background); overflow: hidden;
}
.info-toolbar { flex-shrink: 0; display: grid; gap: 12px; padding: 14px 16px 12px; border-bottom: 1px solid var(--info-border); }
.toolbar-primary, .identity-shell { min-width: 0; }
.identity-title-row, .identity-meta, .toolbar-actions, .view-switcher { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.identity-title { margin: 0; font-size: 18px; line-height: 1.4; overflow-wrap: anywhere; }
.identity-meta { margin-top: 5px; font-size: 12px; color: var(--el-text-color-secondary); }
.identity-meta > span { min-width: 0; overflow-wrap: anywhere; }
.meta-divider { width: 3px; height: 3px; border-radius: 50%; background: var(--el-text-color-placeholder); }
.toolbar-actions { gap: 8px 12px; }
.view-switcher { gap: 4px; }
.view-button { display: inline-flex; align-items: center; gap: 5px; padding: 0 10px; min-height: 30px; border: 0; border-radius: var(--radius-control); color: var(--el-text-color-regular); background: transparent; font-size: 12px; cursor: pointer; }
.view-button:hover { background: var(--el-fill-color-light); }
.view-button.active { color: var(--el-color-primary); background: var(--app-brand-background); font-weight: 600; }
.view-button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.refresh-time { margin-left: auto; color: var(--el-text-color-secondary); font-size: 11px; }
.toolbar-actions > :deep(.el-button) { margin-left: auto; }
.refresh-time + :deep(.el-button) { margin-left: 0; }
.state-container { padding: 18px; overflow: auto; }
.info-content { flex: 1; min-height: 0; overflow: auto; padding: 14px 16px 16px; }
.info-content.is-overview { display: flex; flex-direction: column; }
.refresh-error { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding: 8px 12px; border-radius: var(--radius-control); background: var(--el-color-danger-light-9); color: var(--el-color-danger); font-size: 12px; overflow-wrap: anywhere; }
@container basic-info (max-width: 700px) {
  .refresh-time { order: 3; flex-basis: 100%; margin-left: 0; }
  .refresh-time + :deep(.el-button) { margin-left: auto; }
}
@container basic-info (max-width: 440px) {
  .info-content, .info-toolbar { padding-left: 12px; padding-right: 12px; }
  .view-button { padding: 0 7px; }
  .view-button .el-icon { display: none; }
}
</style>
<style src="./info/infoSections.css"></style>
