<template>
  <div class="audit-statistics">
    <section class="query-grid">
      <article
        v-for="card in queryCards"
        :key="card.idField"
        v-loading="card.loading"
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
            @click="card.refresh"
          >
            刷新
          </el-button>
        </header>
        <div class="query-card__form">
          <el-input
            v-model="card.form[card.idField]"
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
          v-if="card.result"
          class="query-result"
        >
          <div class="result-item">
            <span>{{ card.label }}ID</span><strong>{{ card.result[card.idField] }}</strong>
          </div>
          <div class="result-item">
            <span>总操作数</span><strong>{{ card.result.totalOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最近操作</span><strong>{{ card.result.recentOperations }}</strong>
          </div>
          <div
            v-if="card.idField === 'userId'"
            class="result-item"
          >
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
            v-else
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

            <div class="trend-chart">
              <div
                v-for="(stat, index) in trendStats"
                :key="index"
                class="trend-bar-shell"
                :title="`${stat.date}: ${stat.count}次操作`"
              >
                <div
                  class="trend-bar"
                  :style="{ height: getTrendBarHeight(stat.count) + '%' }"
                />
                <span class="trend-date">{{ stat.date }}</span>
              </div>
            </div>
          </div>
          <el-empty
            v-else
            description="暂无趋势数据"
          />
        </div>
      </AdminWorkspacePanel>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted } from 'vue'

import { icons as iconMap } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import {
  getAuditOperationStatisticsApi,
  getAuditAgentStatisticsApi,
  getAuditTeamStatisticsApi,
  getAuditTrendStatisticsApi,
  getAuditUserStatisticsApi
} from '@/services/api/admin.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'

// 响应式数据
const operationStatsLoading = ref(false)
const trendStatsLoading = ref(false)

const queryCards = reactive([
  createStatsCard('用户', 'userId', params => getAuditUserStatisticsApi(params), iconMap.user),
  createStatsCard('团队', 'teamId', params => getAuditTeamStatisticsApi(params), iconMap.userFilled),
  createStatsCard('主机', 'hostId', params => getAuditAgentStatisticsApi(params), iconMap.server, 'agentId')
])

// 操作类型统计
const operationStats = ref([])

// 趋势统计
const trendTimeRange = ref('7')
const trendStats = ref([])
const totalTrendCount = computed(() => trendStats.value.reduce((sum, item) => sum + item.count, 0))
const averageDailyCount = computed(() =>
  trendStats.value.length > 0 ? Math.round(totalTrendCount.value / trendStats.value.length) : 0
)
const maxDailyCount = computed(() =>
  trendStats.value.length > 0 ? Math.max(...trendStats.value.map((item) => item.count)) : 0
)

// 方法
function createStatsCard(label, idField, request, icon, requestField = idField) {
  const form = reactive({ [idField]: '' })
  const loading = ref(false)
  const result = ref(null)

  const query = async () => {
    if (!form[idField]) {
      showWarning(`请输入${label}ID`)
      return
    }
    loading.value = true
    try {
      const response = await request({ [requestField]: form[idField] })
      result.value = response.data
      showSuccess(`${label}统计查询成功`)
    } catch {
      showError(`获取${label}统计失败`)
    } finally {
      loading.value = false
    }
  }

  const refresh = () => {
    if (form[idField]) query()
  }

  return { label, idField, icon, form, loading, result, query, refresh }
}

const refreshOperationStats = async () => {
  operationStatsLoading.value = true
  try {
    const response = await getAuditOperationStatisticsApi()
    const rows = Array.isArray(response.data) ? response.data : []
    const total = rows.reduce((sum, item) => sum + Number(item.count || 0), 0)
    operationStats.value = rows.map((item) => ({
      operation: item.operation,
      operationName: item.operationName || item.operation,
      count: Number(item.count || 0),
      percentage: total > 0 ? Math.round((Number(item.count || 0) / total) * 100) : 0
    }))
  } catch {
    showError('获取操作类型统计失败')
  } finally {
    operationStatsLoading.value = false
  }
}

const refreshTrendStats = async () => {
  trendStatsLoading.value = true
  try {
    const response = await getAuditTrendStatisticsApi({ days: Number(trendTimeRange.value) })
    trendStats.value = Array.isArray(response.data) ? response.data : []
  } catch {
    showError('获取趋势统计失败')
  } finally {
    trendStatsLoading.value = false
  }
}

const operationTagTypes = {
  命令执行: 'primary',
  文件上传: 'success',
  文件下载: 'info',
  新增Agent: 'success',
  修改Agent: 'warning',
  删除Agent: 'danger',
  初始化: 'info',
  基础信息: 'info',
  加载插件: 'primary'
}
const operationColors = Object.fromEntries(
  Object.entries(operationTagTypes).map(([operation, type]) => [operation, `var(--el-color-${type})`])
)

const getOperationTagType = (operation) => operationTagTypes[operation]
const getOperationColor = (operation) => operationColors[operation] || 'var(--el-color-info)'

const getTrendBarHeight = (count) => {
  const maxCount = maxDailyCount.value
  return maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
}

// 生命周期
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
  grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
  align-items: end;
  gap: 10px;
  height: 240px;
}

.trend-bar-shell {
  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.trend-bar {
  width: 100%;
  min-height: 6px;
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
