<template>
  <div class="evlog-workbench">
    <div class="evlog-shell">
      <EventLogControls
        v-model:selected-source="selectedSource"
        v-model:selected-format="selectedFormat"
        v-model:level-filter="levelFilter"
        v-model:since-filter="sinceFilter"
        v-model:keyword="keyword"
        v-model:jump-time="jumpTime"
        :sources="sources"
        :loading="isLoading"
        :querying="isQuerying"
        :entry-count="entries.length"
        :following="isFollowing"
        :has-older="hasOlder"
        :has-newer="hasNewer"
        :file-meta="fileMeta"
        :query-meta="queryMeta"
        @list-sources="handleListSources"
        @source-change="handleSourceChange"
        @format-change="handleFormatChange"
        @query="handleQuery"
        @preview="handlePreview"
        @stats="handleStats"
        @open-aggregate="showAggregateDialog = true"
        @export="handleExport"
        @older="handleOlder"
        @newer="handleNewer"
        @jump="handleJumpToTime"
        @toggle-follow="toggleFollow"
      />

      <!-- 主内容区 -->
      <section class="evlog-content">
        <EventLogResults
          v-model:source-panel-open="showSourcePanel"
          :sources="sources"
          :selected-source="selectedSource"
          :queried="queried"
          :querying="isQuerying"
          :access-format="isAccessFormat"
          :entries="entries"
          :os-info="osInfo"
          @select-source="handleSelectSource"
          @row-click="handleRowClick"
        />
      </section>

      <EventLogDialogs
        v-model:detail-open="showDetailDialog"
        v-model:stats-open="showStatsDialog"
        v-model:aggregate-open="showAggregateDialog"
        v-model:preview-open="showPreviewDialog"
        v-model:aggregate-group-by="aggregateGroupBy"
        v-model:aggregate-top-n="aggregateTopN"
        v-model:aggregate-min-status="aggregateMinStatus"
        v-model:aggregate-max-status="aggregateMaxStatus"
        v-model:aggregate-max-bytes="aggregateMaxBytes"
        v-model:aggregate-slow="aggregateSlow"
        :detail-entry="detailEntry"
        :stats-data="statsData"
        :is-stats-loading="isStatsLoading"
        :aggregate-result="aggregateResult"
        :is-aggregating="isAggregating"
        :preview-data="previewData"
        :is-previewing="isPreviewing"
        @aggregate="handleAggregate"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import {
  listEventLogSourcesApi,
  queryEventLogApi,
  getEventLogStatsApi,
  aggregateEventLogApi,
  metaEventLogApi,
  followEventLogSse
} from '@/services/api'
import { showWarning, showInfo, handleApiError } from '@/utils/messageUtils.js'
import { useSessionParams } from '@/composables/useSessionParams.js'
import { exportTsv } from '@/utils/exportUtils.js'
import { createLogger } from '@/utils/logger.js'
import EventLogControls from './EventLogControls.vue'
import EventLogDialogs from './EventLogDialogs.vue'
import EventLogResults from './EventLogResults.vue'
import { useEventLogFollow } from './useEventLogFollow.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import {
  appendBoundedEventLogEntries,
  buildEventLogAggregateParams,
  buildEventLogQueryParams,
  isEventLogAccessFormat
} from './eventLogModel.js'

const logger = createLogger('EventLogManager')

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const { withSession } = useSessionParams(() => props.sessionId)

// 状态
const isLoading = ref(false)
const isQuerying = ref(false)
const isAggregating = ref(false)
const isStatsLoading = ref(false)
const queried = ref(false)
const showSourcePanel = ref(false)
const showDetailDialog = ref(false)
const showStatsDialog = ref(false)
const showAggregateDialog = ref(false)

// 数据
const sources = ref([])
const entries = ref([])
const selectedSource = ref('')
const selectedFormat = ref('')           // 当前 source 的 format(自动 / 用户覆盖)
const levelFilter = ref('')
const sinceFilter = ref('')
const keyword = ref('')
const osInfo = ref('')
const detailEntry = ref(null)
const statsData = ref(null)

// 聚合
const aggregateGroupBy = ref('ip')
const aggregateTopN = ref(20)
const aggregateMinStatus = ref(null)
const aggregateMaxStatus = ref(null)
const aggregateMaxBytes = ref(0)            // 0 = 不限,推荐 64MB / 256MB
const aggregateSlow = ref(false)
const aggregateResult = ref(null)

// 预览
const showPreviewDialog = ref(false)
const isPreviewing = ref(false)
const previewData = ref(null)

// 翻页 / 时间跳转 / 实时跟随
const fileMeta = ref(null)              // 当前文件元数据(meta API 返回)
const queryMeta = ref(null)             // 上次 query 返回的 meta(startByte/endByte/...)
const jumpTime = ref('')                // 时间跳转输入(yyyy-MM-dd HH:mm:ss)
const requestGuard = createLatestRequestGuard([
  'sources',
  'query',
  'meta',
  'aggregate',
  'preview',
  'stats'
])
const hasOlder = computed(() => queryMeta.value && !queryMeta.value.reachedStart)
const hasNewer = computed(() => queryMeta.value && !queryMeta.value.reachedEnd)

// 当前 format 是否为 access 类(用于决定表格列)
const isAccessFormat = computed(() => isEventLogAccessFormat(selectedFormat.value))
const {
  isFollowing,
  start: startFollowing,
  stop: stopFollow
} = useEventLogFollow({
  createSource: followEventLogSse,
  onAppend(newEntries) {
    entries.value = appendBoundedEventLogEntries(entries.value, newEntries)
  },
  onMeta(meta) {
    fileMeta.value = meta
  },
  onError(error) {
    logger.warn('SSE 连接异常', error)
  }
})

function nextRequest(type) {
  return requestGuard.next(type)
}

function isCurrentRequest(type, sequence) {
  return requestGuard.isCurrent(type, sequence)
}

function invalidateRequests(...types) {
  requestGuard.invalidate(types)
}

function clearQueryResult() {
  entries.value = []
  queryMeta.value = null
  detailEntry.value = null
  queried.value = false
}

function resetWorkspace() {
  invalidateRequests('sources', 'query', 'meta', 'aggregate', 'preview', 'stats')
  stopFollow()
  sources.value = []
  entries.value = []
  selectedSource.value = ''
  selectedFormat.value = ''
  osInfo.value = ''
  detailEntry.value = null
  statsData.value = null
  aggregateResult.value = null
  previewData.value = null
  fileMeta.value = null
  queryMeta.value = null
  jumpTime.value = ''
  queried.value = false
  showSourcePanel.value = false
  showDetailDialog.value = false
  showStatsDialog.value = false
  showAggregateDialog.value = false
  showPreviewDialog.value = false
  isLoading.value = false
  isQuerying.value = false
  isAggregating.value = false
  isPreviewing.value = false
  isStatsLoading.value = false
}

watch(() => props.sessionId, resetWorkspace)

// 列举日志源
async function handleListSources() {
  const sequence = nextRequest('sources')
  isLoading.value = true
  try {
    const res = await listEventLogSourcesApi(withSession())
    if (!isCurrentRequest('sources', sequence)) return
    const data = res.data
    sources.value = data.sources || []
    osInfo.value = data.os || ''
    showSourcePanel.value = true
    if (sources.value.length === 0) {
      showWarning('未找到可用日志源')
    }
  } catch (e) {
    if (!isCurrentRequest('sources', sequence)) return
    handleApiError(e, '获取日志源失败')
  } finally {
    if (isCurrentRequest('sources', sequence)) isLoading.value = false
  }
}

// 选择日志源
function handleSelectSource(src) {
  selectedSource.value = src.name
  selectedFormat.value = src.format || ''
  handleSelectionChanged()
}

function handleSelectionChanged() {
  stopFollow()
  invalidateRequests('query', 'meta', 'aggregate', 'preview', 'stats')
  clearQueryResult()
  fileMeta.value = null
  statsData.value = null
  aggregateResult.value = null
  previewData.value = null
  showDetailDialog.value = false
  showStatsDialog.value = false
  showAggregateDialog.value = false
  showPreviewDialog.value = false
  isQuerying.value = false
  isAggregating.value = false
  isPreviewing.value = false
  isStatsLoading.value = false
  loadFileMeta()
}

// 在下拉框中选 source 后,把 format 也自动跟上
function handleSourceChange(name) {
  const src = sources.value.find(s => s.name === name)
  selectedFormat.value = src?.format || ''
  handleSelectionChanged()
}

function handleFormatChange() {
  handleSelectionChanged()
}

// 查询日志(支持 cursor / direction / since 进行翻页和时间跳转)
async function handleQuery(opts = {}) {
  stopFollow()
  const sequence = nextRequest('query')
  const params = withSession(buildEventLogQueryParams({
    source: selectedSource.value,
    keyword: keyword.value,
    level: levelFilter.value,
    since: sinceFilter.value,
    format: selectedFormat.value
  }, opts))
  isQuerying.value = true
  queried.value = true
  try {
    const res = await queryEventLogApi(params)
    if (!isCurrentRequest('query', sequence)) return
    const data = res.data
    entries.value = data.entries || []
    osInfo.value = data.os || osInfo.value
    queryMeta.value = data.meta || null
    if (entries.value.length === 0) {
      showInfo(opts.cursor !== undefined ? '没有更多日志' : '未查询到日志条目')
    }
  } catch (e) {
    if (!isCurrentRequest('query', sequence)) return
    handleApiError(e, '查询日志失败')
  } finally {
    if (isCurrentRequest('query', sequence)) isQuerying.value = false
  }
}

// 翻页:更老
function handleOlder() {
  if (!queryMeta.value) return
  handleQuery({ cursor: queryMeta.value.startByte, direction: 'older', since: '' })
}

// 翻页:更新
function handleNewer() {
  if (!queryMeta.value) return
  handleQuery({ cursor: queryMeta.value.endByte, direction: 'newer', since: '' })
}

// 时间跳转
function handleJumpToTime() {
  if (!jumpTime.value) {
    showWarning('请先输入跳转时间(如 2026-05-20 14:30:00)')
    return
  }
  handleQuery({ since: jumpTime.value })
}

// 获取文件元数据(展示文件大小/时间跨度)
async function loadFileMeta() {
  const sequence = nextRequest('meta')
  if (!selectedSource.value || !selectedSource.value.startsWith('/')) {
    fileMeta.value = null
    return
  }
  const params = withSession({
    source: selectedSource.value,
    format: selectedFormat.value || undefined
  })
  try {
    const res = await metaEventLogApi(params)
    if (!isCurrentRequest('meta', sequence)) return
    fileMeta.value = res.data
  } catch {
    if (isCurrentRequest('meta', sequence)) fileMeta.value = null
  }
}

// 实时跟随(SSE)
function toggleFollow() {
  if (isFollowing.value) {
    stopFollow()
  } else {
    startFollow()
  }
}

function startFollow() {
  if (!selectedSource.value || !selectedSource.value.startsWith('/')) {
    showWarning('实时跟随需要文件路径形式的日志源(以 / 开头)')
    return
  }
  stopFollow()
  invalidateRequests('query')
  isQuerying.value = false
  try {
    startFollowing({
      sessionId: props.sessionId,
      source: selectedSource.value,
      format: selectedFormat.value || undefined
    })
    queried.value = true
  } catch (e) {
    handleApiError(e, '启动跟随失败')
  }
}

onBeforeUnmount(() => { stopFollow() })

// 聚合统计
async function handleAggregate() {
  if (!selectedSource.value || !selectedSource.value.startsWith('/')) {
    showWarning('聚合需要文件路径形式的日志源(以 / 开头)')
    return
  }
  const sequence = nextRequest('aggregate')
  const params = withSession(buildEventLogAggregateParams({
    source: selectedSource.value,
    format: selectedFormat.value,
    groupBy: aggregateGroupBy.value,
    topN: aggregateTopN.value,
    maxBytes: aggregateMaxBytes.value,
    slow: aggregateSlow.value,
    keyword: keyword.value,
    minStatus: aggregateMinStatus.value,
    maxStatus: aggregateMaxStatus.value
  }))
  isAggregating.value = true
  aggregateResult.value = null
  showAggregateDialog.value = true
  try {
    const res = await aggregateEventLogApi(params)
    if (!isCurrentRequest('aggregate', sequence)) return
    aggregateResult.value = res.data
  } catch (e) {
    if (!isCurrentRequest('aggregate', sequence)) return
    handleApiError(e, '聚合失败')
    showAggregateDialog.value = false
  } finally {
    if (isCurrentRequest('aggregate', sequence)) isAggregating.value = false
  }
}

// 预览(测试读取):自定义路径可读性探测,复用 metaEventLogApi 加 lines 参数
async function handlePreview() {
  if (!selectedSource.value || !selectedSource.value.startsWith('/')) {
    showWarning('预览需要文件路径形式的日志源(以 / 开头)')
    return
  }
  const sequence = nextRequest('preview')
  const params = withSession({
    source: selectedSource.value,
    format: selectedFormat.value || undefined,
    lines: 5,
    tail: 'true'
  })
  isPreviewing.value = true
  previewData.value = null
  showPreviewDialog.value = true
  try {
    const res = await metaEventLogApi(params)
    if (!isCurrentRequest('preview', sequence)) return
    previewData.value = res.data
  } catch (e) {
    if (!isCurrentRequest('preview', sequence)) return
    handleApiError(e, '预览失败')
    showPreviewDialog.value = false
  } finally {
    if (isCurrentRequest('preview', sequence)) isPreviewing.value = false
  }
}

// 查看统计
async function handleStats() {
  const sequence = nextRequest('stats')
  const params = withSession({ source: selectedSource.value || undefined })
  statsData.value = null
  isStatsLoading.value = true
  showStatsDialog.value = true
  try {
    const res = await getEventLogStatsApi(params)
    if (!isCurrentRequest('stats', sequence)) return
    const data = res.data
    statsData.value = data
  } catch (e) {
    if (!isCurrentRequest('stats', sequence)) return
    handleApiError(e, '获取统计失败')
    showStatsDialog.value = false
  } finally {
    if (isCurrentRequest('stats', sequence)) isStatsLoading.value = false
  }
}

// 行点击查看详情
function handleRowClick(row) {
  detailEntry.value = row
  showDetailDialog.value = true
}

// 导出 TSV
function handleExport() {
  exportTsv(entries.value, `event-log-${Date.now()}`)
}

</script>

<style scoped>
.evlog-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.evlog-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.evlog-content {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

</style>
