<template>
  <header class="hero-card">
    <div class="hero-main">
      <PuppetHeroIdentity
        :puppet="puppet"
        :live-session-count="liveSessionCount"
        :can-create-session="canCreateSession"
      />

      <PuppetHeroActions
        :puppet="puppet"
        :test-conn-loading="testConnLoading"
        :is-current-puppet-testing="isCurrentPuppetTesting"
        :batch-test-loading="batchTestLoading"
        :live-session-count="liveSessionCount"
        @enter-console="emit('enter-console', $event)"
        @new-session="emit('new-session', $event)"
        @test-conn="emit('test-conn', $event)"
        @edit="emit('edit', $event)"
        @share="emit('share', $event)"
        @parasite="emit('parasite', $event)"
        @delete="emit('delete', $event)"
      />
    </div>

    <div class="cache-availability-row">
      <div class="cache-availability-main">
        <StatusIndicator
          :status="cacheAvailabilityLoading ? 'running' : cacheAvailability.hasCache ? 'success' : 'unconfigured'"
          :label="cacheAvailabilityLoading ? '正在检查缓存' : cacheAvailability.hasCache ? '缓存可用' : '暂无可用缓存'"
          compact
        />
        <span
          v-if="cacheAvailability.hasCache && cacheAvailability.saveTime"
          class="cache-availability-time"
        >
          最近采集于 {{ formatDate(cacheAvailability.saveTime) }}
        </span>
        <span
          v-else-if="cacheAvailability.checked && !cacheAvailability.hasCache"
          class="cache-availability-hint"
        >
          成功进入实时控制台并采集数据后可用
        </span>
      </div>
      <div class="cache-availability-actions">
        <button
          v-if="cacheAvailability.hasCache"
          type="button"
          class="cache-enter"
          :disabled="cacheAvailabilityLoading || cacheCheckLoading"
          @click="emit('enter-cache', puppet)"
        >
          <el-icon><Icon :icon="iconMap.database" /></el-icon>
          进入缓存
        </button>
        <button
          type="button"
          class="cache-refresh"
          aria-label="重新检查主机缓存"
          :disabled="cacheAvailabilityLoading || cacheCheckLoading"
          @click="emit('refresh-cache-availability', puppet)"
        >
          <el-icon :class="{ 'u-spin': cacheAvailabilityLoading }">
            <Icon :icon="iconMap.refresh" />
          </el-icon>
          重新检查
        </button>
      </div>
    </div>

    <PuppetConnectionResultBanner
      v-if="testConnResult"
      :result="testConnResult"
      @dismiss="emit('dismiss-test-result')"
    />

    <PuppetCacheModeBanner
      v-if="cacheCheckResult && cacheCheckResult.hasCache"
      :result="cacheCheckResult"
      :loading="cacheCheckLoading"
      @enter-cache-mode="emit('enter-cache-mode')"
      @dismiss="emit('dismiss-cache-result')"
    />
  </header>
</template>

<script setup>
import PuppetCacheModeBanner from './PuppetCacheModeBanner.vue'
import PuppetConnectionResultBanner from './PuppetConnectionResultBanner.vue'
import PuppetHeroActions from './PuppetHeroActions.vue'
import PuppetHeroIdentity from './PuppetHeroIdentity.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'

const iconMap = icons

defineProps({
  puppet: {
    type: Object,
    required: true
  },
  liveSessionCount: {
    type: Number,
    default: 0
  },
  testConnLoading: {
    type: Boolean,
    default: false
  },
  isCurrentPuppetTesting: {
    type: Boolean,
    default: false
  },
  batchTestLoading: {
    type: Boolean,
    default: false
  },
  testConnResult: {
    type: Object,
    default: null
  },
  cacheCheckResult: {
    type: Object,
    default: null
  },
  cacheCheckLoading: {
    type: Boolean,
    default: false
  },
  cacheAvailability: {
    type: Object,
    default: () => ({ checked: false, hasCache: false, saveTime: null })
  },
  cacheAvailabilityLoading: {
    type: Boolean,
    default: false
  },
  canCreateSession: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'enter-console',
  'new-session',
  'enter-cache',
  'test-conn',
  'edit',
  'share',
  'parasite',
  'delete',
  'enter-cache-mode',
  'refresh-cache-availability',
  'dismiss-test-result',
  'dismiss-cache-result'
])
</script>

<style scoped>
.hero-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--pm-border);
  background: var(--pm-panel-strong);
}

.hero-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.cache-availability-row {
  min-height: 28px;
  padding-top: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--app-divider-color);
}

.cache-availability-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cache-availability-time,
.cache-availability-hint {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cache-availability-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cache-refresh,
.cache-enter {
  height: 24px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.cache-refresh:hover:not(:disabled),
.cache-enter:hover:not(:disabled) {
  color: var(--el-color-primary);
  background: var(--app-hover-background);
}

.cache-refresh:focus-visible,
.cache-enter:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-outline-offset);
}

.cache-refresh:disabled,
.cache-enter:disabled {
  opacity: var(--disabled-opacity);
  cursor: not-allowed;
}

.cache-enter {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 9%, transparent);
}

@media (max-width: 1100px) {
  .hero-main {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}

@media (max-width: 720px) {
  .hero-card {
    padding-left: 14px;
    padding-right: 14px;
  }

  .cache-availability-time,
  .cache-availability-hint {
    display: none;
  }
}
</style>
