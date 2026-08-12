<template>
  <section class="strategy-grid">
    <article class="info-panel">
      <div class="panel-title">
        流量伪装策略
      </div>
      <div class="strategy-table">
        <div
          class="strategy-row"
          :class="{ active: urlStrategy.enabled }"
        >
          <div class="strategy-row-icon">
            <el-icon><Icon icon="mdi:shuffle-variant" /></el-icon>
          </div>
          <div class="strategy-row-name">
            URL 随机化
          </div>
          <div class="strategy-row-value">
            <template v-if="urlStrategy.enabled">
              <code>{{ urlModeLabel }}</code>
              <span
                v-if="urlStrategy.prefix"
                class="tag"
              >{{ urlStrategy.prefix }}</span>
              <span
                v-if="urlStrategy.urlPool && urlStrategy.urlPool.length"
                class="tag"
              >{{ urlStrategy.urlPool.length }}条路径</span>
              <span
                v-if="urlStrategy.extensions && urlStrategy.extensions.length"
                class="tag"
              >{{ urlStrategy.extensions.join(' ') }}</span>
            </template>
            <span
              v-else
              class="off"
            >未启用</span>
          </div>
        </div>
        <div
          class="strategy-row"
          :class="{ active: paddingStrategy.enabled }"
        >
          <div class="strategy-row-icon">
            <el-icon><Icon icon="mdi:resize" /></el-icon>
          </div>
          <div class="strategy-row-name">
            Padding
          </div>
          <div class="strategy-row-value">
            <template v-if="paddingStrategy.enabled">
              <code>{{ paddingDistributionLabel }}</code>
              <span class="tag">{{ paddingStrategy.minBytes }}~{{ paddingStrategy.maxBytes }}B</span>
            </template>
            <span
              v-else
              class="off"
            >未启用</span>
          </div>
        </div>
        <div
          class="strategy-row"
          :class="{ active: headerNoiseStrategy.enabled }"
        >
          <div class="strategy-row-icon">
            <el-icon><Icon icon="mdi:signal-variant" /></el-icon>
          </div>
          <div class="strategy-row-name">
            Header 噪声
          </div>
          <div class="strategy-row-value">
            <template v-if="headerNoiseStrategy.enabled">
              <code>{{ headerNoiseValueModeLabel }}</code>
              <span class="tag">{{ headerNoiseStrategy.minHeaders }}~{{ headerNoiseStrategy.maxHeaders }}个</span>
            </template>
            <span
              v-else
              class="off"
            >未启用</span>
          </div>
        </div>
        <div
          class="strategy-row"
          :class="{ active: tlsFingerprintStrategy.enabled }"
        >
          <div class="strategy-row-icon">
            <el-icon><Icon icon="mdi:fingerprint" /></el-icon>
          </div>
          <div class="strategy-row-name">
            TLS 指纹
          </div>
          <div class="strategy-row-value">
            <template v-if="tlsFingerprintStrategy.enabled">
              <code>{{ tlsProfileLabel }}</code>
              <span
                v-if="tlsFingerprintStrategy.rotate"
                class="tag"
              >轮换</span>
            </template>
            <span
              v-else
              class="off"
            >未启用</span>
          </div>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  puppet: {
    type: Object,
    required: true
  }
})

const parseStrategy = (json) => {
  if (!json) return { enabled: false }
  try {
    return JSON.parse(json)
  } catch {
    return { enabled: false }
  }
}

const urlStrategy = computed(() => parseStrategy(props.puppet.urlStrategy))
const paddingStrategy = computed(() => parseStrategy(props.puppet.paddingStrategy))
const headerNoiseStrategy = computed(() => parseStrategy(props.puppet.headerNoiseStrategy))
const tlsFingerprintStrategy = computed(() => parseStrategy(props.puppet.tlsFingerprintStrategy))

const urlModeLabel = computed(() => {
  const map = { POOL: '路径池', TEMPLATE: '模板', STATIC_ASSET: '静态资源' }
  return map[urlStrategy.value.mode] || urlStrategy.value.mode || '-'
})

const paddingDistributionLabel = computed(() => {
  const map = { UNIFORM: '均匀分布', GAUSSIAN: '高斯分布', EXPONENTIAL: '指数分布' }
  return map[paddingStrategy.value.lengthDistribution] || paddingStrategy.value.lengthDistribution || '均匀分布'
})

const headerNoiseValueModeLabel = computed(() => {
  const map = { RANDOM_ALPHANUM: '字母数字', UUID_LIKE: 'UUID', NUMERIC: '时间戳' }
  return map[headerNoiseStrategy.value.valueMode] || headerNoiseStrategy.value.valueMode || '-'
})

const tlsProfileLabel = computed(() => {
  const map = {
    CHROME_MODERN: 'Chrome',
    FIREFOX_MODERN: 'Firefox',
    SAFARI_MODERN: 'Safari',
    EDGE_MODERN: 'Edge',
    RANDOM: '随机'
  }
  return map[tlsFingerprintStrategy.value.profile] || tlsFingerprintStrategy.value.profile || '-'
})
</script>

<style scoped>
.strategy-grid {
  padding: 0 20px 12px;
}

.info-panel {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--pm-border);
  border-radius: var(--app-panel-radius);
  background: var(--pm-panel-strong);
}

.panel-title {
  position: relative;
  margin-bottom: 8px;
  padding-left: 12px;
  color: var(--pm-ink);
  font-size: 13px;
  font-weight: 800;
}

.panel-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: var(--pm-blue);
}

.strategy-table {
  display: flex;
  flex-direction: column;
}

.strategy-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--pm-border) 50%, transparent);
  border-radius: 0;
  transition: background 0.15s ease;
}

.strategy-row:last-child {
  border-bottom: 0;
  padding-bottom: 2px;
}

.strategy-row:first-child {
  padding-top: 2px;
}

.strategy-row.active {
  background: color-mix(in srgb, var(--pm-blue) 4%, transparent);
}

.strategy-row:not(.active) {
  opacity: 0.6;
}

.strategy-row-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--pm-placeholder);
  background: color-mix(in srgb, var(--pm-border) 30%, var(--pm-panel-strong));
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.strategy-row.active .strategy-row-icon {
  color: var(--pm-blue);
  background: color-mix(in srgb, var(--pm-blue) 12%, var(--pm-panel-strong));
}

.strategy-row-name {
  width: 90px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--pm-ink);
  transition: color 0.15s;
}

.strategy-row:not(.active) .strategy-row-name {
  color: var(--pm-muted);
}

.strategy-row-value {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.strategy-row-value code {
  font-family: var(--el-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--pm-blue);
  background: color-mix(in srgb, var(--pm-blue) 8%, var(--pm-panel-soft));
  padding: 2px 6px;
  border-radius: 4px;
}

.strategy-row-value .tag {
  font-size: 11px;
  color: var(--pm-muted);
  background: var(--pm-panel-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.strategy-row-value .off {
  color: var(--pm-placeholder);
  font-size: 12px;
}

@media (max-width: 720px) {
  .strategy-grid {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
