<template>
  <div class="scan-workbench">
    <div class="scan-shell">
      <header class="scan-toolbar">
        <div class="scan-heading">
          <span class="scan-heading__icon">
            <Icon :icon="iconMap.scan" />
          </span>
          <div>
            <h2>扫描与探测</h2>
            <span>{{ activePageMeta.label }}</span>
          </div>
        </div>

        <nav
          class="scan-tab-bar"
          aria-label="扫描工具"
        >
          <div
            v-for="group in scanTabGroups"
            :key="group.label"
            class="tab-group"
          >
            <span class="tab-group__label">{{ group.label }}</span>
            <div class="tab-group__items">
              <button
                v-for="tab in group.items"
                :key="tab.key"
                type="button"
                class="tab-item"
                :class="{ active: activeTab === tab.key }"
                :aria-current="activeTab === tab.key ? 'page' : undefined"
                @click="activeTab = tab.key"
              >
                <el-icon><Icon :icon="tab.icon" /></el-icon>
                <span>{{ tab.label }}</span>
                <span
                  v-if="getTabBadge(tab.key) > 0"
                  class="tab-badge"
                  :class="{ 'tab-badge--active': tab.key !== 'host-reachability' }"
                >{{ getTabBadge(tab.key) }}</span>
              </button>
            </div>
          </div>
        </nav>

        <div
          v-if="allActiveBadge > 0"
          class="scan-activity"
        >
          <span class="scan-activity__dot" />
          {{ allActiveBadge }} 个任务运行中
        </div>
      </header>

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
                <span>{{ hostReachabilityTasks.length }} 个历史任务</span>
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
                <span>{{ isHostScanning ? '正在探测' : '等待任务' }}</span>
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
                <span>目标与执行参数</span>
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
                <span>{{ scanTasks.length }} 个任务</span>
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
                <span>{{ allTasksMerged.length }} 个任务</span>
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

const scanTabGroups = [
  {
    label: '发现',
    items: [
      { key: 'host-reachability', label: '主机探活', icon: iconMap.connection },
      { key: 'port-scan', label: '端口扫描', icon: iconMap.scan }
    ]
  },
  {
    label: '识别',
    items: [
      { key: 'fingerprint-tcp', label: 'TCP 指纹', icon: iconMap.fingerprint },
      { key: 'fingerprint-http', label: 'HTTP 指纹', icon: iconMap.fingerprint },
      { key: 'fingerprint-recon', label: '侦察扫描', icon: iconMap.search }
    ]
  },
  {
    label: '任务',
    items: [
      { key: 'all', label: '全部任务', icon: iconMap.list }
    ]
  }
]

const activePageMeta = computed(() => (
  scanTabGroups.flatMap(group => group.items).find(tab => tab.key === activeTab.value) ||
  scanTabGroups[0].items[0]
))

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

const getTabBadge = key => {
  if (key === 'host-reachability') return hostReachabilityTasks.value.length
  if (key === 'port-scan') return portScanActiveBadge.value
  if (key === 'all') return allActiveBadge.value
  return 0
}

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
  padding: 12px;
  background: var(--app-page-background);
  container-name: scan-workbench;
  container-type: inline-size;
}

.scan-shell {
  --scan-surface: var(--app-card-background);
  --scan-soft-surface: var(--app-control-background-soft);
  --scan-border: var(--app-surface-border-subtle);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--scan-border);
  border-radius: var(--app-panel-radius);
  background: var(--scan-surface);
}

.scan-toolbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  min-height: 76px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--scan-border);
  background: var(--scan-surface);
  flex-shrink: 0;
}

.scan-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 156px;
}

.scan-heading__icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 22%, var(--scan-border));
  border-radius: var(--app-control-radius);
  background: var(--app-brand-background);
  color: var(--el-color-primary);
  font-size: 20px;
}

.scan-heading h2 {
  margin: 0 0 2px;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--el-text-color-primary);
}

.scan-heading span:not(.scan-heading__icon) {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.scan-tab-bar {
  min-width: 0;
  display: flex;
  align-items: stretch;
  gap: 14px;
  overflow-x: auto;
  scrollbar-width: none;
}

.scan-tab-bar::-webkit-scrollbar {
  display: none;
}

.tab-group {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tab-group + .tab-group::before {
  content: '';
  position: absolute;
  top: 5px;
  bottom: 2px;
  left: -7px;
  width: 1px;
  background: var(--scan-border);
}

.tab-group__label {
  padding-left: 5px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 650;
  line-height: 1;
}

.tab-group__items {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--app-control-radius);
  background: var(--scan-soft-surface);
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--app-control-radius);
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 550;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.tab-item:hover {
  background: var(--app-control-background-hover);
  color: var(--el-text-color-primary);
}

.tab-item.active {
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--scan-border));
  background: var(--scan-surface);
  color: var(--el-color-primary);
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

.scan-activity {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: max-content;
  padding: 7px 9px;
  border: 1px solid color-mix(in srgb, var(--el-color-success) 22%, var(--scan-border));
  border-radius: var(--app-control-radius);
  color: var(--el-text-color-regular);
  font-size: 11px;
  background: color-mix(in srgb, var(--el-color-success) 6%, var(--scan-surface));
}

.scan-activity__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-success) 14%, transparent);
}

.scan-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  background: var(--app-page-background);
}

.workspace-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 0.88fr) minmax(0, 1.12fr);
  gap: 12px;
}

.workspace-grid-single {
  grid-template-columns: 1fr;
}

.workspace-grid--host {
  grid-template-columns: minmax(380px, 0.88fr) minmax(0, 1.12fr);
  grid-template-rows: minmax(0, 1fr);
}

.workspace-grid--stacked {
  grid-template-columns: minmax(380px, 0.88fr) minmax(0, 1.12fr);
  grid-template-rows: minmax(0, 1fr);
}

.workspace-grid--host .workspace-pane + .workspace-pane,
.workspace-grid--stacked .workspace-pane + .workspace-pane {
  border-left: 1px solid var(--scan-border);
}

.workspace-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--scan-border);
  border-radius: var(--app-panel-radius);
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
}

.workspace-pane--config .pane-body {
  background: var(--app-page-background);
}

.workspace-pane:not(.workspace-pane--config) > .pane-body {
  background: var(--app-page-background);
}

.pane-header {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 13px;
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
  font-size: 14px;
  font-weight: 650;
}

.pane-header span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.pane-step {
  flex-shrink: 0;
  font-family: var(--app-font-mono, monospace);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border-radius: var(--app-control-radius);
  background: var(--app-brand-background);
  color: var(--el-color-primary) !important;
  font-size: 11px !important;
  font-weight: 700;
}

.pane-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  overflow: auto;
}

.pane-body--flush {
  padding: 0;
  overflow: hidden;
}

.workspace-pane--embedded {
  background: transparent;
}

@container scan-workbench (max-width: 820px) {
  .scan-toolbar {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px;
  }

  .scan-activity {
    display: none;
  }

  .workspace-grid {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .workspace-grid--host,
  .workspace-grid--stacked {
    grid-template-rows: auto auto;
  }

  .workspace-grid--host .workspace-pane + .workspace-pane,
  .workspace-grid--stacked .workspace-pane + .workspace-pane {
    border-left: 0;
  }

  .workspace-grid--host,
  .workspace-grid--stacked {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
  }

  .workspace-grid--host .workspace-pane,
  .workspace-grid--stacked .workspace-pane {
    min-height: 0;
    flex: 0 0 auto;
  }

  .workspace-grid--host .workspace-pane--config,
  .workspace-grid--stacked .workspace-pane--config {
    height: auto;
  }

  .workspace-grid--host .workspace-pane:not(.workspace-pane--config),
  .workspace-grid--stacked .workspace-pane:not(.workspace-pane--config) {
    min-height: 260px;
  }
}

@container scan-workbench (max-width: 768px) {
  .scan-shell {
    border: 0;
    border-radius: 0;
  }

  .scan-toolbar {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 10px 12px 8px;
  }

  .scan-heading__icon {
    width: 32px;
    height: 32px;
  }

  .scan-tab-bar {
    margin: 0 -12px;
    padding: 0 12px 2px;
  }

  .scan-main {
    padding: 8px;
    overflow-y: auto;
  }

  .workspace-pane--config {
    height: auto;
  }

  .tab-item {
    padding: 0 8px;
    font-size: 12px;
  }

  .pane-body {
    padding: 10px;
  }
}

@media (max-width: 768px) {
  .scan-workbench {
    padding: 0;
  }
}
</style>
