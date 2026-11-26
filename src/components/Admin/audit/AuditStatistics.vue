<template>
  <div class="audit-statistics">
    <PageHeader
      title="审计统计"
      :icon="iconMap.trendCharts"
    />
    <section class="query-grid">
      <article
        v-for="card in queryCards"
        :key="card.idField"
        class="query-card surface"
      >
        <header class="query-card__header">
          <div class="query-card__title">
            <el-icon><Icon :icon="card.icon" /></el-icon>
            <span>{{ card.label }}统计</span>
          </div>
          <el-button
            text
            :loading="card.loading"
            :disabled="!card.submittedId"
            @click="card.refresh"
          >
            刷新
          </el-button>
        </header>
        <div class="query-card__form">
          <el-input
            v-model="card.draftId"
            :placeholder="`输入${card.label}ID`"
            clearable
            @keyup.enter="card.query"
          />
          <el-button
            type="primary"
            :loading="card.loading"
            @click="card.query"
          >
            查询
          </el-button>
        </div>
        <div
          v-if="card.validationError || card.error"
          role="alert"
          class="query-message"
        >
          {{ card.validationError || card.error }}
          <span v-if="!card.validationError && card.result">；仍显示上次成功的结果</span>
        </div>
        <div
          v-if="card.result"
          class="query-result"
        >
          <div class="result-item">
            <span>{{ card.label }}ID</span><strong>{{ card.submittedId }}</strong>
          </div>
          <div class="result-item">
            <span>总操作数</span><strong>{{ card.result.totalOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最近操作</span><strong>{{ card.result.recentOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最后操作</span><strong>{{ formatDateTime(card.result.lastOperation) }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="analytics-grid">
      <AdminWorkspacePanel
        title="操作分布"
        class="chart-panel"
      >
        <template #tags>
          <el-icon><Icon :icon="iconMap.pieChart" /></el-icon>
        </template>
        <template #actions>
          <el-button
            text
            :loading="operationStatsLoading"
            @click="refreshOperationStats"
          >
            刷新
          </el-button>
        </template>

        <div
          v-loading="operationStatsLoading"
          class="chart-panel__body"
        >
          <el-alert
            v-if="operationError"
            :title="operationError"
            :description="operationStats.length ? '仍显示上次成功的结果' : undefined"
            type="error"
            :closable="false"
            show-icon
          />
          <div
            v-if="operationStats.length > 0"
            class="operation-stats"
          >
            <div
              v-for="stat in operationStats"
              :key="stat.operation"
              class="operation-item"
            >
              <div class="operation-info">
                <el-tag
                  :type="getOperationTagType(stat.operation)"
                  effect="light"
                  round
                >
                  {{ stat.operationName || stat.operation }}
                </el-tag>
                <strong class="operation-count">{{ stat.count }} 次</strong>
              </div>
              <el-progress
                :percentage="stat.percentage"
                :color="getOperationColor(stat.operation)"
                :stroke-width="8"
              />
            </div>
          </div>
          <el-empty
            v-else-if="!operationStatsLoading && !operationError"
            description="暂无操作统计数据"
          />
        </div>
      </AdminWorkspacePanel>

      <AdminWorkspacePanel
        title="操作趋势"
        class="chart-panel"
      >
        <template #tags>
          <el-icon><Icon :icon="iconMap.trendCharts" /></el-icon>
        </template>
        <template #actions>
          <div class="panel-actions">
            <el-select
              v-model="trendTimeRange"
              size="small"
              aria-label="统计时间范围"
              @change="refreshTrendStats"
            >
              <el-option
                v-for="days in ['7', '30', '90']"
                :key="days"
                :label="`最近${days}天`"
                :value="days"
              />
            </el-select>
            <el-button
              text
              :loading="trendStatsLoading"
              @click="refreshTrendStats"
            >
              刷新
            </el-button>
          </div>
        </template>

        <div
          v-loading="trendStatsLoading"
          class="chart-panel__body"
        >
          <el-alert
            v-if="trendError"
            :title="trendError"
            :description="trendStats.length ? '仍显示上次成功的结果' : undefined"
            type="error"
            :closable="false"
            show-icon
          />
          <div
            v-if="trendStats.length > 0"
            class="trend-stats"
          >
            <div class="trend-summary">
              <div class="trend-item">
                <span>总操作数</span><strong>{{ totalTrendCount }}</strong>
              </div>
              <div class="trend-item">
                <span>平均每日</span><strong>{{ averageDailyCount }}</strong>
              </div>
              <div class="trend-item">
                <span>最高单日</span><strong>{{ maxDailyCount }}</strong>
              </div>
            </div>

            <div
              class="trend-chart"
              tabindex="0"
              role="region"
              aria-label="按日操作数，可横向滚动"
            >
              <div
                v-for="stat in trendStats"
                :key="stat.day"
                class="trend-bar-shell"
                :title="`${stat.date}: ${stat.count}次操作`"
              >
                <div class="trend-bar-track">
                  <div
                    class="trend-bar"
                    :style="{ height: getTrendBarHeight(stat.count) + '%' }"
                  />
                </div>
                <span class="trend-date">{{ stat.date }}</span>
              </div>
            </div>
          </div>
          <el-empty
            v-else-if="!trendStatsLoading && !trendError"
            description="暂无趋势数据"
          />
        </div>
      </AdminWorkspacePanel>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import { handleError } from '@/utils/errorHandler.js'
import {
  getAuditOperationStatisticsApi,
  getAuditAgentStatisticsApi,
  getAuditTeamStatisticsApi,
  getAuditTrendStatisticsApi,
  getAuditUserStatisticsApi
} from '@/services/api/admin.js'
import { getOperationTagType } from './auditManagerModel.js'

function useStatsRequest(request, defaultMessage) {
  const result = shallowRef(null)
  const loading = ref(false)
  const error = ref('')
  let pending
  let resultParams

  onScopeDispose(() => pending?.abort())

  async function run(params) {
    pending?.abort()
    const current = new AbortController()
    pending = current
    const { signal } = current
    loading.value = true
    if (resultParams !== params) result.value = null
    error.value = ''
    try {
      const { data } = await request(params, signal)
      if (!signal.aborted) {
        result.value = data
        resultParams = params
      }
    } catch (failure) {
      if (signal.aborted) return
      const status = failure?.response?.status
      if (status === 401 || status === 403 || failure?.code === 'SESSION_CHANGED') result.value = null
      error.value = handleError(failure, { defaultMessage, showMessage: false })
    } finally {
      if (pending === current) {
        pending = undefined
        loading.value = false
      }
    }
  }

  return { result, loading, error, run }
}

function createStatsCard(label, idField, icon, request) {
  const draftId = ref('')
  const submittedId = ref('')
  const validationError = ref('')
  const stats = useStatsRequest(
    (id, signal) => request({ [idField]: id }, { signal }),
    `获取${label}统计失败`
  )

  const refresh = () => {
    if (!submittedId.value) return
    validationError.value = ''
    return stats.run(submittedId.value)
  }

  const query = () => {
    const id = draftId.value.trim()
    if (!id) {
      validationError.value = `请输入${label}ID`
      return
    }
    submittedId.value = id
    return refresh()
  }

  return { label, idField, icon, draftId, submittedId, validationError, ...stats, query, refresh }
}

const queryCards = reactive([
  createStatsCard('用户', 'userId', iconMap.user, getAuditUserStatisticsApi),
  createStatsCard('团队', 'teamId', iconMap.userFilled, getAuditTeamStatisticsApi),
  createStatsCard('主机', 'agentId', iconMap.server, getAuditAgentStatisticsApi)
])

async function readStatsRows(request) {
  const response = await request
  if (!Array.isArray(response.data)) throw new Error('审计统计响应格式异常')
  return response
}

const { result: operationRows, loading: operationStatsLoading, error: operationError,
  run: runOperationStats } = useStatsRequest(
  (_params, signal) => readStatsRows(getAuditOperationStatisticsApi({ signal })), '获取操作分布失败'
)
const refreshOperationStats = () => runOperationStats()

const operationStats = computed(() => {
  const rows = (operationRows.value ?? []).map((row) => ({ ...row, count: Number(row.count) }))
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return rows.map((row) => ({ ...row, percentage: total > 0 ? Math.round(row.count * 100 / total) : 0 }))
})
const getOperationColor = (operation) => `var(--el-color-${getOperationTagType(operation) || 'info'})`

const trendTimeRange = ref('7')
const { result: trendRows, loading: trendStatsLoading, error: trendError, run: runTrend } = useStatsRequest(
  (days, signal) => readStatsRows(getAuditTrendStatisticsApi({ days }, { signal })), '获取操作趋势失败'
)
const trendStats = computed(() => trendRows.value ?? [])
const totalTrendCount = computed(() => trendStats.value.reduce((sum, { count }) => sum + count, 0))
const averageDailyCount = computed(() =>
  trendStats.value.length ? Math.round(totalTrendCount.value / trendStats.value.length) : 0
)
const maxDailyCount = computed(() => trendStats.value.reduce((max, { count }) => Math.max(max, count), 0))
const getTrendBarHeight = (count) => maxDailyCount.value > 0 ? Math.round(count * 100 / maxDailyCount.value) : 0
const refreshTrendStats = () => runTrend(Number(trendTimeRange.value))

onMounted(() => {
  refreshOperationStats()
  refreshTrendStats()
})
</script>

<style scoped>
.audit-statistics {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: auto;
}

.query-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-3);
}

.query-card,
.chart-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.query-card__header,
.query-card__title,
.query-card__form,
.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.query-card__header {
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.query-card__title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.query-card__form {
  padding: 16px 18px 0;
}

.query-card__form .el-input {
  flex: 1;
}

.query-card__form .el-button {
  flex-shrink: 0;
}

.query-result {
  display: grid;
  gap: 10px;
  padding: 16px 18px 18px;
}

.query-message {
  margin: 0;
  padding: 8px 18px 16px;
  color: var(--el-color-danger);
  font-size: var(--el-font-size-small);
}

.result-item,
.trend-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--el-bg-color-page) 76%, var(--el-bg-color-overlay));
  border: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.result-item span,
.trend-item span {
  color: var(--el-text-color-secondary);
}

.result-item strong,
.trend-item strong {
  color: var(--el-text-color-primary);
}

.analytics-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: var(--space-4);
  min-height: 0;
}

.chart-panel__body {
  padding: 18px;
  min-height: 220px;
}

.chart-panel__body > .el-alert + div {
  margin-top: var(--space-3);
}

.panel-actions .el-select {
  width: 120px;
}

.operation-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.operation-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.operation-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.operation-count {
  color: var(--el-text-color-primary);
}

.trend-stats {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.trend-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.trend-chart {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(28px, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 10px;
  height: 240px;
  overflow-x: auto;
}

.trend-bar-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.trend-bar-track {
  display: flex;
  align-items: flex-end;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.trend-bar {
  width: 100%;
  border-radius: var(--radius-tag) var(--radius-tag) 0 0;
  background: var(--el-color-primary);
  box-shadow: none;
}

.trend-date {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .query-grid,
  .analytics-grid,
  .trend-summary {
    grid-template-columns: 1fr;
  }

  .query-card__header,
  .query-card__form,
  .chart-panel__body {
    padding-left: 14px;
    padding-right: 14px;
  }

  .query-card__form {
    flex-direction: column;
  }

  .query-card__form .el-button,
  .query-card__form .el-input {
    width: 100%;
  }

  .trend-chart {
    height: 180px;
  }

  .trend-date {
    writing-mode: horizontal-tb;
    transform: none;
  }
}
</style>
