<template>
  <div class="audit-statistics">
    <section class="query-grid">
      <article
        v-loading="userStatsLoading"
        class="query-card surface"
      >
        <header class="query-card__header">
          <div class="query-card__title">
            <el-icon><Icon :icon="iconMap.user" /></el-icon>
            <span>用户统计</span>
          </div>
          <el-button
            text
            :loading="userStatsLoading"
            @click="refreshUserStats"
          >
            刷新
          </el-button>
        </header>
        <div class="query-card__form">
          <el-input
            v-model="userStatsForm.userId"
            placeholder="输入用户ID"
            clearable
            @keyup.enter="getUserStats"
          />
          <el-button
            type="primary"
            :loading="userStatsLoading"
            @click="getUserStats"
          >
            查询
          </el-button>
        </div>
        <div
          v-if="userStats"
          class="query-result"
        >
          <div class="result-item">
            <span>用户ID</span><strong>{{ userStats.userId }}</strong>
          </div>
          <div class="result-item">
            <span>总操作数</span><strong>{{ userStats.totalOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最近操作</span><strong>{{ userStats.recentOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最后操作</span><strong>{{ formatDateTime(userStats.lastOperation) }}</strong>
          </div>
        </div>
      </article>

      <article
        v-loading="teamStatsLoading"
        class="query-card surface"
      >
        <header class="query-card__header">
          <div class="query-card__title">
            <el-icon><Icon :icon="iconMap.userFilled" /></el-icon>
            <span>团队统计</span>
          </div>
          <el-button
            text
            :loading="teamStatsLoading"
            @click="refreshTeamStats"
          >
            刷新
          </el-button>
        </header>
        <div class="query-card__form">
          <el-input
            v-model="teamStatsForm.teamId"
            placeholder="输入团队ID"
            clearable
            @keyup.enter="getTeamStats"
          />
          <el-button
            type="primary"
            :loading="teamStatsLoading"
            @click="getTeamStats"
          >
            查询
          </el-button>
        </div>
        <div
          v-if="teamStats"
          class="query-result"
        >
          <div class="result-item">
            <span>团队ID</span><strong>{{ teamStats.teamId }}</strong>
          </div>
          <div class="result-item">
            <span>总操作数</span><strong>{{ teamStats.totalOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最近操作</span><strong>{{ teamStats.recentOperations }}</strong>
          </div>
        </div>
      </article>

      <article
        v-loading="hostStatsLoading"
        class="query-card surface"
      >
        <header class="query-card__header">
          <div class="query-card__title">
            <el-icon><Icon :icon="iconMap.server" /></el-icon>
            <span>主机统计</span>
          </div>
          <el-button
            text
            :loading="hostStatsLoading"
            @click="refreshHostStats"
          >
            刷新
          </el-button>
        </header>
        <div class="query-card__form">
          <el-input
            v-model="hostStatsForm.hostId"
            placeholder="输入主机ID"
            clearable
            @keyup.enter="getHostStats"
          />
          <el-button
            type="primary"
            :loading="hostStatsLoading"
            @click="getHostStats"
          >
            查询
          </el-button>
        </div>
        <div
          v-if="hostStats"
          class="query-result"
        >
          <div class="result-item">
            <span>主机ID</span><strong>{{ hostStats.hostId }}</strong>
          </div>
          <div class="result-item">
            <span>总操作数</span><strong>{{ hostStats.totalOperations }}</strong>
          </div>
          <div class="result-item">
            <span>最近操作</span><strong>{{ hostStats.recentOperations }}</strong>
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
                :percentage="getOperationPercentage(stat.count)"
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
                label="最近7天"
                value="7"
              />
              <el-option
                label="最近30天"
                value="30"
              />
              <el-option
                label="最近90天"
                value="90"
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
                <span>总操作数</span><strong>{{ getTotalTrendCount() }}</strong>
              </div>
              <div class="trend-item">
                <span>平均每日</span><strong>{{ getAverageDailyCount() }}</strong>
              </div>
              <div class="trend-item">
                <span>最高单日</span><strong>{{ getMaxDailyCount() }}</strong>
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
import { ref, reactive, onMounted } from 'vue'

import { icons } from '@/utils/icons.js'
import { formatDate as formatDateTime } from '@/utils/format.js'
import {
  getAuditOperationStatisticsApi,
  getAuditPuppetStatisticsApi,
  getAuditTeamStatisticsApi,
  getAuditTrendStatisticsApi,
  getAuditUserStatisticsApi
} from '@/services/api/admin.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'

const iconMap = icons

// 响应式数据
const userStatsLoading = ref(false)
const teamStatsLoading = ref(false)
const hostStatsLoading = ref(false)
const operationStatsLoading = ref(false)
const trendStatsLoading = ref(false)

// 用户统计
const userStatsForm = reactive({
  userId: ''
})
const userStats = ref(null)

// 团队统计
const teamStatsForm = reactive({
  teamId: ''
})
const teamStats = ref(null)

// 主机统计
const hostStatsForm = reactive({
  hostId: ''
})
const hostStats = ref(null)

// 操作类型统计
const operationStats = ref([])

// 趋势统计
const trendTimeRange = ref('7')
const trendStats = ref([])

// 方法
const getUserStats = async () => {
  if (!userStatsForm.userId) {
    showWarning('请输入用户ID')
    return
  }

  userStatsLoading.value = true
  try {
    const response = await getAuditUserStatisticsApi({ userId: userStatsForm.userId })
    userStats.value = response.data
    showSuccess('用户统计查询成功')
  } catch {
    showError('获取用户统计失败')
  } finally {
    userStatsLoading.value = false
  }
}

const refreshUserStats = () => {
  if (userStatsForm.userId) {
    getUserStats()
  }
}

const getTeamStats = async () => {
  if (!teamStatsForm.teamId) {
    showWarning('请输入团队ID')
    return
  }

  teamStatsLoading.value = true
  try {
    const response = await getAuditTeamStatisticsApi({ teamId: teamStatsForm.teamId })
    teamStats.value = response.data
    showSuccess('团队统计查询成功')
  } catch {
    showError('获取团队统计失败')
  } finally {
    teamStatsLoading.value = false
  }
}

const refreshTeamStats = () => {
  if (teamStatsForm.teamId) {
    getTeamStats()
  }
}

const getHostStats = async () => {
  if (!hostStatsForm.hostId) {
    showWarning('请输入主机ID')
    return
  }

  hostStatsLoading.value = true
  try {
    const response = await getAuditPuppetStatisticsApi({ puppetId: hostStatsForm.hostId })
    hostStats.value = response.data
    showSuccess('主机统计查询成功')
  } catch {
    showError('获取主机统计失败')
  } finally {
    hostStatsLoading.value = false
  }
}

const refreshHostStats = () => {
  if (hostStatsForm.hostId) {
    getHostStats()
  }
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

const getOperationTagType = (operation) => {
  const typeMap = {
    命令执行: 'primary',
    文件上传: 'success',
    文件下载: 'info',
    新增Puppet: 'success',
    修改Puppet: 'warning',
    删除Puppet: 'danger',
    初始化: 'info',
    基础信息: 'info',
    加载插件: 'primary'
  }
  return typeMap[operation]
}

const getOperationColor = (operation) => {
  const colorMap = {
    命令执行: 'var(--el-color-primary)',
    文件上传: 'var(--el-color-success)',
    文件下载: 'var(--el-color-info)',
    新增Puppet: 'var(--el-color-success)',
    修改Puppet: 'var(--el-color-warning)',
    删除Puppet: 'var(--el-color-danger)',
    初始化: 'var(--el-color-info)',
    基础信息: 'var(--el-color-info)',
    加载插件: 'var(--el-color-primary)'
  }
  return colorMap[operation] || 'var(--el-color-info)'
}

const getOperationPercentage = (count) => {
  const total = operationStats.value.reduce((sum, item) => sum + item.count, 0)
  return total > 0 ? Math.round((count / total) * 100) : 0
}

const getTotalTrendCount = () => {
  return trendStats.value.reduce((sum, item) => sum + item.count, 0)
}

const getAverageDailyCount = () => {
  const total = getTotalTrendCount()
  return trendStats.value.length > 0 ? Math.round(total / trendStats.value.length) : 0
}

const getMaxDailyCount = () => {
  return trendStats.value.length > 0 ? Math.max(...trendStats.value.map((item) => item.count)) : 0
}

const getTrendBarHeight = (count) => {
  const maxCount = getMaxDailyCount()
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

.header-actions {
  margin-left: auto;
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
