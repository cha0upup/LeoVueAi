<template>
  <!-- 工具栏 -->
  <section class="evlog-toolbar">
    <div class="toolbar-left">
      <el-button
        type="primary"
        size="small"
        :loading="loading"
        @click="emit('list-sources')"
      >
        <el-icon><Icon icon="mdi:format-list-bulleted" /></el-icon>
        日志源
      </el-button>
      <el-select
        v-model="selectedSource"
        placeholder="选择或输入日志源路径"
        size="small"
        clearable
        filterable
        allow-create
        default-first-option
        style="width: 320px"
        @change="value => emit('source-change', value)"
      >
        <el-option
          v-for="src in sources"
          :key="src.name"
          :label="src.name + (src.sizeHuman ? ' · ' + src.sizeHuman : '') + (src.common ? ' ★' : '')"
          :value="src.name"
        >
          <span :class="{ 'large-file': src.large }">{{ src.name }}</span>
          <span
            v-if="src.sizeHuman"
            class="size-hint"
          >{{ src.sizeHuman }}</span>
          <span
            v-if="src.large"
            class="large-tag"
          >⚠️</span>
        </el-option>
      </el-select>
      <el-select
        v-model="selectedFormat"
        placeholder="格式"
        size="small"
        clearable
        style="width: 140px"
        @change="emit('format-change')"
      >
        <el-option
          v-for="option in formatOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select
        v-model="levelFilter"
        placeholder="级别"
        size="small"
        clearable
        style="width: 110px"
      >
        <el-option
          v-for="option in levelOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select
        v-model="sinceFilter"
        placeholder="时间范围"
        size="small"
        clearable
        style="width: 120px"
      >
        <el-option
          v-for="option in sinceOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
    </div>
    <div class="toolbar-right">
      <el-input
        v-model="keyword"
        placeholder="关键字过滤"
        size="small"
        clearable
        class="keyword-input"
        @keyup.enter="emit('query')"
      >
        <template #prefix>
          <el-icon><Icon icon="mdi:magnify" /></el-icon>
        </template>
      </el-input>
      <el-button
        type="success"
        size="small"
        :loading="querying"
        @click="emit('query')"
      >
        <el-icon><Icon icon="mdi:magnify" /></el-icon>
        查询
      </el-button>
      <el-button
        size="small"
        text
        :disabled="!selectedSource || !selectedSource.startsWith('/')"
        @click="emit('preview')"
      >
        <el-icon><Icon icon="mdi:eye-outline" /></el-icon>
        预览
      </el-button>
      <el-button
        size="small"
        text
        :disabled="!selectedSource"
        @click="emit('stats')"
      >
        <el-icon><Icon icon="mdi:chart-bar" /></el-icon>
        统计
      </el-button>
      <el-button
        size="small"
        text
        :disabled="!selectedSource || !selectedSource.startsWith('/')"
        @click="emit('open-aggregate')"
      >
        <el-icon><Icon icon="mdi:chart-donut" /></el-icon>
        聚合
      </el-button>
      <el-button
        size="small"
        text
        :disabled="entryCount === 0"
        @click="emit('export')"
      >
        <el-icon><Icon icon="mdi:download" /></el-icon>
        导出
      </el-button>
    </div>
  </section>

  <!-- 翻页 / 时间跳转 / 跟随 工具条 -->
  <section
    v-if="selectedSource && selectedSource.startsWith('/')"
    class="evlog-page-bar"
  >
    <el-button-group>
      <el-button
        size="small"
        :disabled="!hasOlder || querying"
        @click="emit('older')"
      >
        <el-icon><Icon icon="mdi:chevron-up" /></el-icon>
        更早
      </el-button>
      <el-button
        size="small"
        :disabled="!hasNewer || querying"
        @click="emit('newer')"
      >
        <el-icon><Icon icon="mdi:chevron-down" /></el-icon>
        更新
      </el-button>
    </el-button-group>
    <el-input
      v-model="jumpTime"
      placeholder="跳转到时间 (yyyy-MM-dd HH:mm:ss)"
      size="small"
      clearable
      class="jump-time-input"
      @keyup.enter="emit('jump')"
    >
      <template #prefix>
        <el-icon><Icon icon="mdi:clock-outline" /></el-icon>
      </template>
    </el-input>
    <el-button
      size="small"
      type="primary"
      :disabled="!jumpTime || querying"
      @click="emit('jump')"
    >
      跳转
    </el-button>
    <el-divider direction="vertical" />
    <el-button
      size="small"
      :type="following ? 'danger' : 'success'"
      :disabled="!selectedSource || !selectedSource.startsWith('/')"
      @click="emit('toggle-follow')"
    >
      <el-icon><Icon :icon="following ? 'mdi:stop-circle' : 'mdi:play-circle'" /></el-icon>
      {{ following ? '停止跟随' : '实时跟随' }}
    </el-button>
    <span
      v-if="fileMeta"
      class="file-meta-bar"
    >
      <span v-if="fileMeta.sizeHuman">大小 {{ fileMeta.sizeHuman }}</span>
      <span v-if="fileMeta.firstTimestamp"> · 起始 {{ formatEventLogTimestamp(fileMeta.firstTimestamp) }}</span>
      <span v-if="fileMeta.lastTimestamp"> · 最新 {{ formatEventLogTimestamp(fileMeta.lastTimestamp) }}</span>
    </span>
    <span
      v-if="queryMeta && queryMeta.startByte !== undefined"
      class="cursor-meta"
    >
      字节 [{{ queryMeta.startByte }} → {{ queryMeta.endByte }}]
      <span v-if="queryMeta.mode">· {{ queryMeta.mode }}</span>
    </span>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import {
  EVENT_LOG_FORMAT_OPTIONS,
  EVENT_LOG_LEVEL_OPTIONS,
  EVENT_LOG_SINCE_OPTIONS,
  formatEventLogTimestamp
} from './eventLogModel.js'

defineProps({
  sources: { type: Array, default: () => [] },
  loading: Boolean,
  querying: Boolean,
  entryCount: { type: Number, default: 0 },
  following: Boolean,
  hasOlder: Boolean,
  hasNewer: Boolean,
  fileMeta: { type: Object, default: null },
  queryMeta: { type: Object, default: null }
})

const emit = defineEmits([
  'list-sources',
  'source-change',
  'format-change',
  'query',
  'preview',
  'stats',
  'open-aggregate',
  'export',
  'older',
  'newer',
  'jump',
  'toggle-follow'
])
const selectedSource = defineModel('selectedSource', { type: String, default: '' })
const selectedFormat = defineModel('selectedFormat', { type: String, default: '' })
const levelFilter = defineModel('levelFilter', { type: String, default: '' })
const sinceFilter = defineModel('sinceFilter', { type: String, default: '' })
const keyword = defineModel('keyword', { type: String, default: '' })
const jumpTime = defineModel('jumpTime', { type: String, default: '' })
const formatOptions = EVENT_LOG_FORMAT_OPTIONS
const levelOptions = EVENT_LOG_LEVEL_OPTIONS
const sinceOptions = EVENT_LOG_SINCE_OPTIONS
</script>

<style scoped>
.evlog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.keyword-input {
  width: 180px;
}
.evlog-page-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  flex-wrap: wrap;
}
.jump-time-input {
  width: 240px;
}
.file-meta-bar {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}
.cursor-meta {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.size-hint {
  margin-left: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.large-file {
  color: var(--el-color-danger);
}
.large-tag {
  margin-left: 6px;
}
</style>
