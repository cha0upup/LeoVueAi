<template>
  <!-- 日志源列表（左侧面板） -->
  <div
    v-if="sourcePanelOpen"
    class="source-panel"
  >
    <div class="panel-header">
      <span>日志源 ({{ sources.length }})</span>
      <el-button
        size="small"
        text
        aria-label="关闭日志来源面板"
        @click="sourcePanelOpen = false"
      >
        <el-icon><Icon icon="mdi:close" /></el-icon>
      </el-button>
    </div>
    <div class="source-list">
      <div
        v-for="src in sources"
        :key="src.name"
        class="source-item"
        :class="{ active: selectedSource === src.name }"
        @click="emit('select-source', src)"
      >
        <el-icon class="source-type-icon">
          <Icon :icon="sourceTypeIcon(src.type)" />
        </el-icon>
        <div class="source-info">
          <span
            class="source-name"
            :title="src.name"
          >{{ src.name }}</span>
          <span class="source-type">
            {{ src.type }}<span v-if="src.format"> · {{ src.format }}</span>
            <span v-if="src.sizeHuman"> · {{ src.sizeHuman }}</span>
          </span>
        </div>
        <el-tag
          v-if="src.large"
          size="small"
          type="danger"
          effect="plain"
          class="common-tag"
        >
          大
        </el-tag>
        <el-tag
          v-else-if="src.common"
          size="small"
          type="warning"
          effect="plain"
          class="common-tag"
        >
          常用
        </el-tag>
      </div>
    </div>
  </div>

  <!-- 日志条目表格 -->
  <div class="entries-area">
    <div
      v-if="!queried && !querying"
      class="empty-state"
    >
      <el-icon size="40">
        <Icon icon="mdi:text-box-search" />
      </el-icon>
      <p>选择日志源并点击「查询」获取日志条目</p>
      <p
        v-if="osInfo"
        class="os-hint"
      >
        目标系统: {{ osInfo }}
      </p>
    </div>

    <el-table
      v-else-if="accessFormat"
      v-loading="querying"
      :data="entries"
      stripe
      border
      size="small"
      height="100%"
      highlight-current-row
      class="evlog-table"
      @row-click="row => emit('row-click', row)"
    >
      <el-table-column
        type="index"
        width="50"
        label="#"
      />
      <el-table-column
        prop="time"
        label="时间"
        width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="remoteAddr"
        label="客户端"
        width="140"
        show-overflow-tooltip
      />
      <el-table-column
        prop="method"
        label="方法"
        width="80"
      />
      <el-table-column
        label="状态"
        width="80"
      >
        <template #default="{ row }">
          <el-tag
            v-if="row.status"
            size="small"
            :type="statusColor(row.status)"
            effect="plain"
          >
            {{ row.status }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="bytes"
        label="字节"
        width="90"
      />
      <el-table-column
        prop="path"
        label="路径"
        min-width="280"
        show-overflow-tooltip
      />
      <el-table-column
        prop="userAgent"
        label="UA"
        min-width="200"
        show-overflow-tooltip
      />
    </el-table>

    <el-table
      v-else
      v-loading="querying"
      :data="entries"
      stripe
      border
      size="small"
      height="100%"
      highlight-current-row
      class="evlog-table"
      @row-click="row => emit('row-click', row)"
    >
      <el-table-column
        type="index"
        width="50"
        label="#"
      />
      <el-table-column
        prop="timestamp"
        label="时间"
        width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.timestamp || row.time || row['Date and Time'] || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        label="来源"
        width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.Source || row.source || row.hostname || row.logger || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        label="级别"
        width="100"
      >
        <template #default="{ row }">
          <el-tag
            v-if="getLevel(row)"
            size="small"
            :type="levelColor(getLevel(row))"
            effect="plain"
          >
            {{ getLevel(row) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        label="事件ID"
        width="80"
      >
        <template #default="{ row }">
          {{ row['Event ID'] || row.eventId || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        label="消息"
        min-width="400"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.message || row.Description || row.raw || '-' }}
        </template>
      </el-table-column>
    </el-table>

    <div
      v-if="queried && entries.length > 0"
      class="result-bar"
    >
      共 {{ entries.length }} 条日志
      <span v-if="selectedSource">，来源: {{ selectedSource }}</span>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import {
  getEventLogLevel,
  resolveEventLogLevelTagType,
  resolveEventLogSourceIcon,
  resolveHttpStatusTagType
} from './eventLogModel.js'

defineProps({
  sources: { type: Array, default: () => [] },
  selectedSource: { type: String, default: '' },
  queried: Boolean,
  querying: Boolean,
  accessFormat: Boolean,
  entries: { type: Array, default: () => [] },
  osInfo: { type: String, default: '' }
})

const emit = defineEmits(['select-source', 'row-click'])
const sourcePanelOpen = defineModel('sourcePanelOpen', { type: Boolean, default: false })
const sourceTypeIcon = resolveEventLogSourceIcon
const statusColor = resolveHttpStatusTagType
const getLevel = getEventLogLevel
const levelColor = resolveEventLogLevelTagType
</script>

<style scoped>
/* 日志源面板 */
.source-panel {
  width: 280px;
  min-width: 280px;
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.source-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.source-item:hover {
  background: var(--el-fill-color-light);
}
.source-item.active {
  background: var(--el-color-primary-light-9);
}
.source-type-icon {
  font-size: 16px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}
.source-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.source-name {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-type {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.common-tag {
  flex-shrink: 0;
}

/* 日志条目区 */
.entries-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-placeholder);
}
.empty-state p {
  margin: 0;
  font-size: 14px;
}
.os-hint {
  font-size: 12px !important;
  color: var(--el-text-color-disabled);
}
.evlog-table {
  flex: 1;
}
.result-bar {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
}

</style>
