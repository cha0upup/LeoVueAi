<template>
  <div class="fuzzer-results-pane">
    <div class="pane-header">
      <span class="pane-title">Fuzzer 结果</span>
      <span
        v-if="results.length"
        class="pane-hint"
      >
        共 {{ results.length }} 条
        <template v-if="matchedCount">，命中 <strong>{{ matchedCount }}</strong> 条</template>
      </span>
    </div>
    <div class="results-table-wrapper">
      <el-table
        :data="results"
        size="small"
        stripe
        border
        max-height="300"
        style="width: 100%"
        :row-class-name="rowClassName"
      >
        <el-table-column
          prop="index"
          label="#"
          width="55"
        />
        <el-table-column
          label="Payload"
          min-width="160"
        >
          <template #default="{ row }">
            <span class="payload-cell">{{ formatPayloads(row.payloads) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="statusCode"
          label="状态码"
          width="80"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.statusCode"
              :type="getHttpStatusTagType(row.statusCode)"
              size="small"
            >
              {{ row.statusCode }}
            </el-tag>
            <span
              v-else
              class="text-muted"
            >-</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="bodyLength"
          label="长度"
          width="80"
        />
        <el-table-column
          prop="elapsed"
          label="耗时"
          width="80"
        >
          <template #default="{ row }">
            {{ row.elapsed != null ? `${row.elapsed}ms` : '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="匹配"
          width="60"
        >
          <template #default="{ row }">
            <el-icon
              v-if="row.matched"
              color="#67c23a"
            >
              <Icon icon="mdi:check-circle" />
            </el-icon>
            <span
              v-else
              class="text-muted"
            >-</span>
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="70"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.success"
              type="success"
              size="small"
            >
              OK
            </el-tag>
            <el-tooltip
              v-else
              :content="row.error || '失败'"
              placement="top"
            >
              <el-tag
                type="danger"
                size="small"
              >
                ERR
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { formatPayloads, getHttpStatusTagType } from './httpPacketSenderModel.js'

const props = defineProps({
  results: { type: Array, default: () => [] }
})

const matchedCount = computed(() => props.results.filter(result => result?.matched).length)
const rowClassName = ({ row }) => {
  if (row?.matched) return 'fuzz-row-matched'
  if (!row?.success) return 'fuzz-row-error'
  return ''
}
</script>

<style scoped>
.fuzzer-results-pane {
  flex-shrink: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.pane-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.pane-hint {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.results-table-wrapper { overflow: auto; }
.payload-cell { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 11px; }
.text-muted { color: var(--el-text-color-placeholder); }

:deep(.fuzz-row-matched) { background-color: var(--el-color-success-light-9) !important; }
:deep(.fuzz-row-error) { background-color: var(--el-color-danger-light-9) !important; }
</style>
