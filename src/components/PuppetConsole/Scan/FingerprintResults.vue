<template>
  <section
    class="fingerprint-results"
    aria-label="组件识别明细"
  >
    <div class="heading">
      <h3>组件识别</h3>
      <el-button
        text
        :loading="loading"
        @click="load"
      >
        刷新
      </el-button>
    </div>
    <p
      v-if="error"
      role="alert"
      class="error"
    >
      {{ error }}
    </p>
    <el-table
      :data="matches"
      size="small"
      empty-text="尚无组件识别结果"
    >
      <el-table-column
        prop="ruleName"
        label="组件规则"
        min-width="125"
      />
      <el-table-column
        label="识别版本"
        min-width="110"
      >
        <template #default="{ row }">
          {{ row.detectedVersion || (row.versionStatus === 'INCONCLUSIVE' ? '证据不足' : '未提取') }}
        </template>
      </el-table-column>
      <el-table-column
        prop="url"
        label="应用地址"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column
        label="结果"
        width="100"
      >
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="statusType(row.status)"
          >
            {{
              statusText(row.status)
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="证据"
        width="65"
      >
        <template #default="{ row }">
          <el-button
            text
            type="primary"
            size="small"
            :disabled="!row.evidenceCount"
            @click="showEvidence(row)"
          >
            查看
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > 20"
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="prev, pager, next"
      @current-change="load"
    />
    <p v-if="evidenceLoading">
      正在读取响应证据…
    </p>
    <p
      v-if="evidenceError"
      role="alert"
      class="error"
    >
      {{ evidenceError }}
    </p>
    <div
      v-if="evidence"
      class="evidence"
    >
      <div class="heading">
        <strong>{{ evidence.match.ruleName }} · {{ statusText(evidence.match.status) }}</strong><el-button
          text
          @click="downloadEvidence"
        >
          下载证据
        </el-button>
      </div>
      <p>{{ evidence.match.url }}</p>
      <p
        v-if="evidence.match.error"
        class="error"
      >
        {{ evidence.match.error }}
      </p>
      <p v-if="evidence.match.detectedVersion">
        识别版本：{{ evidence.match.detectedVersion }} · 请求 {{ Number(evidence.match.versionEvidence?.request || 0) + 1 }} / {{ evidence.match.versionEvidence?.field }}
      </p>
      <el-table
        v-if="evidence.match.conditions?.length"
        :data="evidence.match.conditions"
        size="small"
      >
        <el-table-column
          prop="path"
          label="条件"
          min-width="150"
        />
        <el-table-column
          label="判断"
          width="100"
        >
          <template #default="{ row }">
            {{ statusText(row.status) }}
          </template>
        </el-table-column>
        <el-table-column
          label="表达式"
          min-width="250"
        >
          <template #default="{ row }">
            <code>{{ JSON.stringify(row.expression) }}</code>
          </template>
        </el-table-column>
      </el-table>
      <details>
        <summary>本次执行的规则</summary>
        <pre>{{ formatJson(evidence.rule) }}</pre>
      </details>
      <details
        v-for="(observation, index) in evidence.observations"
        :key="observation.probeId || index"
        open
      >
        <summary>
          请求 {{ Number(observation.requestIndex || 0) + 1 }} ·
          {{ observation.evidence?.statusCode || observation.errorCode || '无响应' }}
        </summary>
        <p v-if="observation.evidence?.truncated">
          响应正文已截断，展示已采集的内容。
        </p>
        <pre>{{ formatJson(observation) }}</pre>
      </details>
    </div>
  </section>
</template>

<script setup>
import { useFingerprintDetails } from './useFingerprintDetails.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
const props = defineProps({
  sessionId: { type: String, required: true },
  taskId: { type: String, required: true },
  endpointId: { type: String, required: true },
  refreshToken: { type: Number, default: 0 }
})
const {
  matches,
  page,
  total,
  loading,
  error,
  evidence,
  evidenceLoading,
  evidenceError,
  load,
  showEvidence
} = useFingerprintDetails(props)
const statusText = (status) =>
  ({
    MATCHED: '命中',
    NOT_MATCHED: '未命中',
    ERROR: '请求失败',
    INCONCLUSIVE: '证据不足',
    PENDING: '等待结果',
    CANCELLED: '已停止'
  })[status] || status
const statusType = (status) =>
  ({ MATCHED: 'success', ERROR: 'danger', INCONCLUSIVE: 'warning' })[status] || 'info'
const formatJson = (value) => JSON.stringify(value, null, 2)
function downloadEvidence() {
  downloadBlob(
    new Blob([formatJson(evidence.value)], { type: 'application/json' }),
    `fingerprint-${evidence.value.match.matchKey}.json`
  )
}
</script>

<style scoped>
.fingerprint-results {
  margin-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h3 {
  font-size: 14px;
}
p {
  font-size: 12px;
  overflow-wrap: anywhere;
  color: var(--el-text-color-secondary);
}
.error {
  color: var(--el-color-danger);
}
.evidence {
  margin-top: 20px;
}
details {
  margin: 12px 0;
}
summary {
  cursor: pointer;
  font-size: 13px;
}
pre {
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 12px;
  font-size: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
