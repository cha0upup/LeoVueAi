<template>
  <article class="header-panel">
    <div class="panel-title-row">
      <h3>伪装与 Header <span>{{ headerEntries.length }} 条</span></h3>
      <div
        v-if="headerEntries.length"
        class="header-actions"
      >
        <button
          type="button"
          :aria-pressed="showRaw"
          @click="showRaw = !showRaw"
        >
          {{ showRaw ? '键值视图' : '原文' }}
        </button>
        <button
          type="button"
          @click="copyHostDetail(headerText)"
        >
          <Icon icon="ep:copy-document" />复制 Header
        </button>
      </div>
    </div>

    <dl class="disguise-list">
      <template v-if="puppet.reqDisguiseId === puppet.respDisguiseId">
        <dt>请求 / 响应伪装</dt>
        <dd>{{ puppet.reqDisguiseId || '未配置' }}</dd>
      </template>
      <template v-else>
        <dt>请求伪装</dt><dd>{{ puppet.reqDisguiseId || '未配置' }}</dd>
        <dt>响应伪装</dt><dd>{{ puppet.respDisguiseId || '未配置' }}</dd>
      </template>
    </dl>

    <pre
      v-if="showRaw && headerEntries.length"
      class="header-raw"
    >{{ headerText }}</pre>
    <dl
      v-else-if="headerEntries.length"
      class="header-entries"
    >
      <template
        v-for="[key, value] in headerEntries"
        :key="key"
      >
        <dt :title="key">
          {{ key }}
        </dt>
        <dd>{{ value ?? '' }}</dd>
      </template>
    </dl>
    <p
      v-else
      class="header-empty"
    >
      未配置 Header
    </p>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getHeaderEntries, formatHeadersForEditor } from '@/utils/headers.js'
import { copyHostDetail } from './puppetDetailUtils.js'

const props = defineProps({
  puppet: { type: Object, required: true }
})

const headerEntries = computed(() => getHeaderEntries(props.puppet.headers))
const headerText = computed(() => formatHeadersForEditor(props.puppet.headers))
const showRaw = ref(false)
watch(() => props.puppet.puppetId, () => { showRaw.value = false })
</script>

<style scoped>
.header-panel {
  min-width: 0;
  margin: 0 20px 16px;
  padding: 12px 14px;
  border: 1px solid var(--pm-border);
  border-radius: var(--app-panel-radius);
  background: var(--pm-panel-strong);
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 10px;
}

.panel-title-row h3 {
  margin: 0;
  padding-left: 9px;
  border-left: 3px solid var(--pm-blue);
  color: var(--pm-ink);
  font-size: 13px;
  line-height: 16px;
}

.panel-title-row h3 span {
  margin-left: 8px;
  color: var(--pm-muted);
  font-size: 11px;
  font-weight: 400;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--pm-blue);
  font-size: 11px;
  cursor: pointer;
}

.header-actions button:focus-visible {
  outline: var(--focus-outline);
}

.disguise-list,
.header-entries {
  display: grid;
  grid-template-columns: minmax(100px, 28%) minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.disguise-list dt,
.header-entries dt {
  color: var(--pm-muted);
  overflow-wrap: anywhere;
}

.disguise-list dd,
.header-entries dd {
  margin: 0;
  color: var(--pm-ink);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.header-entries,
.header-raw {
  max-height: 240px;
  margin-top: 10px;
  padding-top: 10px;
  overflow: auto;
  border-top: 1px solid var(--pm-border);
  font-family: var(--el-font-family-mono);
  font-size: 11px;
}

.header-raw {
  margin-bottom: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--pm-ink);
  line-height: 1.7;
}

.header-empty {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--pm-muted);
}

@media (max-width: 720px) {
  .header-panel {
    margin-left: 14px;
    margin-right: 14px;
  }
}
</style>
