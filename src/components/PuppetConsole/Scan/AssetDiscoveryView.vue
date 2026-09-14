<template>
  <div class="asset-discovery-view">
    <header class="page-head">
      <div class="task-selector">
        <div class="selector-label">
          <span class="selector-caption">当前扫描</span>
          <span class="selector-count">{{ tasks.length }} 个任务</span>
        </div>
        <el-select
          v-model="selectedTaskId"
          class="task-select"
          filterable
          placeholder="选择一个扫描任务"
          no-data-text="暂无扫描任务"
          @change="selectTask"
        >
          <el-option v-for="task in historyTasks" :key="getTaskId(task)" :label="task.name || task.targetLabel || '未命名扫描'" :value="getTaskId(task)">
            <div class="task-option">
              <span class="task-option-name">{{ task.name || task.targetLabel || '未命名扫描' }}</span>
              <span class="task-option-meta">{{ getStatusText(task.status, task.outcome) }} · {{ formatCount(getMetrics(task).targetTotal) }} 个目标</span>
            </div>
          </el-option>
        </el-select>
        <div v-if="activeTask" class="selector-task-meta">
          <span class="status-mark" :class="statusClass(activeTask.status, activeTask.outcome)" />
          <span>{{ getStatusText(activeTask.status, activeTask.outcome) }}</span>
          <span class="meta-divider" />
          <span>{{ shortTaskId(activeBackendTaskId) }}</span>
        </div>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="historyLoading" @click="syncTasks">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="showComposer = true">新建扫描</el-button>
      </div>
    </header>

    <main v-if="activeTask" class="discovery-content">
      <section class="progress-card">
        <div class="progress-card-head">
          <div class="progress-card-info">
            <p class="task-subtitle">{{ formatCount(metrics.targetTotal) }} 个目标 · {{ portPolicyLabel(activeTask) }} · {{ elapsedText }}</p>
            <span v-if="isRunning(activeTask)" class="throughput">{{ throughputText }}</span>
          </div>
          <div v-if="isRunning(activeTask) || isPaused(activeTask)" class="progress-actions">
            <el-button v-if="isRunning(activeTask)" size="small" :icon="VideoPause" @click="pauseActiveTask">暂停</el-button>
            <el-button v-if="isPaused(activeTask)" size="small" :icon="VideoPlay" @click="resumeActiveTask">继续</el-button>
            <el-button size="small" type="danger" plain :icon="Close" @click="stopActiveTask">停止</el-button>
          </div>
        </div>

        <div class="progress-card-body">
          <div class="stage-track">
            <div v-for="(stage, index) in stageDefinitions" :key="stage.name" class="stage-node" :class="stageClass(stage.name)">
              <div class="stage-node-marker"><el-icon v-if="stageIsComplete(stage.name)"><Check /></el-icon><span v-else>{{ index + 1 }}</span></div>
              <div class="stage-node-copy"><strong>{{ stage.label }}</strong><span>{{ stageStatusText(stage.name) }}</span></div>
            </div>
          </div>
          <div class="progress-line">
            <span class="progress-line-label">整体进度</span>
            <el-progress :percentage="clampProgress(activeTask.progress)" :show-text="false" :stroke-width="5" :status="getProgressStatus(activeTask)" :aria-label="`整体进度 · ${currentStageLabel}`" />
            <strong>{{ Math.round(clampProgress(activeTask.progress)) }}%</strong>
          </div>
        </div>
      </section>

      <section class="hosts-strip">
        <div class="hosts-heading"><strong>存活主机</strong><b>{{ formatCount(metrics.reachableHostCount) }}</b></div>
        <div v-if="visibleReachableHosts.length" class="host-list">
          <span v-for="host in visibleReachableHosts" :key="host" class="host-chip">{{ host }}</span>
          <span v-if="reachableHostOverflow > 0" class="host-more">+{{ formatCount(reachableHostOverflow) }} 个</span>
        </div>
        <span v-else class="stage-output-empty">探活完成后将在这里显示存活主机</span>
      </section>

      <AssetResultTable :task-id="activeBackendTaskId" :session-id="sessionId" :refresh-token="resultRefreshToken" />
    </main>

    <section v-else class="page-empty">
      <div class="empty-icon"><DataAnalysis /></div>
      <h2>开始发现网络资产</h2>
      <p>配置目标和端口策略后，系统会依次完成主机探活、端口扫描和服务识别。</p>
      <el-button type="primary" :icon="Plus" @click="showComposer = true">新建扫描</el-button>
      <div class="empty-notes"><span><el-icon><Check /></el-icon>主机是否可达</span><span><el-icon><Check /></el-icon>开放端口和服务</span></div>
    </section>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Check, Close, DataAnalysis, Plus, Refresh, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AssetResultTable from './AssetResultTable.vue'
import ScanComposer from './ScanComposer.vue'
import { taskEngine } from '../File/TaskEngine.js'
import { TaskStatus, TaskType } from '@/constants/task.js'

const props = defineProps({ sessionId: { type: String, required: true } })
const tasks = ref([])
const selectedTaskId = ref(null)
const showComposer = ref(false)
const historyLoading = ref(false)
const resultRefreshToken = ref(0)
const stageDefinitions = [
  { name: 'REACHABILITY', label: '主机探活' },
  { name: 'PORT_SCAN', label: '端口扫描' },
  { name: 'SERVICE_PROBE', label: '服务识别' }
]

const activeTask = computed(() => tasks.value.find(task => getTaskId(task) === selectedTaskId.value) || null)
const activeBackendTaskId = computed(() => {
  const task = activeTask.value
  return task?.backendTaskId || task?.serverTaskId || task?.taskId || task?.result?.taskId || selectedTaskId.value
})
const metrics = computed(() => getMetrics(activeTask.value))
const currentStageLabel = computed(() => {
  const outcome = normalizedOutcome(activeTask.value?.status, activeTask.value?.outcome)
  if (outcome === 'COMPLETED') return '已完成'
  if (outcome === 'FAILED') return '扫描失败'
  return stageDefinitions.find(stage => stage.name === activeTask.value?.currentStage)?.label || '准备扫描'
})
const throughputText = computed(() => {
  const task = activeTask.value
  const value = Number(task?.speed ?? task?.scanSpeed ?? task?.metrics?.speed ?? 0)
  if (Number.isFinite(value) && value > 0) return `${formatCount(Math.round(value))} 目标/秒`
  const startedAt = timestampValue(task?.startTime)
  const processed = metrics.value.processed
  const outcome = normalizedOutcome(task?.status, task?.outcome)
  if (outcome === 'COMPLETED') return '扫描已完成'
  if (outcome === 'FAILED' || outcome === 'CANCELLED') return '扫描已结束'
  if (!startedAt || processed <= 0) return '等待数据'
  const elapsed = Math.max(1, (Date.now() - startedAt) / 1000)
  return `${formatCount(Math.round(processed / elapsed))} 目标/秒`
})
const elapsedText = computed(() => {
  const task = activeTask.value
  const startedAt = timestampValue(task?.startTime || task?.createdAt)
  if (!startedAt) return '-'
  const endedAt = timestampValue(task?.endTime) || Date.now()
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} 分 ${seconds % 60} 秒`
})
const visibleReachableHosts = computed(() => Array.isArray(activeTask.value?.reachableHostList)
  ? activeTask.value.reachableHostList.slice(0, 160)
  : [])
const reachableHostOverflow = computed(() => Math.max(0,
  getMetrics(activeTask.value).reachableHostCount - visibleReachableHosts.value.length))
const historyTasks = computed(() => [...tasks.value].sort((left, right) => timestampValue(right.createdAt || right.createdTime) - timestampValue(left.createdAt || left.createdTime)))
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
function handleScanStarted(task) {
  const backendTaskId = task?.taskId || task?.result?.taskId
  if (!backendTaskId) { ElMessage.error('启动响应缺少任务编号'); return }
  const scan = task.scan || {}
  const targetItems = scan.targets?.items || []
  const taskId = taskEngine.createScanTask(props.sessionId, 'network_workflow', scan.name || '网络资产发现', 4, { backendTaskId, targetCount: targetItems.length, scanHosts: targetItems, scanPorts: scan.portPolicy?.include || [] })
  taskEngine.hydrateScanTask(taskId, { taskId: backendTaskId, scanKind: 'network_workflow', status: 'RUNNING', outcome: 'RUNNING', targetLabel: scan.name || '网络资产发现', targetCount: targetItems.length, hosts: targetItems, currentStage: 'REACHABILITY', stageCount: 4, completedStageCount: 0, progress: 0 })
  selectedTaskId.value = taskId
  showComposer.value = false
  startRefreshTimer()
  refreshTaskList()
  ElMessage.success('扫描已启动')
}
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
function getMetrics(task) {
  const targetTotal = Number(task?.targetCount || task?.metrics?.targetTotal || task?.totalCount || 0)
  const rawProcessed = Number(task?.processedCount ?? task?.scannedCount ?? task?.metrics?.processed ?? 0)
  const progress = Number(task?.progress || 0)
  const processed = rawProcessed > 0 || progress < 100 ? rawProcessed : targetTotal
  return {
    targetTotal,
    processed: Math.max(0, processed),
    reachableHostCount: Number(task?.reachableHostCount ?? task?.reachableHostList?.length ?? task?.metrics?.reachableHostCount ?? 0),
    openCount: Number(task?.openCount ?? (Array.isArray(task?.openPortResults) ? task.openPortResults.length : 0)),
    serviceCount: Number(task?.serviceCount ?? (Array.isArray(task?.serviceResults) ? task.serviceResults.length : 0)),
    errorCount: Number(task?.errorCount ?? (Array.isArray(task?.errors) ? task.errors.length : task?.error ? 1 : 0))
  }
}
function portPolicyLabel(task) {
  const ports = Array.isArray(task?.scanPorts) ? task.scanPorts.length : 0
  if (ports) return `${formatCount(ports)} 个端口`
  return task?.options?.portPolicy?.profile || task?.portPolicy?.profile || '预设策略'
}
function getProgressStatus(task) { if (!task) return undefined; if (String(task.status || '').toUpperCase() === 'FAILED') return 'exception'; if (isPaused(task)) return 'warning'; return undefined }
function clampProgress(value) { const number = Number(value || 0); return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0 }
function formatCount(value) { return Number(value || 0).toLocaleString('zh-CN') }
function shortTaskId(value) { const text = String(value || ''); return text ? `#${text.slice(0, 8)}` : '未连接任务' }
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
    const previousSelectedTask = tasks.value.find(task => getTaskId(task) === selectedTaskId.value)
    await taskEngine.syncNetworkWorkflowTasks(props.sessionId)
    const currentTasks = taskEngine.getTasksBySession(props.sessionId).filter(task => task.type === TaskType.SCAN && task.scanKind === 'network_workflow')
    const selectedTask = currentTasks.find(task => getTaskId(task) === selectedTaskId.value)
    const selectedWasActive = (previousSelectedTask && !isTerminalTask(previousSelectedTask)) || (selectedTask && !isTerminalTask(selectedTask))
    const activeTasks = currentTasks.filter(task => !isTerminalTask(task))
    await Promise.allSettled(activeTasks.map(task => taskEngine.queryScanTask(task)))
    if (selectedWasActive) resultRefreshToken.value += 1
    if (activeTasks.length === 0) stopRefreshTimer()
  } catch (error) {
    if (!tasks.value.length) ElMessage.error(`加载扫描任务失败: ${error.message || '未知错误'}`)
  }
  refreshTaskList()
  historyLoading.value = false
}
function startRefreshTimer() {
  if (refreshTimer) return
  refreshTimer = window.setInterval(syncTasks, 2000)
}
function stopRefreshTimer() {
  if (!refreshTimer) return
  window.clearInterval(refreshTimer)
  refreshTimer = null
}
onMounted(() => { taskEvents.forEach(event => taskEngine.on(event, refreshTaskList)); void syncTasks(); startRefreshTimer() })
onUnmounted(() => { taskEvents.forEach(event => taskEngine.off(event, refreshTaskList)); stopRefreshTimer() })
</script>

<style scoped lang="scss">
.asset-discovery-view {
  --ink: #1f2937;
  --muted: #6b7280;
  --subtle: #9ca3af;
  --line: #e5e7eb;
  --canvas: #f6f7f9;
  --surface: #ffffff;
  --blue: #2563eb;
  height: 100%;
  min-height: 0;
  padding: 16px 20px 24px;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
  color: var(--ink);
  background: var(--canvas);
}

.page-head,
.task-selector,
.progress-card,
.hosts-strip,
:deep(.asset-result-table) {
  border: 1px solid var(--line);
  background: var(--surface);
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 8px;
  border-width: 0 0 1px;
  background: transparent;
}

.page-head .task-selector {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

h2,
p {
  margin: 0;
}

.head-actions,
.progress-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-selector {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 54px;
  margin-top: 10px;
  padding: 8px 14px;
  border-radius: 6px;
}

.selector-label {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  gap: 3px;
}

.selector-caption {
  font-size: 13px;
  font-weight: 650;
}

.selector-count,
.selector-hint,
.selector-task-meta,
.task-option-meta {
  color: var(--muted);
  font-size: 12px;
}

.task-select {
  width: min(360px, 38vw);
}

.task-option {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.task-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-option-meta {
  flex: 0 0 auto;
  font-size: 11px;
}

.selector-task-meta {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-mark {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9ca3af;
}

.status-mark.status-running,
.status-mark.status-scanning {
  background: var(--blue);
}

.status-mark.status-paused {
  background: #d97706;
}

.status-mark.status-completed {
  background: #059669;
}

.status-mark.status-failed {
  background: #dc2626;
}

.meta-divider {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: var(--line);
}

.discovery-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.progress-card {
  padding: 10px 14px;
  border-radius: 6px;
}

.progress-card-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
}

.progress-card-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  gap: 6px 12px;
}

.progress-actions {
  flex: 0 0 auto;
}

.task-subtitle {
  color: var(--muted);
  font-size: 12px;
}

.progress-card-body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin-top: 8px;
}

.stage-track {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.stage-node {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.stage-node-marker {
  display: grid;
  flex: 0 0 18px;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1px solid #d8dde3;
  border-radius: 50%;
  color: #9ca3af;
  background: #fff;
  font-size: 10px;
}

.stage-node.current .stage-node-marker {
  border-color: var(--blue);
  color: #fff;
  background: var(--blue);
  box-shadow: 0 0 0 4px #eaf1ff;
}

.stage-node.complete .stage-node-marker {
  border-color: #54b8a7;
  color: #fff;
  background: #15947f;
}

.stage-node.failed .stage-node-marker {
  border-color: #f3a7a7;
  color: #b91c1c;
  background: #fff1f1;
}

.stage-node-copy {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 6px;
}

.stage-node-copy strong,
.stage-node-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-node-copy strong {
  color: #374151;
  font-size: 12px;
}

.stage-node-copy span {
  color: var(--subtle);
  font-size: 11px;
}

.progress-line {
  display: flex;
  flex: 1 1 200px;
  max-width: 280px;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.progress-line-label {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.progress-line strong {
  color: var(--blue);
  font-size: 12px;
}

.progress-line :deep(.el-progress) {
  flex: 1;
  min-width: 0;
}

.throughput {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.hosts-strip {
  padding: 10px 14px;
  border-radius: 6px;
}

.hosts-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hosts-heading > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.hosts-heading strong {
  font-size: 13px;
}

.hosts-heading span {
  color: var(--muted);
  font-size: 11px;
}

.hosts-heading b {
  color: #374151;
  font-size: 16px;
  font-weight: 650;
}

.host-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 66px;
  margin-top: 7px;
  overflow: auto;
}

.host-chip,
.host-more {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  border: 1px solid #d8e5f8;
  border-radius: 4px;
  color: #315d9c;
  background: #f5f8fe;
  font-family: monospace;
  font-size: 10px;
}

.host-more {
  border-color: var(--line);
  color: var(--muted);
  background: #fafafa;
}

.stage-output-empty {
  display: block;
  margin-top: 9px;
  color: var(--subtle);
  font-size: 11px;
}

.page-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 430px;
  margin-top: 14px;
  padding: 72px 24px 54px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid #c9d9f4;
  border-radius: 50%;
  color: var(--blue);
  background: #f1f6ff;
}

.empty-icon svg {
  width: 25px;
  height: 25px;
}

.page-empty h2 {
  margin-top: 18px;
  font-size: 18px;
  font-weight: 650;
}

.page-empty p {
  max-width: 430px;
  margin: 9px 0 20px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.empty-notes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18px;
  margin-top: 28px;
  color: var(--muted);
  font-size: 11px;
}

.empty-notes span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.empty-notes .el-icon {
  color: #059669;
}

:deep(.asset-result-table) {
  height: auto;
  min-height: 410px;
  overflow: visible;
  border-radius: 6px;
}

:deep(.asset-result-table .table-wrap) {
  flex: none;
  min-height: 0;
  overflow: visible;
}

:deep(.scan-composer-dialog.el-dialog) {
  width: min(960px, calc(100vw - 32px));
  margin: 5vh auto 0;
  overflow: hidden;
  border-radius: 8px;
}

:deep(.scan-composer-dialog .el-dialog__header) {
  margin: 0;
  padding: 20px 28px 12px;
  border-bottom: 1px solid var(--line);
}

:deep(.scan-composer-dialog .el-dialog__title) {
  color: var(--ink);
  font-size: 18px;
  font-weight: 650;
}

:deep(.scan-composer-dialog .el-dialog__body) {
  height: min(600px, 76vh);
  padding: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .asset-discovery-view {
    padding: 20px 18px 28px;
  }

}

@media (max-width: 680px) {
  .asset-discovery-view {
    padding: 16px 12px 22px;
  }

  .page-head,
  .progress-card-head,
  .task-selector {
    align-items: stretch;
    flex-direction: column;
  }

  .page-head {
    gap: 16px;
  }

  .head-actions {
    width: 100%;
  }

  .head-actions .el-button {
    flex: 1;
  }

  .task-selector {
    gap: 9px;
  }

  .task-select {
    width: 100%;
  }

  .selector-task-meta {
    padding-top: 3px;
  }

  .progress-card {
    padding: 10px 12px;
  }

  .progress-line {
    flex-basis: 100%;
    max-width: none;
  }

  .empty-notes {
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  :deep(.scan-composer-dialog.el-dialog) {
    width: calc(100vw - 20px);
    margin-top: 2vh;
  }

  :deep(.scan-composer-dialog .el-dialog__body) {
    height: 88vh;
  }
}
</style>
