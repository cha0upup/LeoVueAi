<template>
  <el-dialog
    v-model="detailOpen"
    title="日志详情"
    width="680"
    destroy-on-close
  >
    <div
      v-if="detailEntry"
      class="detail-content"
    >
      <div
        v-for="(val, key) in detailEntry"
        :key="key"
        class="detail-row"
      >
        <span class="detail-key">{{ key }}</span>
        <span class="detail-val">{{ formatVal(val) }}</span>
      </div>
    </div>
  </el-dialog>

  <el-dialog
    v-model="statsOpen"
    title="日志统计"
    width="580"
    destroy-on-close
  >
    <div
      v-if="statsData"
      class="stats-content"
    >
      <div class="stats-source">
        日志源: {{ statsData.source || '-' }}
      </div>
      <div
        v-if="statsData.detail"
        class="stats-detail"
      >
        <div
          v-for="(val, key) in statsData.detail"
          :key="key"
          class="detail-row"
        >
          <span class="detail-key">{{ key }}</span>
          <span class="detail-val">{{ formatVal(val) }}</span>
        </div>
      </div>
      <div
        v-if="statsData.rawOutput"
        class="stats-raw"
      >
        <pre>{{ statsData.rawOutput }}</pre>
      </div>
    </div>
    <div
      v-else-if="isStatsLoading"
      v-loading="true"
      class="loading-placeholder"
    />
  </el-dialog>

  <el-dialog
    v-model="aggregateOpen"
    title="应用日志聚合 (Top-N)"
    width="820"
    destroy-on-close
  >
    <div class="aggregate-controls">
      <el-select
        v-model="aggregateGroupBy"
        placeholder="分组维度"
        size="small"
        style="width: 150px"
      >
        <el-option
          v-for="option in aggregateGroupOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-input-number
        v-model="aggregateTopN"
        :min="1"
        :max="500"
        size="small"
        controls-position="right"
        style="width: 110px"
      />
      <el-input-number
        v-model="aggregateMinStatus"
        :min="100"
        :max="599"
        size="small"
        controls-position="right"
        placeholder="最小状态"
        style="width: 130px"
      />
      <el-input-number
        v-model="aggregateMaxStatus"
        :min="100"
        :max="599"
        size="small"
        controls-position="right"
        placeholder="最大状态"
        style="width: 130px"
      />
      <el-select
        v-model="aggregateMaxBytes"
        size="small"
        style="width: 130px"
        placeholder="扫描上限"
      >
        <el-option
          v-for="option in aggregateMaxBytesOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-checkbox
        v-model="aggregateSlow"
        size="small"
      >
        精确模式
      </el-checkbox>
      <el-button
        type="primary"
        size="small"
        :loading="isAggregating"
        @click="emit('aggregate')"
      >
        <el-icon><Icon icon="mdi:play" /></el-icon>
        执行
      </el-button>
    </div>
    <div
      v-if="aggregateResult"
      class="aggregate-result"
    >
      <div class="aggregate-meta">
        <el-tag
          v-if="aggregateResult.fastPath"
          size="small"
          type="success"
          effect="plain"
        >
          awk 快速路径
        </el-tag>
        <el-tag
          v-else
          size="small"
          effect="plain"
        >
          Java 精确路径
        </el-tag>
        <span v-if="aggregateResult.scanned !== undefined">扫描 {{ aggregateResult.scanned }} 行 ·</span>
        <span v-if="aggregateResult.unique !== undefined">去重 {{ aggregateResult.unique }} 组 ·</span>
        <span v-if="aggregateResult.total !== undefined">共计 {{ aggregateResult.total }} 次</span>
        <span v-if="aggregateResult.topSum !== undefined && aggregateResult.total === undefined">Top-N 共 {{ aggregateResult.topSum }} 次</span>
        <span
          v-if="aggregateResult.note"
          class="aggregate-note"
        >{{ aggregateResult.note }}</span>
      </div>
      <el-table
        :data="aggregateResult.groups || []"
        stripe
        border
        size="small"
        max-height="420"
      >
        <el-table-column
          type="index"
          width="50"
          label="#"
        />
        <el-table-column
          prop="key"
          label="分组键"
          show-overflow-tooltip
        />
        <el-table-column
          prop="count"
          label="次数"
          width="100"
        />
        <el-table-column
          label="占比"
          width="160"
        >
          <template #default="{ row }">
            <el-progress
              v-if="row.ratio !== undefined"
              :percentage="Math.round(row.ratio * 1000) / 10"
              :stroke-width="10"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div
      v-else-if="isAggregating"
      v-loading="true"
      class="loading-placeholder"
    />
  </el-dialog>

  <el-dialog
    v-model="previewOpen"
    title="日志预览 (末尾 5 行)"
    width="780"
    destroy-on-close
  >
    <div
      v-if="previewData"
      class="preview-content"
    >
      <div class="preview-meta">
        <strong>{{ previewData.source }}</strong>
        <span v-if="previewData.sizeHuman">· 文件大小 {{ previewData.sizeHuman }}</span>
        <el-tag
          v-if="previewData.large"
          size="small"
          type="danger"
          effect="plain"
        >
          大文件
        </el-tag>
      </div>
      <pre
        v-if="previewData.lines && previewData.lines.length"
        class="preview-lines"
      >{{ previewData.lines.join('\n') }}</pre>
      <el-empty
        v-else
        description="无可读内容(文件为空或无权限)"
      />
      <div
        v-if="previewData.msg"
        class="preview-msg"
      >
        {{ previewData.msg }}
      </div>
    </div>
    <div
      v-else-if="isPreviewing"
      v-loading="true"
      class="loading-placeholder"
    />
  </el-dialog>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import {
  EVENT_LOG_AGGREGATE_GROUP_OPTIONS,
  EVENT_LOG_MAX_BYTES_OPTIONS,
  formatEventLogValue
} from './eventLogModel.js'

defineProps({
  detailEntry: { type: Object, default: null },
  statsData: { type: Object, default: null },
  isStatsLoading: Boolean,
  aggregateResult: { type: Object, default: null },
  isAggregating: Boolean,
  previewData: { type: Object, default: null },
  isPreviewing: Boolean
})

const emit = defineEmits(['aggregate'])
const detailOpen = defineModel('detailOpen', { type: Boolean, default: false })
const statsOpen = defineModel('statsOpen', { type: Boolean, default: false })
const aggregateOpen = defineModel('aggregateOpen', { type: Boolean, default: false })
const previewOpen = defineModel('previewOpen', { type: Boolean, default: false })
const aggregateGroupBy = defineModel('aggregateGroupBy', { type: String, default: 'ip' })
const aggregateTopN = defineModel('aggregateTopN', { type: Number, default: 20 })
const aggregateMinStatus = defineModel('aggregateMinStatus', { type: Number, default: null })
const aggregateMaxStatus = defineModel('aggregateMaxStatus', { type: Number, default: null })
const aggregateMaxBytes = defineModel('aggregateMaxBytes', { type: Number, default: 0 })
const aggregateSlow = defineModel('aggregateSlow', { type: Boolean, default: false })

const aggregateGroupOptions = EVENT_LOG_AGGREGATE_GROUP_OPTIONS
const aggregateMaxBytesOptions = EVENT_LOG_MAX_BYTES_OPTIONS
const formatVal = formatEventLogValue
</script>

<style scoped>
.detail-content,
.stats-content {
  max-height: 500px;
  overflow-y: auto;
}
.detail-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  font-size: 13px;
}
.detail-key {
  min-width: 120px;
  max-width: 160px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  word-break: break-all;
}
.detail-val {
  flex: 1;
  word-break: break-all;
  white-space: pre-wrap;
  color: var(--el-text-color-secondary);
}
.stats-source {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}
.stats-detail {
  margin-bottom: 12px;
}
.stats-raw pre {
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.loading-placeholder {
  height: 200px;
}
.aggregate-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.aggregate-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.aggregate-result {
  display: flex;
  flex-direction: column;
}
.aggregate-note {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-color-warning);
}
.preview-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.preview-lines {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.preview-msg {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
