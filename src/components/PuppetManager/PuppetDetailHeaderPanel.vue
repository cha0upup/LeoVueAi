<template>
  <article class="info-panel header-panel">
    <div class="panel-title-row">
      <div class="panel-title">
        伪装与 Header
      </div>
      <div class="header-summary">
        <span class="stat-badge">{{ headerEntries.length }} 条</span>
        <span class="stat-badge muted">自定义 {{ customHeaderCount }}</span>
      </div>
    </div>

    <div class="header-layout">
      <div class="disguise-side">
        <div class="disguise-block">
          <div class="disguise-label">
            请求伪装
          </div>
          <div class="disguise-value">
            <code>{{ puppet.reqDisguiseId || '-' }}</code>
          </div>
        </div>
        <div class="disguise-block">
          <div class="disguise-label">
            响应伪装
          </div>
          <div class="disguise-value">
            <code>{{ puppet.respDisguiseId || '-' }}</code>
          </div>
        </div>
      </div>

      <pre class="header-code"><code v-if="headerEntries.length"><span
        v-for="([key, value], index) in headerEntries"
        :key="key"
        class="header-code-line"
      ><span class="line-no">{{ index + 1 }}</span><span class="header-key">{{ key }}</span><span class="header-colon">:</span><span class="header-value">{{ value || '-' }}</span>
</span></code><code v-else><span class="header-code-line"><span class="line-no">1</span><span class="header-value">-</span></span></code></pre>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { getHeaderEntries } from '@/utils/headers.js'

const props = defineProps({
  puppet: {
    type: Object,
    required: true
  }
})

const headerEntries = computed(() => getHeaderEntries(props.puppet?.headers))
const customHeaderCount = computed(
  () => headerEntries.value.filter(([key]) => !/^content-|^user-agent$/i.test(key)).length
)
</script>

<style scoped>
.info-panel {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--pm-border);
  border-radius: var(--app-panel-radius);
  background: var(--pm-panel-strong);
}

.header-panel {
  margin: 0 20px 16px;
}

.panel-title,
.panel-title-row {
  position: relative;
  color: var(--pm-ink);
  font-size: 13px;
  font-weight: 800;
}

.panel-title {
  margin-bottom: 0;
  padding-left: 12px;
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

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.header-summary {
  display: flex;
  gap: 6px;
}

.stat-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--pm-blue);
  background: color-mix(in srgb, var(--pm-blue) 8%, var(--pm-panel-soft));
  padding: 2px 8px;
  border-radius: 4px;
}

.stat-badge.muted {
  color: var(--pm-muted);
  background: var(--pm-panel-soft);
}

.header-layout {
  display: grid;
  grid-template-columns: 172px minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.disguise-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.disguise-block {
  flex: 1;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--pm-panel-soft);
  border: 1px solid color-mix(in srgb, var(--pm-border) 50%, transparent);
}

.disguise-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--pm-muted);
  margin-bottom: 4px;
}

.disguise-value code {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--pm-ink);
  word-break: break-all;
}

.header-code {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--pm-border) 70%, transparent);
  background: #111827;
  color: #d7dee9;
}

.header-code code {
  font-family: var(--el-font-family-mono);
  font-size: 11px;
  line-height: 1.7;
  white-space: pre;
}

.header-code .line-no {
  color: #718096;
}

.header-code .header-key {
  color: #93c5fd;
}

.header-code .header-value {
  color: #d1fae5;
}

.header-code-line {
  display: flex;
  min-width: max-content;
  align-items: baseline;
  gap: 6px;
}

.header-code-line:only-child {
  min-width: 0;
}

.line-no {
  display: inline-block;
  flex: 0 0 20px;
  color: var(--pm-placeholder);
  text-align: right;
  user-select: none;
}

.header-key {
  color: var(--pm-blue);
  font-weight: 700;
}

.header-colon {
  color: var(--pm-muted);
}

.header-value {
  color: var(--pm-ink);
}

@media (max-width: 720px) {
  .header-panel {
    margin-left: 14px;
    margin-right: 14px;
  }

  .header-layout {
    grid-template-columns: 1fr;
  }

  .disguise-side {
    flex-direction: row;
  }

  .disguise-block {
    flex: 1;
  }
}
</style>
