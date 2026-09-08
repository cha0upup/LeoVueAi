<template>
  <div class="asset-discovery-view">
    <header class="page-head">
      <div class="head-copy">
        <div class="title-line">
          <h1>网络资产发现</h1>
          <span v-if="activeTask" class="status-pill" :class="statusClass(activeTask.status, activeTask.outcome)">
            <span class="status-dot" />{{ getStatusText(activeTask.status, activeTask.outcome) }}
          </span>
        </div>
      </div>
      <div class="head-actions">
        <el-button v-if="isRunning(activeTask)" circle :icon="VideoPause" aria-label="暂停扫描" title="暂停扫描" @click="pauseActiveTask" />
        <el-button v-if="isPaused(activeTask)" circle :icon="VideoPlay" aria-label="继续扫描" title="继续扫描" @click="resumeActiveTask" />
        <el-button v-if="isRunning(activeTask) || isPaused(activeTask)" circle type="danger" plain :icon="Close" aria-label="停止扫描" title="停止扫描" @click="stopActiveTask" />
        <el-button circle :icon="Refresh" aria-label="刷新任务" title="刷新任务" :loading="historyLoading" @click="syncTasks" />
        <el-button :icon="Clock" @click="showHistoryDrawer = true">扫描历史</el-button>
        <el-button type="primary" :icon="Plus" @click="showComposer = true">新建扫描</el-button>
      </div>
    </header>

    <div class="workspace-grid">
      <aside class="task-rail">
        <div class="rail-header">
          <h2>扫描任务</h2>
          <span class="task-count">{{ filteredTasks.length }}</span>
        </div>
        <div class="task-tools">
          <el-input v-model="taskSearch" :prefix-icon="Search" clearable placeholder="搜索" />
          <el-radio-group v-model="taskFilter" size="small" class="task-segmented">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="active">进行中</el-radio-button>
            <el-radio-button label="done">已结束</el-radio-button>
          </el-radio-group>
        </div>
        <el-scrollbar class="task-scroll">
          <div v-if="filteredTasks.length === 0" class="task-empty">
            <el-icon><FolderOpened /></el-icon>
            <span>{{ tasks.length ? '没有匹配任务' : '暂无扫描任务' }}</span>
            <el-button v-if="!tasks.length" text type="primary" @click="showComposer = true">新建扫描</el-button>
          </div>
          <button
            v-for="task in filteredTasks"
            :key="getTaskId(task)"
            type="button"
            class="task-row"
            :class="{ selected: selectedTaskId === getTaskId(task) }"
            @click="selectTask(getTaskId(task))"
          >
            <div class="task-row-top">
              <span class="task-row-name">{{ task.name || task.targetLabel || '未命名扫描' }}</span>
              <span class="mini-status" :class="statusClass(task.status, task.outcome)"><span class="status-dot" />{{ getStatusText(task.status, task.outcome) }}</span>
            </div>
            <div class="task-row-meta">
              <span><el-icon><Clock /></el-icon>{{ formatTime(task.createdAt || task.createdTime || task.createTime) }}</span>
              <span><el-icon><Aim /></el-icon>{{ formatCount(getMetrics(task).targetTotal) }} 目标</span>
            </div>
            <div v-if="isRunning(task) || isPaused(task)" class="task-row-progress"><span :style="{ width: `${clampProgress(task.progress)}%` }" /></div>
            <div class="task-row-foot">
              <span>开放 {{ formatCount(getMetrics(task).openCount) }}</span>
              <span>服务 {{ formatCount(getMetrics(task).serviceCount) }}</span>
              <span v-if="getMetrics(task).errorCount">异常 {{ formatCount(getMetrics(task).errorCount) }}</span>
              <el-icon class="row-arrow"><ArrowRight /></el-icon>
            </div>
          </button>
        </el-scrollbar>
      </aside>

      <main class="results-area">
        <div v-if="activeTask" class="stage-track">
          <div v-for="(stage, index) in stageDefinitions" :key="stage.name" class="stage-node" :class="stageClass(stage.name)">
            <div v-if="index < stageDefinitions.length - 1" class="stage-node-line" />
            <div class="stage-node-marker"><el-icon v-if="stageIsComplete(stage.name)"><Check /></el-icon><span v-else>{{ index + 1 }}</span></div>
            <div class="stage-node-copy"><strong>{{ stage.label }}</strong><span>{{ stageStatusText(stage.name) }}</span></div>
          </div>
        </div>

        <div v-if="!activeTask" class="workspace-empty">
          <div class="empty-graphic"><DataAnalysis /></div>
          <h2>准备开始一次发现</h2>
          <el-button type="primary" :icon="Plus" @click="showComposer = true">新建扫描</el-button>
        </div>
        <div v-if="activeTask" class="stage-output">
          <div class="stage-output-head">
            <strong>存活主机</strong>
            <span>{{ formatCount(getMetrics(activeTask).reachableHostCount) }} / {{ formatCount(getMetrics(activeTask).targetTotal) }}</span>
          </div>
          <div v-if="visibleReachableHosts.length" class="host-list">
            <span v-for="host in visibleReachableHosts" :key="host" class="host-chip">{{ host }}</span>
            <span v-if="reachableHostOverflow > 0" class="host-more">+{{ formatCount(reachableHostOverflow) }}</span>
          </div>
          <span v-else class="stage-output-empty">探活完成后将在这里显示存活主机</span>
        </div>
        <AssetResultTable v-if="activeTask" :task-id="activeBackendTaskId" :session-id="sessionId" :refresh-token="resultRefreshToken" @view-evidence="handleViewEvidence" />
      </main>
    </div>

    <el-dialog
      v-model="showComposer"
      title="新建扫描"
      width="min(960px, calc(100vw - 32px))"
      top="5vh"
      class="scan-composer-dialog"
      destroy-on-close
    >
      <ScanComposer :session-id="sessionId" @scan-started="handleScanStarted" @cancel="showComposer = false" />
    </el-dialog>
    <EvidenceDrawer v-model="showEvidenceDrawer" :endpoint="selectedEndpoint" :task-id="activeBackendTaskId" :session-id="sessionId" />
    <el-drawer v-model="showHistoryDrawer" title="扫描历史" size="min(560px, 92vw)" direction="rtl" @open="syncTasks">
      <div class="history-drawer">
        <div class="history-summary">
          <div><strong>{{ tasks.length }}</strong><span>全部</span></div>
          <div><strong>{{ runningTaskCount }}</strong><span>进行中</span></div>
          <div><strong>{{ tasks.length - runningTaskCount }}</strong><span>已结束</span></div>
        </div>
        <div class="history-tools">
          <el-input v-model="historySearch" :prefix-icon="Search" clearable placeholder="搜索任务或编号" />
          <el-radio-group v-model="historyFilter" size="small" class="history-segmented">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="active">进行中</el-radio-button>
            <el-radio-button label="done">已结束</el-radio-button>
          </el-radio-group>
        </div>
        <el-scrollbar v-loading="historyLoading" class="history-list">
          <button
            v-for="row in historyDrawerTasks"
            :key="getTaskId(row)"
            type="button"
            class="history-card"
            @click="selectHistoryTask(row)"
          >
            <div class="history-card-top">
              <div class="history-card-title">
                <span class="history-status-mark" :class="statusClass(row.status, row.outcome)" />
                <strong>{{ row.name || row.targetLabel || '网络资产发现' }}</strong>
              </div>
              <span class="history-status" :class="statusClass(row.status, row.outcome)">{{ getStatusText(row.status, row.outcome) }}</span>
            </div>
            <div class="history-card-meta">
              <span><el-icon><Aim /></el-icon>{{ formatCount(getMetrics(row).targetTotal) }} 个目标</span>
              <span><el-icon><Clock /></el-icon>{{ formatHistoryTime(row.createdAt || row.createdTime || row.createTime) }}</span>
              <span class="history-card-id">{{ shortTaskId(row.backendTaskId || row.taskId) }}</span>
            </div>
            <div class="history-card-progress">
              <div class="history-card-progress-head"><span>进度</span><strong>{{ Math.round(Number(row.progress || 0)) }}%</strong></div>
              <el-progress :percentage="clampProgress(row.progress)" :show-text="false" :stroke-width="5" :status="getProgressStatus(row)" />
            </div>
            <div class="history-card-foot">
              <span>开放 {{ formatCount(getMetrics(row).openCount) }}</span>
              <span>服务 {{ formatCount(getMetrics(row).serviceCount) }}</span>
              <span v-if="getMetrics(row).errorCount">异常 {{ formatCount(getMetrics(row).errorCount) }}</span>
              <el-icon><ArrowRight /></el-icon>
            </div>
          </button>
          <div v-if="!historyLoading && historyDrawerTasks.length === 0" class="history-empty">
            <el-icon><FolderOpened /></el-icon>
            <span>{{ tasks.length ? '没有匹配任务' : '暂无扫描历史' }}</span>
          </div>
        </el-scrollbar>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Aim, ArrowRight, Check, Clock, Close, DataAnalysis, FolderOpened, Plus, Refresh, Search, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AssetResultTable from './AssetResultTable.vue'
import ScanComposer from './ScanComposer.vue'
import EvidenceDrawer from './EvidenceDrawer.vue'
import { taskEngine } from '../File/TaskEngine.js'
import { TaskStatus, TaskType } from '@/constants/task.js'

const props = defineProps({ sessionId: { type: String, required: true } })
const tasks = ref([])
const selectedTaskId = ref(null)
const taskSearch = ref('')
const taskFilter = ref('all')
const historySearch = ref('')
const historyFilter = ref('all')
const showComposer = ref(false)
const showEvidenceDrawer = ref(false)
const showHistoryDrawer = ref(false)
const historyLoading = ref(false)
const selectedEndpoint = ref(null)
const resultRefreshToken = ref(0)
const stageDefinitions = [
  { name: 'REACHABILITY', label: '主机探活' },
  { name: 'PORT_SCAN', label: '端口扫描' },
  { name: 'SERVICE_PROBE', label: '服务识别' },
  { name: 'RECON', label: '指纹分析' }
]

const activeTask = computed(() => tasks.value.find(task => getTaskId(task) === selectedTaskId.value) || null)
const activeBackendTaskId = computed(() => {
  const task = activeTask.value
  return task?.backendTaskId || task?.serverTaskId || task?.taskId || task?.result?.taskId || selectedTaskId.value
})
const runningTaskCount = computed(() => tasks.value.filter(task => isRunning(task) || isPaused(task)).length)
const visibleReachableHosts = computed(() => Array.isArray(activeTask.value?.reachableHostList)
  ? activeTask.value.reachableHostList.slice(0, 160)
  : [])
const reachableHostOverflow = computed(() => Math.max(0,
  getMetrics(activeTask.value).reachableHostCount - visibleReachableHosts.value.length))
const historyTasks = computed(() => [...tasks.value].sort((left, right) => timestampValue(right.createdAt || right.createdTime) - timestampValue(left.createdAt || left.createdTime)))
const historyDrawerTasks = computed(() => {
  const query = historySearch.value.trim().toLowerCase()
  return historyTasks.value.filter(task => {
    const active = isRunning(task) || isPaused(task)
    if (historyFilter.value === 'active' && !active) return false
    if (historyFilter.value === 'done' && active) return false
    return !query || String(task.name || task.targetLabel || '').toLowerCase().includes(query) || String(task.backendTaskId || task.taskId || '').toLowerCase().includes(query)
  })
})
const filteredTasks = computed(() => {
  const query = taskSearch.value.trim().toLowerCase()
  return historyTasks.value.filter(task => {
    const active = isRunning(task) || isPaused(task)
    if (taskFilter.value === 'active' && !active) return false
    if (taskFilter.value === 'done' && active) return false
    return !query || String(task.name || task.targetLabel || '').toLowerCase().includes(query) || String(task.backendTaskId || '').toLowerCase().includes(query)
  })
})
function getTaskId(task) { return task?.id || task?.taskId || task?.backendTaskId || null }
function selectTask(taskId) {
  selectedTaskId.value = taskId
  const task = tasks.value.find(item => getTaskId(item) === taskId)
  if (!task || isRunning(task) || task.reachabilityLoaded || task.reachableHostList?.length) return
  void taskEngine.queryScanTask(task).then(() => {
    refreshTaskList()
    resultRefreshToken.value += 1
  }).catch(() => {})
}
function selectHistoryTask(task) { selectTask(getTaskId(task)); showHistoryDrawer.value = false }
function handleScanStarted(task) {
  const backendTaskId = task?.taskId || task?.result?.taskId
  if (!backendTaskId) { ElMessage.error('启动响应缺少任务编号'); return }
  const scan = task.scan || {}
  const targetItems = scan.targets?.items || []
  const taskId = taskEngine.createScanTask(props.sessionId, 'network_workflow', scan.name || '网络资产发现', 4, { backendTaskId, targetCount: targetItems.length, scanHosts: targetItems, scanPorts: scan.portPolicy?.include || [] })
  taskEngine.hydrateScanTask(taskId, { taskId: backendTaskId, scanKind: 'network_workflow', status: 'RUNNING', outcome: 'RUNNING', targetLabel: scan.name || '网络资产发现', targetCount: targetItems.length, hosts: targetItems, currentStage: 'REACHABILITY', stageCount: 4, completedStageCount: 0, progress: 0 })
  selectedTaskId.value = taskId
  showComposer.value = false
  refreshTaskList()
  ElMessage.success('扫描已启动')
}
function handleViewEvidence(endpoint) { selectedEndpoint.value = endpoint; showEvidenceDrawer.value = true }
async function pauseActiveTask() { if (!activeTask.value) return; try { await taskEngine.pauseTask(activeTask.value.id); ElMessage.success('扫描已暂停') } catch (error) { ElMessage.error(error.message || '暂停失败') } }
async function resumeActiveTask() { if (!activeTask.value) return; try { await taskEngine.resumeTask(activeTask.value.id); ElMessage.success('扫描已继续') } catch (error) { ElMessage.error(error.message || '继续失败') } }
async function stopActiveTask() {
  if (!activeTask.value) return
  try {
    await ElMessageBox.confirm('停止后将保留当前已发现结果。', '停止扫描', { type: 'warning', confirmButtonText: '停止', cancelButtonText: '取消' })
    await taskEngine.stopTask(activeTask.value.id)
    ElMessage.success('扫描已停止')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '停止失败')
  }
}
function normalizedOutcome(status, outcome) {
  const normalizedStatus = String(status || '').toUpperCase()
  const normalizedOutcome = String(outcome || '').toUpperCase()
  if (normalizedStatus !== 'STOPPED') return normalizedStatus
  return normalizedOutcome || normalizedStatus
}
function statusClass(status, outcome) { return `status-${String(normalizedOutcome(status, outcome) || '').toLowerCase()}` }
function getStatusText(status, outcome) { return { PENDING: '等待中', RUNNING: '扫描中', SCANNING: '扫描中', PAUSED: '已暂停', STOPPED: '已结束', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }[normalizedOutcome(status, outcome)] || status || '等待中' }
function isRunning(task) { return [TaskStatus.SCANNING, 'RUNNING'].includes(task?.status) }
function isPaused(task) { return [TaskStatus.PAUSED, 'PAUSED'].includes(task?.status) }
function getMetrics(task) { return { targetTotal: Number(task?.targetCount || task?.metrics?.targetTotal || task?.totalCount || 0), reachableHostCount: Number(task?.reachableHostCount ?? task?.reachableHostList?.length ?? 0), openCount: Number(task?.openCount ?? (Array.isArray(task?.openPortResults) ? task.openPortResults.length : 0)), serviceCount: Number(task?.serviceCount ?? (Array.isArray(task?.serviceResults) ? task.serviceResults.length : 0)), fingerprintCount: Number(task?.fingerprintCount || 0), errorCount: Number(task?.errorCount ?? (Array.isArray(task?.errors) ? task.errors.length : task?.error ? 1 : 0)) } }
function getProgressStatus(task) { if (!task) return undefined; if (String(task.status || '').toUpperCase() === 'FAILED') return 'exception'; if (isPaused(task)) return 'warning'; return undefined }
function clampProgress(value) { const number = Number(value || 0); return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0 }
function formatCount(value) { return Number(value || 0).toLocaleString('zh-CN') }
function shortTaskId(value) { const text = String(value || ''); return text ? `#${text.slice(0, 8)}` : '未连接任务' }
function formatTime(timestamp) { if (!timestamp) return '-'; const date = new Date(timestamp); const diff = Date.now() - date.getTime(); if (diff < 60000) return '刚刚'; if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`; return date.toLocaleDateString('zh-CN') }
function formatHistoryTime(timestamp) { const date = new Date(timestamp); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN') }
function timestampValue(value) { const number = Number(value); if (typeof value === 'number' && Number.isFinite(number)) return number; const parsed = Date.parse(String(value || '')); return Number.isFinite(parsed) ? parsed : 0 }
function stageSnapshot(name) { return activeTask.value?.stages?.find(stage => stage.name === name) || null }
function stageIsComplete(name) {
  const stage = stageSnapshot(name)
  if (stage) return ['COMPLETED', 'SKIPPED'].includes(String(stage.status || '').toUpperCase())
  return normalizedOutcome(activeTask.value?.status, activeTask.value?.outcome) === 'COMPLETED'
}
function stageClass(name) {
  const stage = stageSnapshot(name)
  const status = String(stage?.status || '').toLowerCase()
  const terminalWithoutSnapshot = !stage && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(normalizedOutcome(activeTask.value?.status, activeTask.value?.outcome))
  return {
    complete: stageIsComplete(name),
    current: !terminalWithoutSnapshot && (activeTask.value?.currentStage === name || status === 'running'),
    failed: status === 'failed'
  }
}
function stageStatusText(name) {
  const stage = stageSnapshot(name)
  if (stage) {
    if (stage.reason === 'DISABLED' || stage.status === 'SKIPPED') return '已跳过'
    if (name === 'REACHABILITY' && activeTask.value?.reachableHostList) return `${formatCount(getMetrics(activeTask.value).reachableHostCount)} 台存活`
    if (name === 'PORT_SCAN' && getMetrics(activeTask.value).openCount) return `${formatCount(getMetrics(activeTask.value).openCount)} 个开放端口`
    if (name === 'SERVICE_PROBE' && getMetrics(activeTask.value).serviceCount) return `${formatCount(getMetrics(activeTask.value).serviceCount)} 个服务`
    if (name === 'RECON' && getMetrics(activeTask.value).fingerprintCount) return `${formatCount(getMetrics(activeTask.value).fingerprintCount)} 个指纹`
    return getStatusText(stage.status, stage.outcome)
  }
  const outcome = normalizedOutcome(activeTask.value?.status, activeTask.value?.outcome)
  if (outcome === 'COMPLETED') return '已完成'
  if (outcome === 'FAILED') return '未完成'
  if (outcome === 'CANCELLED') return '已取消'
  return '等待中'
}
function refreshTaskList() {
  tasks.value = taskEngine.getTasksBySession(props.sessionId)
    .filter(task => task.type === TaskType.SCAN && task.scanKind === 'network_workflow')
  if (!selectedTaskId.value && tasks.value.length) selectTask(getTaskId(historyTasks.value[0]))
}

let refreshTimer = null
const taskEvents = ['taskCreated', 'taskProgress', 'taskCompleted', 'taskFailed', 'taskPaused', 'taskResumed', 'taskCancelled']
function isTerminalTask(task) {
  return ['completed', 'cancelled', 'failed'].includes(String(task?.status || '').toLowerCase())
}
async function syncTasks() {
  historyLoading.value = true
  try {
    await taskEngine.syncNetworkWorkflowTasks(props.sessionId)
    const currentTasks = taskEngine.getTasksBySession(props.sessionId).filter(task => task.type === TaskType.SCAN && task.scanKind === 'network_workflow')
    await Promise.allSettled(currentTasks.filter(task => !isTerminalTask(task)).map(task => taskEngine.queryScanTask(task)))
    resultRefreshToken.value += 1
  } catch (error) {
    if (!tasks.value.length) ElMessage.error(`加载扫描任务失败: ${error.message || '未知错误'}`)
  }
  refreshTaskList()
  historyLoading.value = false
}
onMounted(() => { taskEvents.forEach(event => taskEngine.on(event, refreshTaskList)); void syncTasks(); refreshTimer = window.setInterval(syncTasks, 2000) })
onUnmounted(() => { taskEvents.forEach(event => taskEngine.off(event, refreshTaskList)); if (refreshTimer) window.clearInterval(refreshTimer); refreshTimer = null })
</script>

<style scoped lang="scss">
.asset-discovery-view { --ink: #17212b; --muted: #73808c; --line: #e4e9ee; --surface: #fff; --canvas: #f4f7f8; --blue: #2563eb; min-height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 20px; color: var(--ink); background: var(--canvas); }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.title-line { display: flex; align-items: center; gap: 12px; }
h1, h2 { margin: 0; }
h1 { font-size: 21px; line-height: 1.2; letter-spacing: 0; }
.head-actions { display: flex; align-items: center; gap: 7px; }
.status-pill, .mini-status { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; border: 1px solid #dbe2e8; border-radius: 999px; padding: 4px 9px; color: #5e6b78; font-size: 11px; }
.status-running, .status-scanning { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
.status-paused { color: #a16207; border-color: #fde68a; background: #fffbeb; }
.status-completed { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
.status-failed { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.status-cancelled { color: #64748b; background: #f8fafc; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.workspace-grid { min-height: 0; flex: 1; display: grid; grid-template-columns: 242px minmax(0, 1fr); gap: 12px; }
.task-rail, .results-area { min-height: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.task-rail { display: flex; flex-direction: column; overflow: hidden; }
.rail-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 13px 10px; border-bottom: 1px solid var(--line); }
.rail-header h2 { margin: 0; font-size: 15px; font-weight: 650; }
.task-count { min-width: 22px; height: 22px; display: grid; place-items: center; border-radius: 5px; color: #1d4ed8; background: #edf3ff; font-size: 11px; font-weight: 700; }
.task-tools { display: flex; align-items: center; gap: 6px; padding: 8px; border-bottom: 1px solid var(--line); }
.task-tools :deep(.el-input) { min-width: 0; }
.task-tools :deep(.el-input__wrapper) { padding: 1px 7px; }
.task-segmented { width: 100%; }
.task-tools .task-segmented { flex: 0 0 106px; }
.task-segmented :deep(.el-radio-button) { flex: 1; }
.task-segmented :deep(.el-radio-button__inner) { width: 100%; padding: 6px 5px; font-size: 11px; }
.task-scroll { flex: 1; padding: 8px; }
.task-row { width: 100%; display: block; padding: 10px 8px 9px; border: 1px solid transparent; border-radius: 6px; color: inherit; text-align: left; background: transparent; cursor: pointer; transition: background .18s, border-color .18s; }
.task-row:hover { border-color: #cddcf8; background: #f7faff; }
.task-row.selected { border-color: #9dbcf8; background: #f0f6ff; box-shadow: inset 3px 0 0 var(--blue); }
.task-row + .task-row { margin-top: 4px; }
.task-row-top, .task-row-meta, .task-row-foot { display: flex; align-items: center; }
.task-row-top { justify-content: space-between; gap: 8px; }
.task-row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.mini-status { padding: 2px 6px; border: 0; background: #f4f6f8; font-size: 10px; }
.mini-status.status-running, .mini-status.status-scanning { background: #eaf1ff; }
.task-row-meta { gap: 9px; margin-top: 6px; color: #8995a1; font-size: 10px; }
.task-row-meta span { display: inline-flex; align-items: center; gap: 4px; }
.task-row-meta svg { width: 12px; }
.task-row-progress { height: 3px; margin: 8px 0 7px; overflow: hidden; border-radius: 3px; background: #e9edf1; }
.task-row-progress span { display: block; height: 100%; border-radius: inherit; background: var(--blue); transition: width .25s ease; }
.task-row-foot { gap: 9px; color: #6e7a86; font-size: 10px; }
.row-arrow { margin-left: auto; color: #a7b1ba; }
.task-empty { min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #9ba5ae; font-size: 12px; }
.task-empty .el-icon { font-size: 24px; color: #c4cdd5; }
.results-area { display: flex; flex-direction: column; overflow: hidden; }
.stage-output { flex: 0 0 auto; padding: 10px 16px; border-bottom: 1px solid var(--line); background: #fff; }
.stage-output-head { display: flex; align-items: center; gap: 8px; color: #4a5966; font-size: 11px; }
.stage-output-head span { color: #8a96a3; }
.host-list { display: flex; flex-wrap: wrap; gap: 5px; max-height: 66px; margin-top: 8px; overflow: auto; }
.host-chip, .host-more { display: inline-flex; align-items: center; min-height: 22px; padding: 2px 7px; border: 1px solid #d8e5f8; border-radius: 4px; color: #315d9c; background: #f5f8fe; font-family: monospace; font-size: 10px; }
.host-more { border-color: #e3e8ed; color: #7b8792; background: #f8fafb; }
.stage-output-empty { display: block; margin-top: 7px; color: #a0aab3; font-size: 10px; }
.stage-track { display: grid; grid-template-columns: repeat(4, 1fr); padding: 10px 16px 9px; border-bottom: 1px solid var(--line); background: #fbfcfd; }
.stage-node { position: relative; display: flex; align-items: flex-start; gap: 7px; min-width: 0; }
.stage-node-line { position: absolute; top: 10px; left: 23px; right: 8px; height: 1px; background: #dfe5ea; }
.stage-node.complete .stage-node-line { background: #9bd5cb; }
.stage-node-marker { position: relative; z-index: 1; flex: 0 0 21px; width: 21px; height: 21px; display: grid; place-items: center; border: 1px solid #dbe2e8; border-radius: 50%; color: #98a3ad; background: #fff; font-size: 9px; }
.stage-node.current .stage-node-marker { border-color: var(--blue); color: #fff; background: var(--blue); box-shadow: 0 0 0 4px #eaf1ff; }
.stage-node.complete .stage-node-marker { border-color: #54b8a7; color: #fff; background: #15947f; }
.stage-node.failed .stage-node-marker { border-color: #f3a7a7; color: #b91c1c; background: #fff1f1; }
.stage-node-copy { min-width: 0; padding-top: 1px; }
.stage-node-copy strong, .stage-node-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-node-copy strong { color: #354250; font-size: 11px; }
.stage-node-copy span { margin-top: 3px; color: #97a2ad; font-size: 9px; }
.results-area :deep(.asset-result-table) { flex: 1; min-height: 0; border: 0; border-radius: 0; box-shadow: none; }
.workspace-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 360px; padding: 30px; text-align: center; }
.empty-graphic { width: 58px; height: 58px; display: grid; place-items: center; border: 1px solid #c8d9ee; border-radius: 50%; color: var(--blue); background: #eff5ff; }
.empty-graphic svg { width: 27px; height: 27px; }
.workspace-empty h2 { margin-top: 17px; font-size: 18px; }
:deep(.scan-composer-dialog.el-dialog) { width: min(960px, calc(100vw - 32px)); margin: 5vh auto 0; overflow: hidden; border-radius: 14px; box-shadow: 0 24px 70px rgba(24, 43, 61, .18); }
:deep(.scan-composer-dialog .el-dialog__header) { margin: 0; padding: 22px 30px 10px; border-bottom: 0; background: #fff; }
:deep(.scan-composer-dialog .el-dialog__title) { color: var(--ink); font-size: 18px; font-weight: 650; }
:deep(.scan-composer-dialog .el-dialog__headerbtn) { top: 18px; right: 22px; }
:deep(.scan-composer-dialog .el-dialog__body) { height: min(600px, 76vh); padding: 0; overflow: hidden; background: #fff; }
.history-drawer { display: flex; flex-direction: column; height: 100%; padding: 0 4px; }
.history-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.history-summary > div { padding: 11px 12px; border: 1px solid var(--line); border-radius: 6px; background: #fbfcfd; }
.history-summary strong, .history-summary span { display: block; }
.history-summary strong { color: var(--ink); font-size: 19px; font-weight: 650; }
.history-summary span { margin-top: 3px; color: #8a96a3; font-size: 10px; }
.history-tools { display: grid; gap: 10px; padding-bottom: 13px; border-bottom: 1px solid var(--line); }
.history-segmented { display: flex; width: 100%; }
.history-segmented :deep(.el-radio-button) { flex: 1; }
.history-segmented :deep(.el-radio-button__inner) { width: 100%; padding: 6px 5px; font-size: 11px; }
.history-list { flex: 1; min-height: 0; padding: 12px 2px 4px; }
.history-card { width: 100%; display: block; padding: 13px 13px 11px; border: 1px solid #e1e7ed; border-radius: 7px; color: var(--ink); background: #fff; text-align: left; cursor: pointer; transition: border-color .18s, box-shadow .18s, transform .18s; }
.history-card + .history-card { margin-top: 8px; }
.history-card:hover { border-color: #9dbcf8; box-shadow: 0 4px 14px rgba(42, 77, 121, .08); transform: translateY(-1px); }
.history-card-top, .history-card-title, .history-card-meta, .history-card-foot, .history-card-progress-head { display: flex; align-items: center; }
.history-card-top { justify-content: space-between; gap: 10px; }
.history-card-title { min-width: 0; gap: 8px; }
.history-card-title strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; }
.history-status-mark { flex: 0 0 7px; width: 7px; height: 7px; border-radius: 50%; background: #aab4bd; }
.history-status-mark.status-running, .history-status-mark.status-scanning { background: #2563eb; box-shadow: 0 0 0 4px #edf3ff; }
.history-status-mark.status-paused { background: #d97706; box-shadow: 0 0 0 4px #fff7e6; }
.history-status-mark.status-completed { background: #15947f; box-shadow: 0 0 0 4px #e8faf5; }
.history-status-mark.status-failed { background: #dc2626; box-shadow: 0 0 0 4px #fff1f1; }
.history-status { flex: 0 0 auto; padding: 3px 7px; border-radius: 4px; color: #6e7a86; background: #f3f5f7; font-size: 10px; }
.history-status.status-running, .history-status.status-scanning { color: #1d4ed8; background: #edf3ff; }
.history-status.status-paused { color: #a16207; background: #fff7e6; }
.history-status.status-completed { color: #047857; background: #eafaf4; }
.history-status.status-failed { color: #b91c1c; background: #fff1f1; }
.history-card-meta { gap: 12px; margin-top: 10px; color: #8a96a3; font-size: 10px; }
.history-card-meta span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.history-card-meta .el-icon { width: 12px; }
.history-card-id { margin-left: auto; color: #a4adb6; font-family: monospace; }
.history-card-progress { margin-top: 11px; }
.history-card-progress-head { justify-content: space-between; margin-bottom: 5px; color: #9aa5af; font-size: 10px; }
.history-card-progress-head strong { color: #4a5966; font-weight: 600; }
.history-card-foot { gap: 11px; margin-top: 9px; color: #6e7a86; font-size: 10px; }
.history-card-foot .el-icon { margin-left: auto; color: #a7b1ba; }
.history-empty { min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #9ba5ae; font-size: 12px; }
.history-empty .el-icon { color: #c4cdd5; font-size: 24px; }
@media (max-width: 1100px) {
  .workspace-grid { grid-template-columns: 232px minmax(0, 1fr); }
}
@media (max-width: 780px) {
  .asset-discovery-view { padding: 16px 12px 20px; }
  .page-head { flex-direction: column; gap: 14px; }
  .head-actions { width: 100%; }
  .head-actions .el-button:not(.is-circle) { flex: 1; }
  .workspace-grid { display: flex; flex-direction: column; }
  .task-rail { flex: 0 0 290px; }
  .task-scroll { max-height: 245px; }
  .results-area { min-height: 560px; }
  .stage-track { padding-left: 15px; padding-right: 15px; overflow-x: auto; }
  .stage-node { min-width: 145px; }
}
@media (max-width: 640px) {
  :deep(.scan-composer-dialog.el-dialog) { width: calc(100vw - 20px); margin-top: 2vh; }
  :deep(.scan-composer-dialog .el-dialog__body) { height: 88vh; }
}
</style>
