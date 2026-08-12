<template>
  <div class="scan-workbench">
    <div class="scan-shell">
      <!-- 顶部横向 tab 条 -->
      <nav class="scan-tab-bar">
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'host-reachability' }"
          @click="activeTab = 'host-reachability'"
        >
          <el-icon><Icon :icon="iconMap.connection" /></el-icon>
          主机探活
          <span
            v-if="hostReachabilityTasks.length > 0"
            class="tab-badge"
          >{{ hostReachabilityTasks.length }}</span>
        </button>
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'port-scan' }"
          @click="activeTab = 'port-scan'"
        >
          <el-icon><Icon :icon="iconMap.scan" /></el-icon>
          端口扫描
          <span
            v-if="portScanActiveBadge > 0"
            class="tab-badge tab-badge--active"
          >{{ portScanActiveBadge }}</span>
        </button>
        <div class="tab-sep" />
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'fingerprint-tcp' }"
          @click="activeTab = 'fingerprint-tcp'"
        >
          <el-icon><Icon :icon="iconMap.fingerprint" /></el-icon>
          TCP 指纹
        </button>
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'fingerprint-http' }"
          @click="activeTab = 'fingerprint-http'"
        >
          <el-icon><Icon :icon="iconMap.fingerprint" /></el-icon>
          HTTP 指纹
        </button>
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'fingerprint-recon' }"
          @click="activeTab = 'fingerprint-recon'"
        >
          <el-icon><Icon :icon="iconMap.search" /></el-icon>
          侦察扫描
        </button>
        <div class="tab-sep" />
        <button
          type="button"
          class="tab-item"
          :class="{ active: activeTab === 'all' }"
          @click="activeTab = 'all'"
        >
          <el-icon><Icon :icon="iconMap.list" /></el-icon>
          全部任务
          <span
            v-if="allActiveBadge > 0"
            class="tab-badge tab-badge--active"
          >{{ allActiveBadge }}</span>
        </button>
      </nav>

      <!-- 内容区 -->
      <section class="scan-main">
        <!-- 主机探活 -->
        <div
          v-if="activeTab === 'host-reachability'"
          class="workspace-grid workspace-grid--host"
        >
          <section class="workspace-pane workspace-pane--config workspace-pane--host-config">
            <header class="pane-header">
              <div>
                <strong>探活配置</strong>
                <span>批量检测 IP、网段或域名的可达性</span>
              </div>
              <span class="pane-step">01</span>
            </header>
            <div class="pane-body">
              <HostReachabilityConfig
                :is-scanning="isHostScanning"
                @scan="handleHostScan"
              />
            </div>
          </section>
          <section class="workspace-pane">
            <header class="pane-header">
              <div>
                <strong>探活任务</strong>
                <span>查看可达主机与执行结果</span>
              </div>
              <span class="pane-step">02</span>
            </header>
            <div class="pane-body">
              <HostReachabilityTaskList
                :tasks="hostReachabilityTasks"
                @remove="removeHostTask"
                @batch-remove="handleBatchRemoveHostTasks"
                @batch-scan="handleBatchPortScan"
              />
            </div>
          </section>
        </div>

        <!-- 端口扫描 -->
        <div
          v-else-if="activeTab === 'port-scan'"
          class="workspace-grid workspace-grid--stacked"
        >
          <section class="workspace-pane workspace-pane--config">
            <header class="pane-header">
              <div>
                <strong>扫描配置</strong>
                <span>设置目标、端口范围和并发参数</span>
              </div>
              <span class="pane-step">01</span>
            </header>
            <div class="pane-body">
              <ScanConfigForm
                :is-starting="isStarting"
                @start-scan="handleStartScan"
              />
            </div>
          </section>
          <section class="workspace-pane">
            <header class="pane-header">
              <div>
                <strong>扫描任务</strong>
                <span>跟踪进度并继续进行指纹识别</span>
              </div>
              <span class="pane-step">02</span>
            </header>
            <div class="pane-body">
              <ScanTaskList
                :tasks="scanTasks"
                :is-refreshing="isRefreshing"
                @refresh="refreshAllTasks"
                @query="queryTaskResult"
                @remove="removeTask"
                @batch-remove="handleBatchRemove"
                @pause="handlePauseTask"
                @resume="handleResumeTask"
                @stop="handleStopTask"
                @batch-tcp-fingerprint="handleBatchTcpFingerprint"
              />
            </div>
          </section>
        </div>

        <!-- 指纹识别（三个子页共用一个容器，v-show 保持组件存活） -->
        <div
          v-show="activeTab === 'fingerprint-tcp' || activeTab === 'fingerprint-http' || activeTab === 'fingerprint-recon'"
          class="workspace-grid workspace-grid-single workspace-grid--embedded"
        >
          <section class="workspace-pane workspace-pane--embedded">
            <div class="pane-body pane-body--flush">
              <TcpFingerprintScan
                v-show="activeTab === 'fingerprint-tcp'"
                ref="tcpScanRef"
                :session-id="sessionId"
                :initial-targets="initialTcpTargetsFromPortScan"
                @initial-targets-applied="clearInitialTcpTargets"
              />
              <HttpFingerprintScan
                v-show="activeTab === 'fingerprint-http'"
                ref="httpScanRef"
                :session-id="sessionId"
              />
              <ReconScan
                v-show="activeTab === 'fingerprint-recon'"
                ref="reconScanRef"
                :session-id="sessionId"
              />
            </div>
          </section>
        </div>

        <!-- 全部任务 -->
        <div
          v-show="activeTab === 'all'"
          class="workspace-grid workspace-grid-single"
        >
          <section class="workspace-pane">
            <header class="pane-header">
              <div>
                <strong>全部扫描任务</strong>
                <span>集中查看端口、指纹和侦察任务</span>
              </div>
            </header>
            <div class="pane-body">
              <AllTaskList
                :all-tasks="allTasksMerged"
                @pause="handleAllDispatch('pause', $event)"
                @resume="handleAllDispatch('resume', $event)"
                @stop="handleAllDispatch('stop', $event)"
                @remove="handleAllDispatch('remove', $event)"
                @query="handleAllDispatch('query', $event)"
              />
            </div>
          </section>
        </div>
      </section>

      <BatchPortScanDialog
        v-model="batchScanDialogVisible"
        :selected-hosts="batchScanSelectedHosts"
        @confirm="handleBatchScanConfirm"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, toRef, watch } from 'vue'

import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { scanHostReachabilityApi } from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { taskEngine } from '../File/TaskEngine.js'
import { usePortScanTasks } from '@/composables/usePortScanTasks.js'
import {
  countActiveScanTasks,
  HOST_REACHABILITY_KIND,
  mergeScanTasks,
  normalizeHostReachabilityResult
} from './portScanModel.js'
import BatchPortScanDialog from './BatchPortScanDialog.vue'
import HostReachabilityConfig from './HostReachabilityConfig.vue'
import HostReachabilityTaskList from './HostReachabilityTaskList.vue'
import HttpFingerprintScan from './HttpFingerprintScan.vue'
import ScanConfigForm from './ScanConfigForm.vue'
import ScanTaskList from './ScanTaskList.vue'
import TcpFingerprintScan from './TcpFingerprintScan.vue'
import ReconScan from './ReconScan.vue'
import AllTaskList from './AllTaskList.vue'
import { showSuccess } from '@/utils/messageUtils.js'
import '@/styles/scan-config-shared.css'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const activeTab = ref('host-reachability')
const hostReachabilityTasks = ref([])
const isHostScanning = ref(false)
const batchScanDialogVisible = ref(false)
const batchScanSelectedHosts = ref([])
const initialTcpTargetsFromPortScan = ref([])

// Template refs for keep-alive'd fingerprint/recon components
const tcpScanRef = ref(null)
const httpScanRef = ref(null)
const reconScanRef = ref(null)
const sessionIdRef = toRef(props, 'sessionId')

const {
  tasks: scanTasks,
  isStarting,
  isRefreshing,
  start: handleStartScan,
  startBatch,
  queryResult: queryTaskResult,
  refresh: refreshAllTasks,
  remove: removeTask,
  batchRemove: batchRemovePortTasks,
  pause: handlePauseTask,
  resume: handleResumeTask,
  stop: handleStopTask
} = usePortScanTasks(sessionIdRef)

// Merged task list for the "全部" view — sorted newest first
const allTasksMerged = computed(() => mergeScanTasks({
  port: scanTasks.value,
  tcp: tcpScanRef.value?.tasks,
  http: httpScanRef.value?.tasks,
  recon: reconScanRef.value?.tasks
}))

// badge: 端口扫描活跃任务数
const portScanActiveBadge = computed(() => countActiveScanTasks(scanTasks.value))

// badge: 所有活跃任务数（用于"全部任务"tab）
const allActiveBadge = computed(() => countActiveScanTasks(allTasksMerged.value))

// Dispatch actions for the "全部" aggregated view
const handleAllDispatch = (action, { taskId, kind }) => {
  if (kind === 'port_scan') {
    if (action === 'pause') handlePauseTask(taskId)
    else if (action === 'resume') handleResumeTask(taskId)
    else if (action === 'stop') handleStopTask(taskId)
    else if (action === 'remove') removeTask(taskId)
    else if (action === 'query') queryTaskResult(taskId)
  } else if (kind === 'fingerprint_tcp') {
    const ref = tcpScanRef.value
    if (ref) ref[action === 'query' ? 'queryResult' : action]?.(taskId)
  } else if (kind === 'fingerprint_http') {
    const ref = httpScanRef.value
    if (ref) ref[action === 'query' ? 'queryResult' : action]?.(taskId)
  } else if (kind === 'recon_scan') {
    const ref = reconScanRef.value
    if (ref) ref[action === 'query' ? 'queryResult' : action]?.(taskId)
  }
}

let hostTaskIdCounter = 0
let hostScanSequence = 0

const createHostReachabilityCenterTask = (task) => {
  task.taskCenterId = taskEngine.createScanTask(
    props.sessionId,
    HOST_REACHABILITY_KIND,
    `${task.scanHosts.length} 个主机`,
    task.scanHosts.length,
    {
      scanHosts: task.scanHosts,
      scanTimeout: task.scanTimeout,
      canControl: false,
      fileName: `主机探活 · ${task.scanHosts.length} 个主机`
    }
  )
  syncHostReachabilityTaskToCenter(task)
}

const syncHostReachabilityTaskToCenter = (task, { failed = false, error = '' } = {}) => {
  if (!task?.taskCenterId) return

  const result = task.result || {}
  const totalCount = Number(result.totalCount || task.scanHosts?.length || 0)
  const reachableCount = Number(result.reachableCount || 0)
  const unreachableCount = Number(
    result.unreachableCount ?? Math.max(0, totalCount - reachableCount)
  )

  taskEngine.hydrateScanTask(task.taskCenterId, {
    status: failed ? 'FAILED' : task.status ? 'COMPLETED' : 'RUNNING',
    scanKind: HOST_REACHABILITY_KIND,
    targetLabel: `${task.scanHosts?.length || 0} 个主机`,
    scanHosts: task.scanHosts || [],
    totalCount,
    processedCount: task.status ? totalCount : 0,
    progress: task.status ? 100 : 0,
    hitCount: reachableCount,
    missCount: unreachableCount,
    reachableHostList: result.reachableHostList || [],
    unreachableHostList: result.unreachableHostList || [],
    resultSummary: task.status
      ? `可达 ${reachableCount} / 不可达 ${unreachableCount}`
      : '正在检测主机可达性',
    startTime: task.createTime,
    createdTime: task.createTime,
    createTime: task.createTime,
    endTime: task.status || failed ? Date.now() : null,
    error,
    canControl: false,
    options: {
      scanTimeout: task.scanTimeout
    }
  })
}

const handleBatchTcpFingerprint = (targets) => {
  if (!targets?.length) return
  initialTcpTargetsFromPortScan.value = targets
  activeTab.value = 'fingerprint-tcp'
}

const clearInitialTcpTargets = () => {
  initialTcpTargetsFromPortScan.value = []
}

const handleBatchRemove = taskIds => batchRemovePortTasks(taskIds, { notify: false })

const handleHostScan = async (config) => {
  if (isHostScanning.value) return
  const sessionId = props.sessionId
  const sequence = ++hostScanSequence
  const taskId = `host-reachability-${Date.now()}-${++hostTaskIdCounter}`
  const newTask = {
    taskId,
    scanHosts: config.scanHosts || [],
    scanTimeout: config.scanTimeout || 3000,
    status: false,
    result: null,
    createTime: Date.now(),
    showReachable: true,
    showUnreachable: false
  }

  hostReachabilityTasks.value.unshift(newTask)
  createHostReachabilityCenterTask(newTask)
  isHostScanning.value = true

  try {
    const response = await executeRequest(
      () =>
        scanHostReachabilityApi({
          sessionId,
          ...config
        }),
      {
        loadingRef: null,
        successMessage: '主机探活完成',
        errorMessage: '主机探活失败'
      }
    )

    if (sequence !== hostScanSequence || sessionId !== props.sessionId) return
    const task = hostReachabilityTasks.value.find((item) => item.taskId === taskId)
    if (task && response?.data) {
      task.status = true
      task.result = normalizeHostReachabilityResult(response.data, task.scanHosts.length)
      syncHostReachabilityTaskToCenter(task)
    }
  } catch {
    if (sequence !== hostScanSequence || sessionId !== props.sessionId) return
    const task = hostReachabilityTasks.value.find(item => item === newTask)
    if (!task) return
    task.status = true
    task.result = normalizeHostReachabilityResult({
      unreachableHostList: task.scanHosts,
      unreachableCount: task.scanHosts.length
    }, task.scanHosts.length)
    syncHostReachabilityTaskToCenter(task, {
      failed: true,
      error: '主机探活失败'
    })
  } finally {
    if (sequence === hostScanSequence) isHostScanning.value = false
  }
}

const removeHostTask = async (taskId) => {
  const confirmed = await confirmAction({
    title: '确认删除',
    message: '确定要删除这个探活任务吗？'
  })
  if (!confirmed) return

  const index = hostReachabilityTasks.value.findIndex((task) => task.taskId === taskId)
  if (index > -1) {
    hostReachabilityTasks.value.splice(index, 1)
    showSuccess('任务已删除')
  }
}

const handleBatchRemoveHostTasks = (taskIds) => {
  if (!taskIds?.length) return
  taskIds.forEach((taskId) => {
    const index = hostReachabilityTasks.value.findIndex((task) => task.taskId === taskId)
    if (index > -1) {
      hostReachabilityTasks.value.splice(index, 1)
    }
  })
}

const handleBatchPortScan = (hosts) => {
  batchScanSelectedHosts.value = hosts
  batchScanDialogVisible.value = true
}

const handleBatchScanConfirm = async config => {
  const result = await startBatch(config)
  if (result.successCount > 0) activeTab.value = 'port-scan'
}

watch(
  () => props.sessionId,
  () => {
    hostScanSequence += 1
    hostReachabilityTasks.value = []
    isHostScanning.value = false
    batchScanDialogVisible.value = false
    batchScanSelectedHosts.value = []
    initialTcpTargetsFromPortScan.value = []
  }
)
</script>

<style scoped>
.scan-workbench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.scan-shell {
  --scan-surface: var(--app-card-background);
  --scan-soft-surface: var(--app-control-background-soft);
  --scan-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

/* 顶部 tab 条 */
.scan-tab-bar {
  display: flex;
  align-items: center;
  gap: 1px;
  min-height: 42px;
  padding: 4px 8px;
  background: var(--scan-soft-surface);
  border: 0;
  border-bottom: 1px solid var(--scan-border);
  border-radius: 0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.tab-sep {
  width: 1px;
  height: 18px;
  background: var(--scan-border);
  margin: 0 4px;
  flex-shrink: 0;
}

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 5px 10px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.tab-item:hover {
  background: color-mix(in srgb, var(--el-border-color) 10%, transparent);
  color: var(--el-text-color-primary);
}

.tab-item.active {
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--scan-surface));
  color: var(--el-color-primary);
  box-shadow: none;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: -5px;
  left: 10px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--el-color-primary);
}

.tab-item .el-icon {
  font-size: 14px;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--el-border-color) 18%, transparent);
  color: var(--el-text-color-secondary);
  line-height: 1;
}

.tab-badge--active {
  background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  color: var(--el-color-primary);
}

/* 内容区 */
.scan-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 0 0;
  background: var(--app-page-background);
}

.workspace-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 0.82fr) minmax(0, 1.18fr);
  gap: 0;
}

.workspace-grid-single {
  grid-template-columns: 1fr;
}

.workspace-grid--host {
  grid-template-columns: minmax(400px, 0.82fr) minmax(0, 1.18fr);
  grid-template-rows: minmax(0, 1fr);
}

.workspace-grid--stacked {
  grid-template-columns: minmax(400px, 0.82fr) minmax(0, 1.18fr);
  grid-template-rows: minmax(0, 1fr);
}

.workspace-grid--host .workspace-pane + .workspace-pane,
.workspace-grid--stacked .workspace-pane + .workspace-pane {
  border-top: 0;
  border-left: 1px solid var(--scan-border);
}

.workspace-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border: 0;
  background: var(--scan-surface);
  overflow: hidden;
}

.workspace-pane + .workspace-pane {
  border-left: 1px solid var(--scan-border);
}

.workspace-pane--config {
  align-self: stretch;
  height: 100%;
  max-height: none;
  border-bottom: 1px solid var(--scan-border);
}

.workspace-pane--config .pane-body {
  background: var(--app-page-background);
}

.workspace-pane:not(.workspace-pane--config) > .pane-body {
  background: var(--app-page-background);
}

.pane-header {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--scan-border);
  background: color-mix(in srgb, var(--scan-soft-surface) 72%, var(--scan-surface));
}

.pane-header > div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pane-header strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 650;
}

.pane-header span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.pane-step {
  flex-shrink: 0;
  font-family: var(--app-font-mono, monospace);
  color: color-mix(in srgb, var(--el-color-primary) 60%, var(--el-text-color-placeholder)) !important;
  font-size: 12px !important;
  font-weight: 700;
}

.pane-body {
  flex: 1;
  min-height: 0;
  padding: 10px 12px;
  overflow: auto;
}

.pane-body--flush {
  padding: 0;
  overflow: hidden;
}

.workspace-pane--embedded {
  background: transparent;
}

@media (max-width: 1100px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .workspace-grid--host,
  .workspace-grid--stacked {
    grid-template-rows: auto auto;
  }

  .workspace-grid--host .workspace-pane + .workspace-pane,
  .workspace-grid--stacked .workspace-pane + .workspace-pane {
    border-top: 1px solid var(--scan-border);
    border-left: 0;
  }
}

@media (max-width: 768px) {
  .workspace-pane--config {
    height: auto;
  }

  .scan-shell {
    padding: 4px;
  }
  .tab-item {
    padding: 6px 9px;
    font-size: 12px;
  }
}
</style>
